import os
import time
from datetime import UTC, datetime
from urllib import error

from app.core.scheduler_client import SchedulerApiClient


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def main() -> None:
    base_url = os.getenv("BACKEND_API_URL", "http://backend:5050/api/v1")
    email = os.getenv("SCHEDULER_ADMIN_EMAIL", "")
    password = os.getenv("SCHEDULER_ADMIN_PASSWORD", "")

    interval_seconds = int(os.getenv("INACTIVITY_SCAN_INTERVAL_SECONDS", "300"))
    minutes_without_data = int(os.getenv("INACTIVITY_SCAN_MINUTES", "20"))
    timeout_seconds = int(os.getenv("INACTIVITY_SCAN_HTTP_TIMEOUT_SECONDS", "20"))

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

    print(f"[{_now_iso()}] Inactivity scheduler started")
    print(
        f"[{_now_iso()}] Target={base_url}, interval={interval_seconds}s, "
        f"minutes_without_data={minutes_without_data}"
    )

    while True:
        try:
            result = client.post_authenticated(
                f"/alerts/scan-inactivity?minutes_without_data={minutes_without_data}",
                {},
            )
            print(
                f"[{_now_iso()}] Scan ok: scanned_nodes={result.get('scanned_nodes')}, "
                f"inactive_nodes={result.get('inactive_nodes')}, "
                f"created_alerts={result.get('created_alerts')}"
            )
        except error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            print(f"[{_now_iso()}] Scan http error: status={exc.code}, detail={detail}")
        except error.URLError as exc:
            print(f"[{_now_iso()}] Scan url error: {exc}")
        except Exception as exc:
            print(f"[{_now_iso()}] Scan error: {exc}")

        time.sleep(interval_seconds)


if __name__ == "__main__":
    main()
