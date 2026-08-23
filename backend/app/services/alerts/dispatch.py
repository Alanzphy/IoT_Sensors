from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.emailer import send_email
from app.core.time import utc_now
from app.models.alert import Alert
from app.models.client import Client
from app.models.irrigation_area import IrrigationArea
from app.models.node import Node
from app.models.notification_preference import NotificationPreference
from app.models.property import Property
from app.models.user import User
from app.services.whatsapp import WhatsAppAlertContext, send_whatsapp_alert

import app.services.alerts as _alerts  # runtime lookup so tests can monkeypatch the package attribute


def _build_email_subject(alert: Alert) -> str:
    return (
        f"{settings.NOTIFICATION_EMAIL_SUBJECT_PREFIX} "
        f"{alert.severidad.upper()} - Nodo {alert.nodo_id}"
    )
def _build_notification_message(
    *,
    alert: Alert,
    area_name: str,
    property_name: str,
    node_name: str,
) -> str:
    lines = [
        "Alerta de monitoreo de riego",
        f"Severidad: {alert.severidad.upper()}",
        f"Tipo: {alert.tipo}",
        f"Predio: {property_name}",
        f"Area: {area_name}",
        f"Nodo: {node_name}",
    ]

    if alert.parametro:
        lines.append(f"Parametro: {alert.parametro}")
    if alert.valor_detectado is not None:
        lines.append(f"Valor detectado: {float(alert.valor_detectado)}")

    lines.extend(
        [
            f"Mensaje: {alert.mensaje}",
            f"Timestamp UTC: {alert.marca_tiempo.isoformat()}",
        ]
    )
    return "\n".join(lines)
def _build_alert_recommendation_url(alert: Alert) -> str:
    base_url = settings.FRONTEND_PUBLIC_URL.rstrip("/")
    return f"{base_url}/cliente/alertas/{alert.id}"
def _normalize_phone_number(raw_phone: str | None) -> str | None:
    if raw_phone is None:
        return None
    cleaned = "".join(ch for ch in raw_phone if ch.isdigit())
    return cleaned or None
def _resolve_alert_contact_data(
    db: Session,
    *,
    alert: Alert,
) -> tuple[str | None, str | None, str, str, str, int, bool] | None:
    row = db.execute(
        select(
            User.correo,
            Client.telefono,
            Property.nombre,
            IrrigationArea.nombre,
            Node.nombre,
            Client.id,
            Client.notificaciones_habilitadas,
        )
        .select_from(IrrigationArea)
        .join(
            Property,
            Property.id == IrrigationArea.predio_id,
        )
        .join(
            Client,
            Client.id == Property.cliente_id,
        )
        .join(
            User,
            User.id == Client.usuario_id,
        )
        .join(
            Node,
            Node.area_riego_id == IrrigationArea.id,
        )
        .where(
            IrrigationArea.id == alert.area_riego_id,
            Node.id == alert.nodo_id,
            IrrigationArea.eliminado_en.is_(None),
            Property.eliminado_en.is_(None),
            Client.eliminado_en.is_(None),
            User.eliminado_en.is_(None),
            User.activo.is_(True),
            Node.eliminado_en.is_(None),
        )
    ).first()

    if row is None:
        return None

    (
        email,
        phone,
        property_name,
        area_name,
        node_name,
        client_id,
        notifications_enabled,
    ) = row
    normalized_phone = _normalize_phone_number(phone)
    resolved_node_name = node_name or f"Node {alert.nodo_id}"
    return (
        email,
        normalized_phone,
        property_name,
        area_name,
        resolved_node_name,
        client_id,
        notifications_enabled,
    )
def _is_notification_channel_allowed(
    db: Session,
    *,
    cache: dict[tuple[int, int, str, str, str], bool],
    client_id: int,
    irrigation_area_id: int,
    alert_type: str,
    severity: str,
    channel: str,
) -> bool:
    cache_key = (client_id, irrigation_area_id, alert_type, severity, channel)
    if cache_key in cache:
        return cache[cache_key]

    configured = db.execute(
        select(NotificationPreference.habilitado).where(
            NotificationPreference.cliente_id == client_id,
            NotificationPreference.area_riego_id == irrigation_area_id,
            NotificationPreference.tipo_alerta == alert_type,
            NotificationPreference.severidad == severity,
            NotificationPreference.canal == channel,
        )
    ).scalar_one_or_none()

    allowed = True if configured is None else bool(configured)
    cache[cache_key] = allowed
    return allowed
def _send_email_notification(
    *,
    recipient_email: str,
    subject: str,
    body: str,
) -> bool:
    return send_email(recipient_email=recipient_email, subject=subject, body=body)
def _send_whatsapp_notification(
    *,
    recipient_phone: str,
    message: str,
    alert: Alert,
    area_name: str,
    property_name: str,
    node_name: str,
) -> bool:
    return send_whatsapp_alert(
        WhatsAppAlertContext(
            alert=alert,
            recipient_phone=recipient_phone,
            property_name=property_name,
            area_name=area_name,
            node_name=node_name,
            recommendation_url=_build_alert_recommendation_url(alert),
            message=message,
        )
    )
