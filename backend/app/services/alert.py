import smtplib
import json
from datetime import UTC, date, datetime, timedelta
from email.message import EmailMessage
from urllib import error, request

from fastapi import HTTPException, status
from sqlalchemy import desc, func, or_, select
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
from app.services.whatsapp import WhatsAppAlertContext, send_whatsapp_alert


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


def _to_float(value) -> float | None:
    if value is None:
        return None
    return float(value)


def _is_azure_alert_recommendation_enabled() -> bool:
    return (
        settings.AI_ALERT_RECOMMENDATIONS_ENABLED
        and settings.AZURE_OPENAI_ENABLED
        and bool(settings.AZURE_OPENAI_ENDPOINT)
        and bool(settings.AZURE_OPENAI_API_KEY)
        and bool(settings.AZURE_OPENAI_DEPLOYMENT)
    )


def _build_deterministic_recommendation(alert: Alert) -> str:
    if alert.tipo == "inactivity":
        return (
            "1. Verifica energía, conectividad y estado físico del nodo.\n"
            "2. Confirma que la API key del nodo no haya cambiado.\n"
            "3. Si el nodo sigue sin enviar datos, reinicia equipo y gateway de red."
        )

    parameter = alert.parametro or ""
    if parameter == "soil.humidity":
        return (
            "1. Compara la humedad detectada contra el umbral configurado.\n"
            "2. Revisa si el último riego fue suficiente para recuperar humedad.\n"
            "3. Valida sensor y punto de medición antes de ajustar programa de riego."
        )
    if parameter == "irrigation.flow_per_minute":
        return (
            "1. Revisa presión, válvulas y filtros de la línea de riego.\n"
            "2. Verifica fugas u obstrucciones que alteren el caudal.\n"
            "3. Compara con el histórico reciente para detectar desviaciones sostenidas."
        )
    if parameter == "environmental.eto":
        return (
            "1. Interpreta ETO alta como mayor demanda hídrica del cultivo.\n"
            "2. Cruza ETO con humedad de suelo antes de aumentar la lámina de riego.\n"
            "3. Ajusta horarios para reducir pérdidas por evaporación."
        )
    return (
        "1. Revisa el parámetro alertado contra su rango configurado.\n"
        "2. Valida coherencia con lecturas recientes del mismo nodo.\n"
        "3. Ejecuta ajuste operativo gradual y monitorea siguiente ventana de datos."
    )


def _resolve_alert_scope_labels(
    db: Session,
    *,
    alert: Alert,
) -> tuple[str, str, str]:
    row = db.execute(
        select(
            Property.nombre,
            IrrigationArea.nombre,
            Node.nombre,
        )
        .select_from(IrrigationArea)
        .join(Property, Property.id == IrrigationArea.predio_id)
        .join(Node, Node.area_riego_id == IrrigationArea.id)
        .where(
            IrrigationArea.id == alert.area_riego_id,
            Node.id == alert.nodo_id,
            Property.eliminado_en.is_(None),
            IrrigationArea.eliminado_en.is_(None),
            Node.eliminado_en.is_(None),
        )
    ).first()
    if row is None:
        return ("Predio desconocido", "Area desconocida", f"Nodo {alert.nodo_id}")
    property_name, area_name, node_name = row
    return (
        property_name or "Predio desconocido",
        area_name or "Area desconocida",
        node_name or f"Nodo {alert.nodo_id}",
    )


def _collect_recent_readings_context(db: Session, *, alert: Alert) -> dict:
    max_rows = max(1, settings.AI_ALERT_RECOMMENDATIONS_MAX_RECENT_READINGS)
    rows = list(
        db.execute(
            select(Reading)
            .where(Reading.nodo_id == alert.nodo_id)
            .order_by(desc(Reading.marca_tiempo))
            .limit(max_rows)
        ).scalars()
    )
    if not rows:
        return {
            "count": 0,
            "first_timestamp": None,
            "last_timestamp": None,
            "soil_humidity_avg": None,
            "flow_avg": None,
            "eto_avg": None,
        }

    hum_values = [_to_float(item.suelo_humedad) for item in rows if item.suelo_humedad is not None]
    flow_values = [_to_float(item.riego_flujo_por_minuto) for item in rows if item.riego_flujo_por_minuto is not None]
    eto_values = [_to_float(item.ambiental_eto) for item in rows if item.ambiental_eto is not None]

    def _avg(values: list[float]) -> float | None:
        if not values:
            return None
        return sum(values) / len(values)

    timestamps = [item.marca_tiempo for item in rows]
    return {
        "count": len(rows),
        "first_timestamp": min(timestamps),
        "last_timestamp": max(timestamps),
        "soil_humidity_avg": _avg(hum_values),
        "flow_avg": _avg(flow_values),
        "eto_avg": _avg(eto_values),
    }


