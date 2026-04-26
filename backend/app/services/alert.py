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
from app.models.crop_cycle import CropCycle
from app.models.crop_type import CropType
from app.models.irrigation_area import IrrigationArea
from app.models.node import Node
from app.models.notification_preference import NotificationPreference
from app.models.property import Property
from app.models.reading import Reading
from app.models.threshold import Threshold
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


def _to_bool(value) -> bool | None:
    if value is None:
        return None
    return bool(value)


def _round_number(value: float | None, digits: int = 3) -> float | None:
    if value is None:
        return None
    return round(value, digits)


def _classify_delta_trend(
    latest: float | None,
    previous: float | None,
    *,
    absolute_tolerance: float = 0.15,
    relative_tolerance: float = 0.03,
) -> tuple[str, float | None]:
    if latest is None or previous is None:
        return "insufficient_data", None

    delta = latest - previous
    threshold = max(abs(previous) * relative_tolerance, absolute_tolerance)
    if delta > threshold:
        return "up", _round_number(delta)
    if delta < -threshold:
        return "down", _round_number(delta)
    return "stable", _round_number(delta)


def _avg(values: list[float]) -> float | None:
    if not values:
        return None
    return _round_number(sum(values) / len(values))


def _metric_summary_from_readings(
    rows_desc: list[Reading],
    *,
    field_name: str,
) -> dict:
    series: list[tuple[datetime, float]] = []
    for item in rows_desc:
        raw_value = getattr(item, field_name)
        value = _to_float(raw_value)
        if value is None:
            continue
        series.append((item.marca_tiempo, value))

    if not series:
        return {
            "count": 0,
            "latest": None,
            "previous": None,
            "delta": None,
            "trend": "insufficient_data",
            "avg": None,
            "min": None,
            "max": None,
        }

    series_asc = sorted(series, key=lambda item: item[0])
    values = [item[1] for item in series_asc]
    latest = values[-1]
    previous = values[-2] if len(values) >= 2 else None
    trend, delta = _classify_delta_trend(latest, previous)
    return {
        "count": len(values),
        "latest": _round_number(latest),
        "previous": _round_number(previous),
        "delta": delta,
        "trend": trend,
        "avg": _avg(values),
        "min": _round_number(min(values)),
        "max": _round_number(max(values)),
    }


def _resolve_alert_scope_context(
    db: Session,
    *,
    alert: Alert,
) -> dict:
    row = db.execute(
        select(
            Property.nombre,
            IrrigationArea.nombre,
            Node.nombre,
            CropType.nombre,
            IrrigationArea.tamano_area,
        )
        .select_from(IrrigationArea)
        .join(Property, Property.id == IrrigationArea.predio_id)
        .join(Node, Node.area_riego_id == IrrigationArea.id)
        .join(CropType, CropType.id == IrrigationArea.tipo_cultivo_id)
        .where(
            IrrigationArea.id == alert.area_riego_id,
            Node.id == alert.nodo_id,
            Property.eliminado_en.is_(None),
            IrrigationArea.eliminado_en.is_(None),
            Node.eliminado_en.is_(None),
            CropType.eliminado_en.is_(None),
        )
    ).first()
    if row is None:
        return {
            "property_name": "Predio desconocido",
            "area_name": "Area desconocida",
            "node_name": f"Nodo {alert.nodo_id}",
            "crop_type_name": None,
            "area_size": None,
            "active_crop_cycle": None,
        }

    property_name, area_name, node_name, crop_type_name, area_size = row
    today = datetime.now(UTC).date()
    active_cycle = db.execute(
        select(CropCycle)
        .where(
            CropCycle.area_riego_id == alert.area_riego_id,
            CropCycle.eliminado_en.is_(None),
            CropCycle.fecha_inicio <= today,
            or_(CropCycle.fecha_fin.is_(None), CropCycle.fecha_fin >= today),
        )
        .order_by(desc(CropCycle.fecha_inicio), desc(CropCycle.id))
        .limit(1)
    ).scalar_one_or_none()

    cycle_data = None
    if active_cycle is not None:
        cycle_data = {
            "start_date": active_cycle.fecha_inicio.isoformat(),
            "end_date": (
                active_cycle.fecha_fin.isoformat()
                if active_cycle.fecha_fin is not None
                else None
            ),
        }

    return {
        "property_name": property_name or "Predio desconocido",
        "area_name": area_name or "Area desconocida",
        "node_name": node_name or f"Nodo {alert.nodo_id}",
        "crop_type_name": crop_type_name,
        "area_size": _to_float(area_size),
        "active_crop_cycle": cycle_data,
    }


