import json
import smtplib
from datetime import UTC, date, datetime, timedelta
from email.message import EmailMessage
from urllib import error, request

from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.alert import Alert
from app.models.client import Client
from app.models.irrigation_area import IrrigationArea
from app.models.node import Node
from app.models.notification_preference import NotificationPreference
from app.models.property import Property
from app.models.reading import Reading
from app.models.user import User


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
    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME

    if not settings.SMTP_HOST or not from_email:
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = recipient_email
    msg.set_content(body)

    try:
        if settings.SMTP_USE_SSL:
            with smtplib.SMTP_SSL(
                settings.SMTP_HOST,
                settings.SMTP_PORT,
                timeout=20,
            ) as smtp:
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                smtp.send_message(msg)
            return True

        with smtplib.SMTP(
            settings.SMTP_HOST,
            settings.SMTP_PORT,
            timeout=20,
        ) as smtp:
            smtp.ehlo()
            if settings.SMTP_USE_TLS:
                smtp.starttls()
                smtp.ehlo()
            if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            smtp.send_message(msg)
        return True
    except Exception:
        return False


def _send_whatsapp_notification(
    *,
    recipient_phone: str,
    message: str,
) -> bool:
    if not settings.WHATSAPP_PHONE_NUMBER_ID or not settings.WHATSAPP_ACCESS_TOKEN:
        return False

    api_base = settings.WHATSAPP_API_BASE_URL.rstrip("/")
    url = f"{api_base}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
    payload = {
        "messaging_product": "whatsapp",
        "to": recipient_phone,
        "type": "text",
        "text": {"preview_url": False, "body": message},
    }
    body = json.dumps(payload).encode("utf-8")

    req = request.Request(url=url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("Authorization", f"Bearer {settings.WHATSAPP_ACCESS_TOKEN}")

    try:
        with request.urlopen(req, timeout=settings.WHATSAPP_HTTP_TIMEOUT_SECONDS):
            return True
    except (error.HTTPError, error.URLError, TimeoutError):
        return False


def _target_channel_for_severity(severity: str) -> str:
    # Business rule: critical alerts use WhatsApp, other severities use email.
    return "whatsapp" if severity == "critical" else "email"


def dispatch_pending_notifications(
    db: Session,
    *,
    limit: int = 200,
    only_unread: bool = False,
    severity: str | None = None,
    alert_type: str | None = None,
) -> dict[str, int | bool | datetime]:
    now_utc = datetime.now(UTC).replace(tzinfo=None)

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
        pending_by_channel_conditions.append(
            and_(
                Alert.severidad != "critical",
                Alert.notificada_email.is_(False),
            )
        )
    if whatsapp_enabled:
        pending_by_channel_conditions.append(
            and_(
                Alert.severidad == "critical",
                Alert.notificada_whatsapp.is_(False),
            )
        )

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
        target_channel = _target_channel_for_severity(alert.severidad)
        channel_allowed = _is_notification_channel_allowed(
            db,
            cache=preference_cache,
            client_id=client_id,
            irrigation_area_id=alert.area_riego_id,
            alert_type=alert.tipo,
            severity=alert.severidad,
            channel=target_channel,
        )

        if not channel_allowed:
            skipped_alerts += 1
            continue

        if target_channel == "email" and email_enabled and not alert.notificada_email:
            if recipient_email:
                attempted_any = True
                email_sent = _send_email_notification(
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

        if (
            target_channel == "whatsapp"
            and whatsapp_enabled
            and not alert.notificada_whatsapp
        ):
            if recipient_phone:
                attempted_any = True
                whatsapp_sent = _send_whatsapp_notification(
                    recipient_phone=recipient_phone,
                    message=message,
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


def create_alert(
    db: Session,
    *,
    node_id: int,
    irrigation_area_id: int,
    threshold_id: int | None,
    alert_type: str,
    parameter: str | None,
    detected_value: float | None,
    severity: str,
    message: str,
    timestamp: datetime,
) -> Alert:
    alert = Alert(
        nodo_id=node_id,
        area_riego_id=irrigation_area_id,
        umbral_id=threshold_id,
        tipo=alert_type,
        parametro=parameter,
        valor_detectado=detected_value,
        severidad=severity,
        mensaje=message,
        marca_tiempo=timestamp,
    )
    db.add(alert)
    db.flush()
    return alert


def get_alert(db: Session, alert_id: int) -> Alert:
    alert = db.execute(select(Alert).where(Alert.id == alert_id)).scalar_one_or_none()
    if alert is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with id {alert_id} not found",
        )
    return alert


def list_alerts(
    db: Session,
    page: int,
    per_page: int,
    irrigation_area_id: int | None = None,
    node_id: int | None = None,
    severity: str | None = None,
    read: bool | None = None,
    alert_type: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    allowed_area_ids: list[int] | None = None,
) -> tuple[list[Alert], int]:
    conditions = []

    if allowed_area_ids is not None:
        if not allowed_area_ids:
            return [], 0
        conditions.append(Alert.area_riego_id.in_(allowed_area_ids))

    if irrigation_area_id is not None:
        conditions.append(Alert.area_riego_id == irrigation_area_id)
    if node_id is not None:
        conditions.append(Alert.nodo_id == node_id)
    if severity is not None:
        conditions.append(Alert.severidad == severity)
    if read is not None:
        conditions.append(Alert.leida.is_(read))
    if alert_type is not None:
        conditions.append(Alert.tipo == alert_type)
    if start_date is not None:
        conditions.append(
            Alert.marca_tiempo >= datetime.combine(start_date, datetime.min.time())
        )
    if end_date is not None:
        conditions.append(
            Alert.marca_tiempo <= datetime.combine(end_date, datetime.max.time())
        )

    total = (
        db.execute(select(func.count()).select_from(Alert).where(*conditions)).scalar()
        or 0
    )

    items = list(
        db.execute(
            select(Alert)
            .where(*conditions)
            .order_by(Alert.marca_tiempo.desc(), Alert.id.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).scalars()
    )
    return items, total


def mark_alert_read(db: Session, alert_id: int, read: bool = True) -> Alert:
    alert = get_alert(db, alert_id)
    alert.leida = read
    alert.leida_en = datetime.now(UTC).replace(tzinfo=None) if read else None
    db.commit()
    db.refresh(alert)
    return alert


def _has_inactivity_alert_for_current_outage(
    db: Session,
    *,
    node_id: int,
    last_reading_at: datetime,
) -> bool:
    existing = db.execute(
        select(Alert.id).where(
            Alert.nodo_id == node_id,
            Alert.tipo == "inactivity",
            Alert.marca_tiempo >= last_reading_at,
        )
    ).scalar_one_or_none()
    return existing is not None


def scan_inactivity_alerts(
    db: Session,
    *,
    minutes_without_data: int = 20,
    node_id: int | None = None,
    irrigation_area_id: int | None = None,
) -> dict[str, int | datetime]:
    now_utc = datetime.now(UTC).replace(tzinfo=None)
    inactive_delta = timedelta(minutes=minutes_without_data)

    query = select(Node).where(
        Node.eliminado_en.is_(None),
        Node.activo.is_(True),
    )
    if node_id is not None:
        query = query.where(Node.id == node_id)
    if irrigation_area_id is not None:
        query = query.where(Node.area_riego_id == irrigation_area_id)

    nodes = list(db.execute(query).scalars())

    inactive_nodes = 0
    created_alerts = 0

    for node in nodes:
        last_reading_at = db.execute(
            select(func.max(Reading.marca_tiempo)).where(Reading.nodo_id == node.id)
        ).scalar_one_or_none()
        if last_reading_at is None:
            continue

        if now_utc - last_reading_at < inactive_delta:
            continue

        inactive_nodes += 1

        if _has_inactivity_alert_for_current_outage(
            db,
            node_id=node.id,
            last_reading_at=last_reading_at,
        ):
            continue

        elapsed_minutes = int((now_utc - last_reading_at).total_seconds() // 60)
        create_alert(
            db,
            node_id=node.id,
            irrigation_area_id=node.area_riego_id,
            threshold_id=None,
            alert_type="inactivity",
            parameter=None,
            detected_value=None,
            severity="critical",
            message=(
                f"Node without data for {elapsed_minutes} minutes. "
                f"Last reading at {last_reading_at.isoformat()}"
            ),
            timestamp=now_utc,
        )
        created_alerts += 1

    if created_alerts > 0:
        db.commit()

    return {
        "scanned_nodes": len(nodes),
        "inactive_nodes": inactive_nodes,
        "created_alerts": created_alerts,
        "executed_at": now_utc,
    }
