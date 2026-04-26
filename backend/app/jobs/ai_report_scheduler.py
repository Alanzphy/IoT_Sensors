import json
import os
import time
from datetime import UTC, datetime
from urllib import error, request


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


class SchedulerApiClient:
    def __init__(
        self,
        *,
        base_url: str,
        email: str,
        password: str,
        timeout_seconds: int,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.email = email
        self.password = password
        self.timeout_seconds = timeout_seconds
        self.access_token: str | None = None
        self.refresh_token: str | None = None

    def _post_json(
        self,
        path: str,
        payload: dict,
        headers: dict[str, str] | None = None,
    ) -> dict:
        url = f"{self.base_url}{path}"
        body = json.dumps(payload).encode("utf-8")
        req = request.Request(url=url, data=body, method="POST")
        req.add_header("Content-Type", "application/json")

        if headers:
            for key, value in headers.items():
                req.add_header(key, value)

        with request.urlopen(req, timeout=self.timeout_seconds) as resp:
            raw = resp.read().decode("utf-8")
            if not raw:
                return {}
            return json.loads(raw)

    def _login(self) -> None:
        payload = {"email": self.email, "password": self.password}
        data = self._post_json("/auth/login", payload)
        self.access_token = data.get("access_token")
        self.refresh_token = data.get("refresh_token")

        if not self.access_token or not self.refresh_token:
            raise RuntimeError("Login response missing tokens")

    def _refresh_access_token(self) -> bool:
        if not self.refresh_token:
            return False

        try:
            data = self._post_json(
                "/auth/refresh",
                {"refresh_token": self.refresh_token},
            )
            self.access_token = data.get("access_token")
            return bool(self.access_token)
        except Exception:
            return False

    def _ensure_access_token(self) -> None:
        if self.access_token:
            return
        self._login()

    def run_generation(self, *, notify: bool, force: bool) -> dict:
        self._ensure_access_token()

        headers = {"Authorization": f"Bearer {self.access_token}"}
        payload = {
            "notify": notify,
            "force": force,
        }

        try:
            return self._post_json("/ai-reports/generate", payload, headers=headers)
        except error.HTTPError as exc:
            if exc.code != 401:
                raise

            if not self._refresh_access_token():
                self._login()

            headers = {"Authorization": f"Bearer {self.access_token}"}
            return self._post_json("/ai-reports/generate", payload, headers=headers)


def main() -> None:
    base_url = os.getenv("BACKEND_API_URL", "http://backend:5050/api/v1")
    email = os.getenv("SCHEDULER_ADMIN_EMAIL", "")
    password = os.getenv("SCHEDULER_ADMIN_PASSWORD", "")
    timeout_seconds = int(os.getenv("AI_REPORTS_HTTP_TIMEOUT_SECONDS", "30"))

    enabled = os.getenv("AI_REPORTS_SCHEDULER_ENABLED", "false").lower() == "true"
    notify = os.getenv("AI_REPORTS_DEFAULT_NOTIFY", "true").lower() == "true"
    force = os.getenv("AI_REPORTS_SCHEDULER_FORCE", "false").lower() == "true"
    poll_seconds = int(os.getenv("AI_REPORTS_SCHEDULER_POLL_SECONDS", "60"))
    schedule_hour = int(os.getenv("AI_REPORTS_SCHEDULE_HOUR_UTC", "2"))
    schedule_minute = int(os.getenv("AI_REPORTS_SCHEDULE_MINUTE_UTC", "0"))

    if not email or not password:
        raise RuntimeError(
            "Missing scheduler credentials: set SCHEDULER_ADMIN_EMAIL and "
            "SCHEDULER_ADMIN_PASSWORD"
        )

    if schedule_hour < 0 or schedule_hour > 23:
        raise RuntimeError("AI_REPORTS_SCHEDULE_HOUR_UTC must be between 0 and 23")
    if schedule_minute < 0 or schedule_minute > 59:
        raise RuntimeError("AI_REPORTS_SCHEDULE_MINUTE_UTC must be between 0 and 59")

    client = SchedulerApiClient(
        base_url=base_url,
        email=email,
        password=password,
        timeout_seconds=timeout_seconds,
    )

    print(f"[{_now_iso()}] AI report scheduler started")
    print(
        f"[{_now_iso()}] Target={base_url}, enabled={enabled}, "
        f"run_at={schedule_hour:02d}:{schedule_minute:02d} UTC, poll={poll_seconds}s"
    )

    last_run_day: str | None = None

    while True:
        now = datetime.now(UTC)
        today_key = now.strftime("%Y-%m-%d")
        should_run_now = (
            enabled
            and (
                (now.hour > schedule_hour)
                or (now.hour == schedule_hour and now.minute >= schedule_minute)
            )
            and last_run_day != today_key
        )

        if should_run_now:
            try:
                result = client.run_generation(notify=notify, force=force)
                last_run_day = today_key
                print(
                    f"[{_now_iso()}] Generate ok: generated={result.get('generated_count')}, "
                    f"skipped={result.get('skipped_count')}, failed={result.get('failed_count')}"
                )
            except error.HTTPError as exc:
                detail = exc.read().decode("utf-8", errors="ignore")
                print(
                    f"[{_now_iso()}] Generate http error: status={exc.code}, detail={detail}"
                )
            except error.URLError as exc:
                print(f"[{_now_iso()}] Generate url error: {exc}")
            except Exception as exc:
                print(f"[{_now_iso()}] Generate error: {exc}")

        time.sleep(poll_seconds)


if __name__ == "__main__":
    main()