def _resolve_alert_threshold_context(
    db: Session,
    *,
    alert: Alert,
) -> dict:
    threshold: Threshold | None = None

    if alert.umbral_id is not None:
        threshold = db.execute(
            select(Threshold).where(
                Threshold.id == alert.umbral_id,
                Threshold.eliminado_en.is_(None),
            )
        ).scalar_one_or_none()

    if threshold is None and alert.parametro:
        threshold = db.execute(
            select(Threshold)
            .where(
                Threshold.area_riego_id == alert.area_riego_id,
                Threshold.parametro == alert.parametro,
                Threshold.activo.is_(True),
                Threshold.eliminado_en.is_(None),
            )
            .order_by(desc(Threshold.id))
            .limit(1)
        ).scalar_one_or_none()

    detected_value = _to_float(alert.valor_detectado)
    if threshold is None:
        return {
            "threshold_id": None,
            "parameter": alert.parametro,
            "severity": alert.severidad,
            "min_value": None,
            "max_value": None,
            "active": None,
            "breach_type": "no_threshold",
            "distance_to_bound": None,
        }

    min_value = _to_float(threshold.rango_min)
    max_value = _to_float(threshold.rango_max)
    breach_type = "unknown"
    distance_to_bound: float | None = None

    if detected_value is None:
        breach_type = "value_missing"
    elif min_value is not None and detected_value < min_value:
        breach_type = "below_min"
        distance_to_bound = _round_number(min_value - detected_value)
    elif max_value is not None and detected_value > max_value:
        breach_type = "above_max"
        distance_to_bound = _round_number(detected_value - max_value)
    elif min_value is not None and max_value is not None:
        breach_type = "inside_range"
        distance_to_bound = _round_number(
            min(abs(detected_value - min_value), abs(detected_value - max_value))
        )
    elif min_value is not None:
        breach_type = "above_min_only_rule"
        distance_to_bound = _round_number(detected_value - min_value)
    elif max_value is not None:
        breach_type = "below_max_only_rule"
        distance_to_bound = _round_number(max_value - detected_value)

    return {
        "threshold_id": threshold.id,
        "parameter": threshold.parametro,
        "severity": threshold.severidad,
        "min_value": min_value,
        "max_value": max_value,
        "active": bool(threshold.activo),
        "breach_type": breach_type,
        "distance_to_bound": distance_to_bound,
    }


def _is_azure_alert_recommendation_enabled() -> bool:
    return (
        settings.AI_ALERT_RECOMMENDATIONS_ENABLED
        and settings.AZURE_OPENAI_ENABLED
        and bool(settings.AZURE_OPENAI_ENDPOINT)
        and bool(settings.AZURE_OPENAI_API_KEY)
        and bool(settings.AZURE_OPENAI_DEPLOYMENT)
    )


