import json
import smtplib
from datetime import UTC, date, datetime, time, timedelta
from email.message import EmailMessage
from urllib import error, request

from fastapi import HTTPException, status
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.ai_report import AIReport
from app.models.alert import Alert
from app.models.client import Client
from app.models.irrigation_area import IrrigationArea
from app.models.node import Node
from app.models.property import Property
from app.models.reading import Reading
from app.models.user import User
from app.services.whatsapp import send_whatsapp_text_message


def _utc_now_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _to_utc_naive(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value
    return value.astimezone(UTC).replace(tzinfo=None)


def _normalize_range(
    *,
    start_datetime: datetime | None,
    end_datetime: datetime | None,
) -> tuple[datetime, datetime]:
    if (start_datetime is None) ^ (end_datetime is None):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="start_datetime and end_datetime must be provided together",
        )

    if start_datetime is not None and end_datetime is not None:
        start = _to_utc_naive(start_datetime)
        end = _to_utc_naive(end_datetime)
        if start >= end:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="start_datetime must be before end_datetime",
            )
        return start, end

    now_utc = _utc_now_naive()
    today_utc = now_utc.date()
    start = datetime.combine(today_utc - timedelta(days=1), time.min)
    end = datetime.combine(today_utc, time.min)
    return start, end


def _get_client_contact(db: Session, client_id: int) -> tuple[str, str | None, str | None]:
    row = db.execute(
        select(
            Client.nombre_empresa,
            Client.telefono,
            User.correo,
        )
        .select_from(Client)
        .join(User, User.id == Client.usuario_id)
        .where(
            Client.id == client_id,
            Client.eliminado_en.is_(None),
            User.eliminado_en.is_(None),
            User.activo.is_(True),
        )
    ).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Client with id {client_id} not found",
        )
    return row


def _normalize_phone_number(raw_phone: str | None) -> str | None:
    if raw_phone is None:
        return None
    cleaned = "".join(ch for ch in raw_phone if ch.isdigit())
    return cleaned or None


def _resolve_target_scope(
    db: Session,
    *,
    client_id: int | None,
    irrigation_area_id: int | None,
) -> list[tuple[int, int | None]]:
    if irrigation_area_id is not None:
        row = db.execute(
            select(Property.cliente_id)
            .select_from(IrrigationArea)
            .join(Property, Property.id == IrrigationArea.predio_id)
            .where(
                IrrigationArea.id == irrigation_area_id,
                IrrigationArea.eliminado_en.is_(None),
                Property.eliminado_en.is_(None),
            )
        ).scalar_one_or_none()
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Irrigation area with id {irrigation_area_id} not found",
            )
        return [(int(row), irrigation_area_id)]

    if client_id is not None:
        exists_client = db.execute(
            select(Client.id).where(
                Client.id == client_id,
                Client.eliminado_en.is_(None),
            )
        ).scalar_one_or_none()
        if exists_client is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Client with id {client_id} not found",
            )
        return [(client_id, None)]

    rows = db.execute(
        select(Property.cliente_id, IrrigationArea.id)
        .select_from(IrrigationArea)
        .join(Property, Property.id == IrrigationArea.predio_id)
        .where(
            IrrigationArea.eliminado_en.is_(None),
            Property.eliminado_en.is_(None),
        )
        .order_by(Property.cliente_id.asc(), IrrigationArea.id.asc())
    ).all()
    return [(int(item[0]), int(item[1])) for item in rows]