def _call_azure_alert_recommendation(
    *,
    alert: Alert,
    context_payload: dict,
) -> tuple[str, dict]:
    endpoint = settings.AZURE_OPENAI_ENDPOINT.rstrip("/")
    url = (
        f"{endpoint}/openai/deployments/{settings.AZURE_OPENAI_DEPLOYMENT}"
        f"/chat/completions?api-version={settings.AZURE_OPENAI_API_VERSION}"
    )

    system_message = (
        "Eres un asistente agronomico. Genera una recomendacion breve, accionable y "
        "especifica para una alerta de riego en espanol. Responde en texto plano, "
        "maximo 5 lineas numeradas."
    )
    user_message = (
        "Genera recomendacion basada en este contexto JSON:\n"
        f"{json.dumps(context_payload, ensure_ascii=True, default=str)}"
    )
    payload = {
        "messages": [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ],
        "temperature": settings.AZURE_OPENAI_TEMPERATURE,
        "max_tokens": min(settings.AZURE_OPENAI_MAX_TOKENS, 500),
    }

    req = request.Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
    )
    req.add_header("Content-Type", "application/json")
    req.add_header("api-key", settings.AZURE_OPENAI_API_KEY)

    try:
        with request.urlopen(req, timeout=settings.AZURE_OPENAI_TIMEOUT_SECONDS) as resp:
            raw = resp.read().decode("utf-8")
    except error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Azure OpenAI HTTP {exc.code}: {detail}") from exc
    except Exception as exc:
        raise RuntimeError(f"Azure OpenAI request failed: {exc}") from exc

    try:
        data = json.loads(raw)
        content = str(data["choices"][0]["message"]["content"]).strip()
        if not content:
            raise ValueError("empty content")
    except Exception as exc:
        raise RuntimeError(f"Invalid Azure response payload: {exc}") from exc

    usage = data.get("usage", {})
    metadata = {
        "provider": "azure-openai",
        "model": data.get("model"),
        "tokens_prompt": usage.get("prompt_tokens"),
        "tokens_completion": usage.get("completion_tokens"),
        "alert_id": alert.id,
    }
    return content, metadata


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
                whatsapp_sent = _send_whatsapp_notification(
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


def count_unread_alerts(
    db: Session,
    irrigation_area_id: int | None = None,
    node_id: int | None = None,
    severity: str | None = None,
    alert_type: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    allowed_area_ids: list[int] | None = None,
) -> int:
    conditions = [Alert.leida.is_(False)]

    if allowed_area_ids is not None:
        if not allowed_area_ids:
            return 0
        conditions.append(Alert.area_riego_id.in_(allowed_area_ids))

    if irrigation_area_id is not None:
        conditions.append(Alert.area_riego_id == irrigation_area_id)
    if node_id is not None:
        conditions.append(Alert.nodo_id == node_id)
    if severity is not None:
        conditions.append(Alert.severidad == severity)
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

    return (
        db.execute(select(func.count()).select_from(Alert).where(*conditions)).scalar()
        or 0
    )


def mark_alert_read(db: Session, alert_id: int, read: bool = True) -> Alert:
    alert = get_alert(db, alert_id)
    alert.leida = read
    alert.leida_en = datetime.now(UTC).replace(tzinfo=None) if read else None
    db.commit()
    db.refresh(alert)
    return alert


def generate_alert_recommendation(
    db: Session,
    *,
    alert_id: int,
    force: bool = False,
) -> dict[str, str | datetime | int | None]:
    alert = get_alert(db, alert_id)

    existing_recommendation = (alert.recomendacion_ia or "").strip()
    if existing_recommendation and not force:
        source = "cached_ai"
        metadata_raw = (alert.recomendacion_ia_metadata or "").strip()
        if metadata_raw:
            try:
                metadata = json.loads(metadata_raw)
                if metadata.get("provider") == "rules-fallback":
                    source = "cached_fallback"
            except Exception:
                source = "cached_ai"
        return {
            "alert_id": alert.id,
            "recommendation": existing_recommendation,
            "source": source,
            "generated_at": alert.recomendacion_ia_generada_en,
            "error_detail": alert.recomendacion_ia_error,
        }

    property_name, area_name, node_name = _resolve_alert_scope_labels(db, alert=alert)
    readings_context = _collect_recent_readings_context(db, alert=alert)
    context_payload = {
        "alert": {
            "id": alert.id,
            "type": alert.tipo,
            "severity": alert.severidad,
            "parameter": alert.parametro,
            "detected_value": _to_float(alert.valor_detectado),
            "message": alert.mensaje,
            "timestamp": alert.marca_tiempo.isoformat(),
        },
        "scope": {
            "property_name": property_name,
            "area_name": area_name,
            "node_name": node_name,
        },
        "recent_readings": readings_context,
    }

    source = "fallback"
    metadata = {"provider": "rules-fallback", "alert_id": alert.id}
    error_detail: str | None = None

    if _is_azure_alert_recommendation_enabled():
        try:
            recommendation, ai_metadata = _call_azure_alert_recommendation(
                alert=alert,
                context_payload=context_payload,
            )
            source = "ai"
            metadata = ai_metadata
        except Exception as exc:
            recommendation = _build_deterministic_recommendation(alert)
            error_detail = str(exc)[:1500]
    else:
        recommendation = _build_deterministic_recommendation(alert)

    generated_at = datetime.now(UTC).replace(tzinfo=None)
    alert.recomendacion_ia = recommendation
    alert.recomendacion_ia_error = error_detail
    alert.recomendacion_ia_generada_en = generated_at
    alert.recomendacion_ia_metadata = json.dumps(
        metadata,
        ensure_ascii=True,
        default=str,
    )
    db.commit()
    db.refresh(alert)

    return {
        "alert_id": alert.id,
        "recommendation": recommendation,
        "source": source,
        "generated_at": generated_at,
        "error_detail": error_detail,
    }


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