def _build_deterministic_recommendation(
    alert: Alert,
    *,
    scope_context: dict,
    threshold_context: dict,
    readings_context: dict,
) -> str:
    node_name = scope_context.get("node_name") or f"Nodo {alert.nodo_id}"
    area_name = scope_context.get("area_name") or "Area"
    parameter = alert.parametro or "parametro"
    detected_value = _to_float(alert.valor_detectado)
    min_value = threshold_context.get("min_value")
    max_value = threshold_context.get("max_value")
    parameter_trend = (
        readings_context.get("alert_parameter") or {}
    ).get("trend", "insufficient_data")
    freshness_minutes = readings_context.get("freshness_minutes")

    if alert.tipo == "inactivity":
        elapsed = (
            f"{freshness_minutes} min sin datos"
            if isinstance(freshness_minutes, (int, float))
            else "sin datos recientes"
        )
        return (
            f"1. {node_name} en {area_name} presenta inactividad ({elapsed}); valida energia y enlace de red.\n"
            "2. Confirma integridad de API key, gateway y conectividad saliente del dispositivo.\n"
            "3. Si no recupera telemetria en la siguiente ventana (10-20 min), ejecuta reinicio controlado y verificacion fisica."
        )

    range_hint = []
    if min_value is not None:
        range_hint.append(f"min {min_value}")
    if max_value is not None:
        range_hint.append(f"max {max_value}")
    range_text = ", ".join(range_hint) if range_hint else "sin umbral activo"
    detected_text = (
        f"{_round_number(detected_value)}" if detected_value is not None else "sin valor"
    )

    if parameter == "soil.humidity":
        return (
            f"1. Humedad detectada {detected_text}% ({range_text}) con tendencia {parameter_trend}; confirma condicion real en campo.\n"
            "2. Contrasta contra flujo reciente y ultimo riego para decidir si ajustar lamina o frecuencia.\n"
            "3. Verifica sensor/punto de medicion y monitorea 2-3 lecturas (20-30 min) antes de un cambio mayor."
        )
    if parameter == "irrigation.flow_per_minute":
        return (
            f"1. Flujo detectado {detected_text} L/min ({range_text}) con tendencia {parameter_trend}; valida si coincide con la maniobra esperada.\n"
            "2. Revisa presion, valvulas, filtros y posibles fugas/obstrucciones en la linea.\n"
            "3. Si la desviacion persiste por mas de 3 lecturas, ajusta operacion y programa mantenimiento."
        )
    if parameter == "environmental.eto":
        return (
            f"1. ETO detectada {detected_text} mm/dia ({range_text}) y tendencia {parameter_trend}; interpreta impacto sobre demanda hidrica.\n"
            "2. Cruza ETO con humedad de suelo y estado de riego antes de aumentar lamina.\n"
            "3. Prioriza horarios de menor evaporacion y valida resultado en la siguiente hora."
        )
    return (
        f"1. Parametro {parameter} con valor {detected_text} ({range_text}); confirma la brecha respecto al umbral.\n"
        "2. Revisa tendencia y coherencia con lecturas recientes del nodo para descartar ruido de sensor.\n"
        "3. Aplica ajuste operativo gradual y valida efecto en la siguiente ventana de telemetria."
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
            "window_size": max_rows,
            "count": 0,
            "first_timestamp": None,
            "last_timestamp": None,
            "coverage_minutes": None,
            "expected_readings_10m": None,
            "freshness_minutes": None,
            "alert_parameter": {
                "name": alert.parametro,
                "count": 0,
                "latest": None,
                "previous": None,
                "delta": None,
                "trend": "insufficient_data",
                "avg": None,
                "min": None,
                "max": None,
            },
            "priority_metrics": {
                "soil_humidity": _metric_summary_from_readings(
                    [],
                    field_name="suelo_humedad",
                ),
                "flow_per_minute": _metric_summary_from_readings(
                    [],
                    field_name="riego_flujo_por_minuto",
                ),
                "eto": _metric_summary_from_readings(
                    [],
                    field_name="ambiental_eto",
                ),
            },
            "irrigation_state": {
                "active_ratio": None,
                "last_active": None,
                "accumulated_liters_latest": None,
                "accumulated_liters_delta_window": None,
            },
            "recent_samples": [],
        }

    timestamps = [item.marca_tiempo for item in rows]
    first_timestamp = min(timestamps)
    last_timestamp = max(timestamps)
    coverage_minutes = int((last_timestamp - first_timestamp).total_seconds() // 60)
    freshness_minutes = int(
        (
            datetime.now(UTC).replace(tzinfo=None) - last_timestamp
        ).total_seconds()
        // 60
    )
    expected_readings_10m = max(1, coverage_minutes // 10 + 1)

    alert_parameter_field = {
        "soil.humidity": "suelo_humedad",
        "irrigation.flow_per_minute": "riego_flujo_por_minuto",
        "environmental.eto": "ambiental_eto",
    }.get(alert.parametro or "")
    alert_parameter_summary = (
        _metric_summary_from_readings(rows, field_name=alert_parameter_field)
        if alert_parameter_field
        else {
            "count": 0,
            "latest": None,
            "previous": None,
            "delta": None,
            "trend": "not_mapped",
            "avg": None,
            "min": None,
            "max": None,
        }
    )

    irrigation_active_values = [
        _to_bool(item.riego_activo) for item in rows if item.riego_activo is not None
    ]
    active_ratio = None
    if irrigation_active_values:
        active_ratio = _round_number(
            (sum(1 for item in irrigation_active_values if item) / len(irrigation_active_values))
            * 100
        )

    accumulated_liters_series = [
        _to_float(item.riego_litros_acumulados)
        for item in sorted(rows, key=lambda item: item.marca_tiempo)
        if item.riego_litros_acumulados is not None
    ]
    accumulated_liters_latest = (
        _round_number(accumulated_liters_series[-1])
        if accumulated_liters_series
        else None
    )
    accumulated_liters_delta_window = None
    if len(accumulated_liters_series) >= 2:
        accumulated_liters_delta_window = _round_number(
            accumulated_liters_series[-1] - accumulated_liters_series[0]
        )

    recent_samples = []
    for item in rows[:6]:
        recent_samples.append(
            {
                "timestamp": item.marca_tiempo.isoformat(),
                "soil_humidity": _round_number(_to_float(item.suelo_humedad), digits=2),
                "flow_per_minute": _round_number(
                    _to_float(item.riego_flujo_por_minuto), digits=2
                ),
                "eto": _round_number(_to_float(item.ambiental_eto), digits=3),
                "irrigation_active": _to_bool(item.riego_activo),
            }
        )

    return {
        "window_size": max_rows,
        "count": len(rows),
        "first_timestamp": first_timestamp.isoformat(),
        "last_timestamp": last_timestamp.isoformat(),
        "coverage_minutes": coverage_minutes,
        "expected_readings_10m": expected_readings_10m,
        "freshness_minutes": max(freshness_minutes, 0),
        "alert_parameter": {
            "name": alert.parametro,
            **alert_parameter_summary,
        },
        "priority_metrics": {
            "soil_humidity": _metric_summary_from_readings(
                rows,
                field_name="suelo_humedad",
            ),
            "flow_per_minute": _metric_summary_from_readings(
                rows,
                field_name="riego_flujo_por_minuto",
            ),
            "eto": _metric_summary_from_readings(
                rows,
                field_name="ambiental_eto",
            ),
        },
        "irrigation_state": {
            "active_ratio": active_ratio,
            "last_active": (
                next(
                    (
                        item.marca_tiempo.isoformat()
                        for item in rows
                        if item.riego_activo is True
                    ),
                    None,
                )
            ),
            "accumulated_liters_latest": accumulated_liters_latest,
            "accumulated_liters_delta_window": accumulated_liters_delta_window,
        },
        "recent_samples": recent_samples,
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
        "Eres un asesor agronomico para riego tecnificado. Usa SOLO el contexto JSON "
        "proporcionado. No des consejos genericos. Debes citar valores concretos "
        "(valor detectado, umbral, tendencia o frescura) y proponer acciones "
        "operativas inmediatas para la siguiente hora y para las siguientes 24 horas. "
        "Responde en espanol, texto plano, exactamente 4 lineas numeradas."
    )
    user_message = (
        "Genera recomendacion para el operador de campo con este contexto JSON:\n"
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

    scope_context = _resolve_alert_scope_context(db, alert=alert)
    threshold_context = _resolve_alert_threshold_context(db, alert=alert)
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
        "scope": scope_context,
        "threshold": threshold_context,
        "recent_readings": readings_context,
        "telemetry_contract": {
            "expected_interval_minutes": 10,
            "priority_parameters": [
                "soil.humidity",
                "irrigation.flow_per_minute",
                "environmental.eto",
            ],
        },
    }

    source = "fallback"
    metadata = {
        "provider": "rules-fallback",
        "alert_id": alert.id,
        "context_version": "v2",
        "threshold_id": threshold_context.get("threshold_id"),
        "readings_count": readings_context.get("count"),
    }
    error_detail: str | None = None

    if _is_azure_alert_recommendation_enabled():
        try:
            recommendation, ai_metadata = _call_azure_alert_recommendation(
                alert=alert,
                context_payload=context_payload,
            )
            source = "ai"
            metadata = ai_metadata
            metadata["context_version"] = "v2"
            metadata["threshold_id"] = threshold_context.get("threshold_id")
            metadata["readings_count"] = readings_context.get("count")
        except Exception as exc:
            recommendation = _build_deterministic_recommendation(
                alert,
                scope_context=scope_context,
                threshold_context=threshold_context,
                readings_context=readings_context,
            )
            error_detail = str(exc)[:1500]
    else:
        recommendation = _build_deterministic_recommendation(
            alert,
            scope_context=scope_context,
            threshold_context=threshold_context,
            readings_context=readings_context,
        )

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