def _scope_node_ids(
    db: Session,
    *,
    client_id: int,
    irrigation_area_id: int | None,
) -> list[int]:
    conditions = [
        Node.eliminado_en.is_(None),
        Node.activo.is_(True),
    ]
    if irrigation_area_id is not None:
        conditions.extend(
            [
                Node.area_riego_id == irrigation_area_id,
                IrrigationArea.id == irrigation_area_id,
            ]
        )
    else:
        conditions.extend(
            [
                Property.cliente_id == client_id,
                IrrigationArea.eliminado_en.is_(None),
                Property.eliminado_en.is_(None),
            ]
        )

    return list(
        db.execute(
            select(Node.id)
            .select_from(Node)
            .join(IrrigationArea, IrrigationArea.id == Node.area_riego_id)
            .join(Property, Property.id == IrrigationArea.predio_id)
            .where(*conditions)
        ).scalars()
    )


def _report_exists_for_range(
    db: Session,
    *,
    client_id: int,
    irrigation_area_id: int | None,
    range_start: datetime,
    range_end: datetime,
) -> bool:
    conditions = [
        AIReport.cliente_id == client_id,
        AIReport.rango_inicio == range_start,
        AIReport.rango_fin == range_end,
        AIReport.estado.in_(("pending", "processing", "completed")),
    ]
    if irrigation_area_id is None:
        conditions.append(AIReport.area_riego_id.is_(None))
    else:
        conditions.append(AIReport.area_riego_id == irrigation_area_id)
    return (
        db.execute(
            select(AIReport.id).where(*conditions).limit(1)
        ).scalar_one_or_none()
        is not None
    )


def _resolve_scope_labels(
    db: Session,
    *,
    client_id: int,
    irrigation_area_id: int | None,
) -> tuple[str, str | None, str | None]:
    if irrigation_area_id is None:
        row = db.execute(
            select(Client.nombre_empresa)
            .where(
                Client.id == client_id,
                Client.eliminado_en.is_(None),
            )
        ).scalar_one_or_none()
        if row is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Client with id {client_id} not found",
            )
        return row, None, None

    row = db.execute(
        select(
            Client.nombre_empresa,
            Property.nombre,
            IrrigationArea.nombre,
        )
        .select_from(IrrigationArea)
        .join(Property, Property.id == IrrigationArea.predio_id)
        .join(Client, Client.id == Property.cliente_id)
        .where(
            Client.id == client_id,
            IrrigationArea.id == irrigation_area_id,
            Client.eliminado_en.is_(None),
            Property.eliminado_en.is_(None),
            IrrigationArea.eliminado_en.is_(None),
        )
    ).first()
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scope not found for client={client_id} area={irrigation_area_id}",
        )
    return row


def _to_float(value: object) -> float | None:
    if value is None:
        return None
    return float(value)


