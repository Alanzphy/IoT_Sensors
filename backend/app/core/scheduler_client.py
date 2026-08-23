import json
from urllib import error, request


class SchedulerApiClient:
    """HTTP client used by the phase-2 scheduler jobs to call the backend API.

    Handles admin login (access + refresh tokens) and transparently retries
    once with a refreshed token when the API answers 401.
    """

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

    def post_authenticated(self, path: str, payload: dict) -> dict:
        """POST as the scheduler admin, retrying once after token refresh on 401."""
        self._ensure_access_token()

        headers = {"Authorization": f"Bearer {self.access_token}"}
        try:
            return self._post_json(path, payload, headers=headers)
        except error.HTTPError as exc:
            if exc.code != 401:
                raise

            if not self._refresh_access_token():
                self._login()

            headers = {"Authorization": f"Bearer {self.access_token}"}
            return self._post_json(path, payload, headers=headers)