def dispatch_pending_notifications(
    db: Session,
    *,
    limit: int = 200,
    only_unread: bool = False,
    severity: str | None = None,
    alert_type: str | None = None,
) -> dict[str, int | bool | datetime]:
    now_utc = utc_now()

    notifications_enabled = settings.NOTIFICATIONS_ENABLED
    email_enabled = notifications_enabled and settings.NOTIFICATIONS_EMAIL_ENABLED
    whatsapp_enabled = notifications_enabled and settings.NOTIFICATIONS_WHATSAPP_ENABLED

    if not email_enabled and not whatsapp_enabled:
        return {
            "notifications_enabled": notifications_enabled,
            "email_enabled": email_enabled,
            "whatsapp_enabled": whatsapp_enabled,
            "pending_alerts": 0,
            "processed_alerts": 0,
            "skipped_alerts": 0,
            "emailed_alerts": 0,
            "whatsapp_alerts": 0,
            "email_failures": 0,
            "whatsapp_failures": 0,
            "executed_at": now_utc,
        }

    conditions = []
    if only_unread:
        conditions.append(Alert.leida.is_(False))
    if severity is not None:
        conditions.append(Alert.severidad == severity)
    if alert_type is not None:
        conditions.append(Alert.tipo == alert_type)

    pending_by_channel_conditions = []
    if email_enabled:
        pending_by_channel_conditions.append(Alert.notificada_email.is_(False))
    if whatsapp_enabled:
        pending_by_channel_conditions.append(Alert.notificada_whatsapp.is_(False))

    conditions.append(or_(*pending_by_channel_conditions))

    pending_alerts = (
        db.execute(select(func.count()).select_from(Alert).where(*conditions)).scalar()
        or 0
    )

    alerts = list(
        db.execute(
            select(Alert)
            .where(*conditions)
            .order_by(Alert.marca_tiempo.asc(), Alert.id.asc())
            .limit(limit)
        ).scalars()
    )

    processed_alerts = 0
    skipped_alerts = 0
    emailed_alerts = 0
    whatsapp_alerts = 0
    email_failures = 0
    whatsapp_failures = 0
    has_updates = False
    preference_cache: dict[tuple[int, int, str, str, str], bool] = {}

    for alert in alerts:
        processed_alerts += 1
        contact_data = _resolve_alert_contact_data(db, alert=alert)
        if contact_data is None:
            skipped_alerts += 1
            continue

        (
            recipient_email,
            recipient_phone,
            property_name,
            area_name,
            node_name,
            client_id,
            notifications_enabled_for_client,
        ) = contact_data

        if not notifications_enabled_for_client:
            skipped_alerts += 1
            continue

        message = _build_notification_message(
            alert=alert,
            area_name=area_name,
            property_name=property_name,
            node_name=node_name,
        )

        attempted_any = False
        if email_enabled and not alert.notificada_email:
            email_allowed = _is_notification_channel_allowed(
                db,
                cache=preference_cache,
                client_id=client_id,
                irrigation_area_id=alert.area_riego_id,
                alert_type=alert.tipo,
                severity=alert.severidad,
                channel="email",
            )
            if email_allowed and recipient_email:
                attempted_any = True
                email_sent = _alerts._send_email_notification(
                    recipient_email=recipient_email,
                    subject=_build_email_subject(alert),
                    body=message,
                )
                if email_sent:
                    alert.notificada_email = True
                    emailed_alerts += 1
                    has_updates = True
                else:
                    email_failures += 1

        if whatsapp_enabled and not alert.notificada_whatsapp:
            whatsapp_allowed = _is_notification_channel_allowed(
                db,
                cache=preference_cache,
                client_id=client_id,
                irrigation_area_id=alert.area_riego_id,
                alert_type=alert.tipo,
                severity=alert.severidad,
                channel="whatsapp",
            )
            if whatsapp_allowed and recipient_phone:
                attempted_any = True
                whatsapp_sent = _alerts._send_whatsapp_notification(
                    recipient_phone=recipient_phone,
                    message=message,
                    alert=alert,
                    area_name=area_name,
                    property_name=property_name,
                    node_name=node_name,
                )
                if whatsapp_sent:
                    alert.notificada_whatsapp = True
                    whatsapp_alerts += 1
                    has_updates = True
                else:
                    whatsapp_failures += 1

        if not attempted_any:
            skipped_alerts += 1

    if has_updates:
        db.commit()

    return {
        "notifications_enabled": notifications_enabled,
        "email_enabled": email_enabled,
        "whatsapp_enabled": whatsapp_enabled,
        "pending_alerts": pending_alerts,
        "processed_alerts": processed_alerts,
        "skipped_alerts": skipped_alerts,
        "emailed_alerts": emailed_alerts,
        "whatsapp_alerts": whatsapp_alerts,
        "email_failures": email_failures,
        "whatsapp_failures": whatsapp_failures,
        "executed_at": now_utc,
    }