def _collect_report_context(
    db: Session,
    *,
    client_id: int,
    irrigation_area_id: int | None,
    range_start: datetime,
    range_end: datetime,
) -> dict:
    client_name, property_name, area_name = _resolve_scope_labels(
        db,
        client_id=client_id,
        irrigation_area_id=irrigation_area_id,
    )
    node_ids = _scope_node_ids(
        db,
        client_id=client_id,
        irrigation_area_id=irrigation_area_id,
    )

    readings_data = {
        "count": 0,
        "first_timestamp": None,
        "last_timestamp": None,
        "soil_humidity_avg": None,
        "soil_humidity_min": None,
        "soil_humidity_max": None,
        "flow_avg": None,
        "flow_max": None,
        "eto_avg": None,
        "eto_max": None,
        "accumulated_liters_min": None,
        "accumulated_liters_max": None,
    }
    alerts_data = {
        "total": 0,
        "info": 0,
        "warning": 0,
        "critical": 0,
        "inactivity": 0,
    }
    freshness_data = {
        "nodes_total": len(node_ids),
        "nodes_with_data": 0,
        "stale_20m": 0,
        "stale_60m": 0,
        "oldest_last_reading": None,
    }

    if node_ids:
        agg = db.execute(
            select(
                func.count(Reading.id),
                func.min(Reading.marca_tiempo),
                func.max(Reading.marca_tiempo),
                func.avg(Reading.suelo_humedad),
                func.min(Reading.suelo_humedad),
                func.max(Reading.suelo_humedad),
                func.avg(Reading.riego_flujo_por_minuto),
                func.max(Reading.riego_flujo_por_minuto),
                func.avg(Reading.ambiental_eto),
                func.max(Reading.ambiental_eto),
                func.min(Reading.riego_litros_acumulados),
                func.max(Reading.riego_litros_acumulados),
            ).where(
                Reading.nodo_id.in_(node_ids),
                Reading.marca_tiempo >= range_start,
                Reading.marca_tiempo < range_end,
            )
        ).one()

        readings_data = {
            "count": int(agg[0] or 0),
            "first_timestamp": agg[1],
            "last_timestamp": agg[2],
            "soil_humidity_avg": _to_float(agg[3]),
            "soil_humidity_min": _to_float(agg[4]),
            "soil_humidity_max": _to_float(agg[5]),
            "flow_avg": _to_float(agg[6]),
            "flow_max": _to_float(agg[7]),
            "eto_avg": _to_float(agg[8]),
            "eto_max": _to_float(agg[9]),
            "accumulated_liters_min": _to_float(agg[10]),
            "accumulated_liters_max": _to_float(agg[11]),
        }

        alert_agg = db.execute(
            select(
                func.count(Alert.id),
                func.coalesce(
                    func.sum(case((Alert.severidad == "info", 1), else_=0)),
                    0,
                ),
                func.coalesce(
                    func.sum(case((Alert.severidad == "warning", 1), else_=0)),
                    0,
                ),
                func.coalesce(
                    func.sum(case((Alert.severidad == "critical", 1), else_=0)),
                    0,
                ),
                func.coalesce(
                    func.sum(case((Alert.tipo == "inactivity", 1), else_=0)),
                    0,
                ),
            ).where(
                Alert.nodo_id.in_(node_ids),
                Alert.marca_tiempo >= range_start,
                Alert.marca_tiempo < range_end,
            )
        ).one()
        alerts_data = {
            "total": int(alert_agg[0] or 0),
            "info": int(alert_agg[1] or 0),
            "warning": int(alert_agg[2] or 0),
            "critical": int(alert_agg[3] or 0),
            "inactivity": int(alert_agg[4] or 0),
        }

        latest_by_node = db.execute(
            select(
                Reading.nodo_id,
                func.max(Reading.marca_tiempo),
            )
            .where(Reading.nodo_id.in_(node_ids))
            .group_by(Reading.nodo_id)
        ).all()

        now_utc = _utc_now_naive()
        with_data = 0
        stale_20m = 0
        stale_60m = 0
        oldest_last: datetime | None = None
        for _, last_seen in latest_by_node:
            if last_seen is None:
                continue
            with_data += 1
            minutes_diff = (now_utc - last_seen).total_seconds() / 60
            if minutes_diff >= 20:
                stale_20m += 1
            if minutes_diff >= 60:
                stale_60m += 1
            if oldest_last is None or last_seen < oldest_last:
                oldest_last = last_seen

        freshness_data = {
            "nodes_total": len(node_ids),
            "nodes_with_data": with_data,
            "stale_20m": stale_20m,
            "stale_60m": stale_60m,
            "oldest_last_reading": oldest_last,
        }

    return {
        "client_id": client_id,
        "client_name": client_name,
        "property_name": property_name,
        "irrigation_area_id": irrigation_area_id,
        "irrigation_area_name": area_name,
        "node_ids": node_ids,
        "range_start": range_start,
        "range_end": range_end,
        "readings": readings_data,
        "alerts": alerts_data,
        "freshness": freshness_data,
    }


