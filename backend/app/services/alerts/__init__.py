from app.services.alerts.dispatch import (
    _send_email_notification,
    _send_whatsapp_notification,
    dispatch_pending_notifications,
)
from app.services.alerts.inactivity import scan_inactivity_alerts
from app.services.alerts.queries import (
    count_unread_alerts,
    create_alert,
    get_alert,
    list_alerts,
    mark_alert_read,
    mark_alerts_read_bulk,
)
from app.services.alerts.recommendations import generate_alert_recommendation

__all__ = [
    "create_alert",
    "get_alert",
    "list_alerts",
    "count_unread_alerts",
    "mark_alert_read",
    "mark_alerts_read_bulk",
    "generate_alert_recommendation",
    "scan_inactivity_alerts",
    "dispatch_pending_notifications",
    "_send_email_notification",
    "_send_whatsapp_notification",
]
