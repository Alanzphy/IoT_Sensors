import json
import os
import time
from datetime import UTC, datetime
from urllib import error, parse, request


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

    def run_dispatch(self, *, limit: int, only_unread: bool) -> dict:
        self._ensure_access_token()

        headers = {"Authorization": f"Bearer {self.access_token}"}
        query = parse.urlencode(
            {
                "limit": str(limit),
                "only_unread": "true" if only_unread else "false",
            }
        )
        path = f"/alerts/dispatch-notifications?{query}"

        try:
            return self._post_json(path, {}, headers=headers)
        except error.HTTPError as exc:
            if exc.code != 401:
                raise

            if not self._refresh_access_token():
                self._login()

            headers = {"Authorization": f"Bearer {self.access_token}"}
            return self._post_json(path, {}, headers=headers)


def main() -> None:
    base_url = os.getenv("BACKEND_API_URL", "http://backend:5050/api/v1")
    email = os.getenv("SCHEDULER_ADMIN_EMAIL", "")
    password = os.getenv("SCHEDULER_ADMIN_PASSWORD", "")

    interval_seconds = int(os.getenv("NOTIFICATION_DISPATCH_INTERVAL_SECONDS", "300"))
    dispatch_limit = int(os.getenv("NOTIFICATION_DISPATCH_LIMIT", "200"))
    only_unread = (
        os.getenv("NOTIFICATION_DISPATCH_ONLY_UNREAD", "false").lower() == "true"
    )
    timeout_seconds = int(os.getenv("NOTIFICATION_DISPATCH_HTTP_TIMEOUT_SECONDS", "20"))

    if not email or not password:
        raise RuntimeError(
            "Missing scheduler credentials: set SCHEDULER_ADMIN_EMAIL and "
            "SCHEDULER_ADMIN_PASSWORD"
        )

    client = SchedulerApiClient(
        base_url=base_url,
        email=email,
        password=password,
        timeout_seconds=timeout_seconds,
    )

    print(f"[{_now_iso()}] Notification scheduler started")
    print(
        f"[{_now_iso()}] Target={base_url}, interval={interval_seconds}s, "
        f"limit={dispatch_limit}, only_unread={only_unread}"
    )

    while True:
        try:
            result = client.run_dispatch(limit=dispatch_limit, only_unread=only_unread)
            print(
                f"[{_now_iso()}] Dispatch ok: processed={result.get('processed_alerts')}, "
                f"emailed={result.get('emailed_alerts')}, "
                f"whatsapp={result.get('whatsapp_alerts')}, "
                f"email_failures={result.get('email_failures')}, "
                f"whatsapp_failures={result.get('whatsapp_failures')}"
            )
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            print(
                f"[{_now_iso()}] Dispatch http error: status={exc.code}, detail={detail}"
            )
        except error.URLError as exc:
            print(f"[{_now_iso()}] Dispatch url error: {exc}")
        except Exception as exc:
            print(f"[{_now_iso()}] Dispatch error: {exc}")

        time.sleep(interval_seconds)


if __name__ == "__main__":
    main()