def _build_fallback_report(context: dict) -> tuple[str, str, str, dict]:
    readings = context["readings"]
    alerts = context["alerts"]
    freshness = context["freshness"]

    scope_name = context["irrigation_area_name"] or "todas las areas del cliente"
    summary = (
        f"Analisis del periodo {context['range_start'].date()} a {context['range_end'].date()} "
        f"para {scope_name}. Se registraron {readings['count']} lecturas, "
        f"{alerts['total']} alertas y {freshness['stale_20m']} nodos con retraso >=20 minutos."
    )

    findings_lines = [
        f"- Humedad suelo promedio: {readings['soil_humidity_avg'] if readings['soil_humidity_avg'] is not None else 'N/D'}",
        f"- Flujo promedio (L/min): {readings['flow_avg'] if readings['flow_avg'] is not None else 'N/D'}",
        f"- ETO promedio (mm/dia): {readings['eto_avg'] if readings['eto_avg'] is not None else 'N/D'}",
        f"- Alertas critical: {alerts['critical']}",
        f"- Alertas inactivity: {alerts['inactivity']}",
    ]

    humidity_avg = readings["soil_humidity_avg"]
    eto_avg = readings["eto_avg"]
    critical = alerts["critical"]
    stale_20m = freshness["stale_20m"]

    recommendation_parts = []
    if humidity_avg is not None and humidity_avg < 25:
        recommendation_parts.append(
            "Ajustar lamina de riego porque la humedad promedio del suelo fue baja."
        )
    if eto_avg is not None and eto_avg > 6:
        recommendation_parts.append(
            "Programar riegos mas frecuentes en horas de menor evaporacion por ETO elevada."
        )
    if critical > 0:
        recommendation_parts.append(
            "Revisar umbrales y atender las alertas criticas pendientes en la plataforma."
        )
    if stale_20m > 0:
        recommendation_parts.append(
            "Verificar conectividad o energia en nodos con retraso de comunicacion."
        )
    if not recommendation_parts:
        recommendation_parts.append(
            "Mantener la estrategia actual y continuar monitoreando tendencias diarias."
        )

    metadata = {
        "provider": "rules-fallback",
        "model": None,
        "tokens_prompt": None,
        "tokens_completion": None,
    }
    return summary, "\n".join(findings_lines), " ".join(recommendation_parts), metadata


def _azure_openai_enabled() -> bool:
    return (
        settings.AZURE_OPENAI_ENABLED
        and bool(settings.AZURE_OPENAI_ENDPOINT)
        and bool(settings.AZURE_OPENAI_API_KEY)
        and bool(settings.AZURE_OPENAI_DEPLOYMENT)
    )


