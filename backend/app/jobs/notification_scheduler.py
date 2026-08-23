import os
import time
from datetime import UTC, datetime
from urllib import error, parse

from app.core.scheduler_client import SchedulerApiClient


def _now_iso() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


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
            query = parse.urlencode(
                {
                    "limit": str(dispatch_limit),
                    "only_unread": "true" if only_unread else "false",
                }
            )
            result = client.post_authenticated(
                f"/alerts/dispatch-notifications?{query}", {}
            )
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