def _call_azure_openai(context: dict) -> tuple[str, str, str, dict]:
    endpoint = settings.AZURE_OPENAI_ENDPOINT.rstrip("/")
    url = (
        f"{endpoint}/openai/deployments/{settings.AZURE_OPENAI_DEPLOYMENT}"
        f"/chat/completions?api-version={settings.AZURE_OPENAI_API_VERSION}"
    )

    prompt_payload = {
        "scope": {
            "client_name": context["client_name"],
            "property_name": context["property_name"],
            "irrigation_area_name": context["irrigation_area_name"],
            "range_start": context["range_start"].isoformat(),
            "range_end": context["range_end"].isoformat(),
        },
        "readings": context["readings"],
        "alerts": context["alerts"],
        "freshness": context["freshness"],
    }

    system_message = (
        "Eres un analista agronomico para monitoreo de riego. "
        "Responde SOLO con JSON valido con llaves: summary, findings, recommendation. "
        "findings debe ser string multilinea corto con bullets."
    )
    user_message = (
        "Genera un reporte ejecutivo claro y accionable basado en estos datos agregados:\n"
        f"{json.dumps(prompt_payload, ensure_ascii=True, default=str)}"
    )

    body = {
        "messages": [
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ],
        "temperature": settings.AZURE_OPENAI_TEMPERATURE,
        "max_tokens": settings.AZURE_OPENAI_MAX_TOKENS,
        "response_format": {"type": "json_object"},
    }

    req = request.Request(
        url=url,
        data=json.dumps(body).encode("utf-8"),
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
        content_text = data["choices"][0]["message"]["content"]
        parsed = json.loads(content_text)
        summary = str(parsed.get("summary", "")).strip()
        findings = str(parsed.get("findings", "")).strip()
        recommendation = str(parsed.get("recommendation", "")).strip()
        if not summary or not recommendation:
            raise ValueError("Missing required fields in model response")
    except Exception as exc:
        raise RuntimeError(f"Invalid Azure OpenAI response payload: {exc}") from exc

    usage = data.get("usage", {})
    metadata = {
        "provider": "azure-openai",
        "model": data.get("model"),
        "tokens_prompt": usage.get("prompt_tokens"),
        "tokens_completion": usage.get("completion_tokens"),
    }
    return summary, findings, recommendation, metadata


def _generate_report_content(context: dict) -> tuple[str, str, str, dict]:
    if _azure_openai_enabled():
        return _call_azure_openai(context)
    return _build_fallback_report(context)


def _build_report_url(report_id: int) -> str:
    return f"{settings.FRONTEND_PUBLIC_URL.rstrip('/')}/cliente/reportes-ia/{report_id}"


def _send_email_notification(*, recipient_email: str, subject: str, body: str) -> bool:
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
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as smtp:
                if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                    smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                smtp.send_message(msg)
            return True

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as smtp:
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


def _notify_report(
    db: Session,
    *,
    report: AIReport,
    context: dict,
) -> dict[str, bool | str]:
    notification_state: dict[str, bool | str] = {
        "email_sent": False,
        "whatsapp_sent": False,
        "email_skipped": False,
        "whatsapp_skipped": False,
    }

    if not settings.NOTIFICATIONS_ENABLED:
        notification_state["email_skipped"] = True
        notification_state["whatsapp_skipped"] = True
        return notification_state

    client = db.execute(
        select(Client).where(Client.id == report.cliente_id)
    ).scalar_one_or_none()
    if client is None or not client.notificaciones_habilitadas:
        notification_state["email_skipped"] = True
        notification_state["whatsapp_skipped"] = True
        return notification_state

    _, phone, email = _get_client_contact(db, report.cliente_id)
    report_url = _build_report_url(report.id)

    subject = f"[Sensores IoT] Reporte IA {context['range_start'].date()}"
    body = (
        f"Se genero un reporte IA para {context['client_name']}.\n"
        f"Periodo: {context['range_start'].isoformat()} a {context['range_end'].isoformat()} UTC\n"
        f"Resumen: {report.resumen or 'N/D'}\n"
        f"Ver detalle: {report_url}"
    )

    if settings.NOTIFICATIONS_EMAIL_ENABLED and email:
        notification_state["email_sent"] = _send_email_notification(
            recipient_email=email,
            subject=subject,
            body=body,
        )
    else:
        notification_state["email_skipped"] = True

    normalized_phone = _normalize_phone_number(phone)
    if settings.NOTIFICATIONS_WHATSAPP_ENABLED and normalized_phone:
        wa_message = (
            f"Reporte IA listo para {context['client_name']}. "
            f"Periodo {context['range_start'].date()} a {context['range_end'].date()}. "
            f"Ver detalle: {report_url}"
        )
        notification_state["whatsapp_sent"] = send_whatsapp_text_message(
            recipient_phone=normalized_phone,
            message=wa_message,
        )
    else:
        notification_state["whatsapp_skipped"] = True

    return notification_state


def list_ai_reports(
    db: Session,
    *,
    page: int,
    per_page: int,
    client_id: int | None = None,
    irrigation_area_id: int | None = None,
    status_value: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    allowed_client_id: int | None = None,
) -> tuple[list[AIReport], int]:
    conditions = []

    if allowed_client_id is not None:
        conditions.append(AIReport.cliente_id == allowed_client_id)
    if client_id is not None:
        conditions.append(AIReport.cliente_id == client_id)
    if irrigation_area_id is not None:
        conditions.append(AIReport.area_riego_id == irrigation_area_id)
    if status_value is not None:
        conditions.append(AIReport.estado == status_value)
    if start_date is not None:
        conditions.append(AIReport.rango_inicio >= datetime.combine(start_date, time.min))
    if end_date is not None:
        conditions.append(AIReport.rango_fin <= datetime.combine(end_date, time.max))

    total = (
        db.execute(select(func.count()).select_from(AIReport).where(*conditions)).scalar()
        or 0
    )

    items = list(
        db.execute(
            select(AIReport)
            .where(*conditions)
            .order_by(AIReport.rango_inicio.desc(), AIReport.id.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).scalars()
    )
    return items, total


def get_ai_report(db: Session, report_id: int) -> AIReport:
    item = db.execute(
        select(AIReport).where(AIReport.id == report_id)
    ).scalar_one_or_none()
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"AI report with id {report_id} not found",
        )
    return item


def generate_ai_reports(
    db: Session,
    *,
    client_id: int | None,
    irrigation_area_id: int | None,
    start_datetime: datetime | None,
    end_datetime: datetime | None,
    notify: bool,
    force: bool,
) -> dict[str, object]:
    range_start, range_end = _normalize_range(
        start_datetime=start_datetime,
        end_datetime=end_datetime,
    )
    targets = _resolve_target_scope(
        db,
        client_id=client_id,
        irrigation_area_id=irrigation_area_id,
    )

    generated_count = 0
    skipped_count = 0
    failed_count = 0
    report_ids: list[int] = []

    for target_client_id, target_area_id in targets:
        if (not force) and _report_exists_for_range(
            db,
            client_id=target_client_id,
            irrigation_area_id=target_area_id,
            range_start=range_start,
            range_end=range_end,
        ):
            skipped_count += 1
            continue

        report = AIReport(
            cliente_id=target_client_id,
            area_riego_id=target_area_id,
            rango_inicio=range_start,
            rango_fin=range_end,
            estado="processing",
        )
        db.add(report)
        db.commit()
        db.refresh(report)

        try:
            context = _collect_report_context(
                db,
                client_id=target_client_id,
                irrigation_area_id=target_area_id,
                range_start=range_start,
                range_end=range_end,
            )
            summary, findings, recommendation, generation_metadata = _generate_report_content(
                context
            )

            report.estado = "completed"
            report.resumen = summary
            report.hallazgos = findings
            report.recomendacion = recommendation
            report.error_detalle = None
            report.generado_en = _utc_now_naive()

            metadata = {
                **generation_metadata,
                "client_id": target_client_id,
                "irrigation_area_id": target_area_id,
                "node_count": len(context["node_ids"]),
                "readings_count": context["readings"]["count"],
            }

            if notify:
                metadata["notification"] = _notify_report(
                    db,
                    report=report,
                    context=context,
                )
            else:
                metadata["notification"] = {"skipped": True}

            report.metadatos_generacion = json.dumps(metadata, ensure_ascii=True, default=str)

            db.commit()
            db.refresh(report)

            generated_count += 1
            report_ids.append(report.id)
        except Exception as exc:
            report.estado = "failed"
            report.error_detalle = str(exc)[:2000]
            report.generado_en = _utc_now_naive()
            report.metadatos_generacion = json.dumps(
                {
                    "provider": "azure-openai" if _azure_openai_enabled() else "rules-fallback",
                    "error_type": exc.__class__.__name__,
                },
                ensure_ascii=True,
            )
            db.commit()
            failed_count += 1

    return {
        "generated_count": generated_count,
        "skipped_count": skipped_count,
        "failed_count": failed_count,
        "report_ids": report_ids,
        "range_start": range_start,
        "range_end": range_end,
        "executed_at": _utc_now_naive(),
    }
