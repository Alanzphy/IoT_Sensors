import json
import re
import unicodedata
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib import error, request

from fastapi import HTTPException, status
from sqlalchemy import and_, desc, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.ai_report import AIReport
from app.models.alert import Alert
from app.models.client import Client
from app.models.crop_type import CropType
from app.models.irrigation_area import IrrigationArea
from app.models.node import Node
from app.models.property import Property
from app.models.reading import Reading
from app.models.user import User


def _utc_now_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _to_float(value: Any) -> float | None:
    if value is None:
        return None
    return float(value)


def _to_bool(value: Any) -> bool | None:
    if value is None:
        return None
    return bool(value)


def _round(value: float | None, digits: int = 3) -> float | None:
    if value is None:
        return None
    return round(value, digits)


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    without_accents = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    return without_accents.lower().strip()


def _contains_domain_terms(text: str) -> bool:
    terms = (
        "riego",
        "sensor",
        "sensores",
        "humedad",
        "suelo",
        "eto",
        "evapotranspir",
        "flujo",
        "litros",
        "nodo",
        "nodos",
        "alerta",
        "alertas",
        "predio",
        "predios",
        "area",
        "areas",
        "cultivo",
        "lectura",
        "lecturas",
        "inactividad",
        "dashboard",
        "reporte",
        "reportes",
        "notificacion",
        "notificaciones",
        "whatsapp",
        "umbral",
        "umbrales",
        "frescura",
        "telemetria",
        "cliente",
        "propiedad",
        "historico",
        "historial",
        "recomendacion",
        "riesgo",
    )
    return any(term in text for term in terms)


def _is_math_only_question(text: str) -> bool:
    if not text:
        return False
    return bool(re.fullmatch(r"[\d\s\+\-\*\/\(\)\.,=]+", text))


def _is_domain_follow_up_reference(text: str) -> bool:
    compact = re.sub(r"\s+", " ", text).strip()
    if not compact:
        return False
    patterns = (
        r"y ayer[?!.]*",
        r"y hoy[?!.]*",
        r"de ayer[?!.]*",
        r"de hoy[?!.]*",
        r"detalla(?: eso)?[?!.]*",
        r"amplia(?: eso)?[?!.]*",
        r"resumen(?: de eso)?[?!.]*",
        r"por area[?!.]*",
        r"por predio[?!.]*",
        r"compara(?: con)?(?: ayer| hoy)?[?!.]*",
        r"prioridades(?: de hoy)?[?!.]*",
        r"que paso ayer[?!.]*",
        r"como estuvo ayer[?!.]*",
    )
    return any(re.fullmatch(pattern, compact) for pattern in patterns)


def _is_in_scope_question(message: str, history: list[dict[str, str]]) -> bool:
    normalized_message = _normalize_text(message)
    if not normalized_message:
        return False

    if _contains_domain_terms(normalized_message):
        return True

    if _is_math_only_question(normalized_message):
        return False

    history_text = " ".join(
        _normalize_text(item.get("content", ""))
        for item in history[-4:]
        if item.get("role") in ("user", "assistant")
    )

    if _contains_domain_terms(history_text) and _is_domain_follow_up_reference(
        normalized_message
    ):
        return True

    return False


def _build_out_of_scope_answer() -> str:
    return (
        "Solo puedo ayudarte con consultas del sistema de riego IoT "
        "(sensores, lecturas, alertas, humedad, flujo, ETO, nodos, areas, "
        "predios y reportes). Reformula tu pregunta en ese contexto."
    )


def _azure_openai_enabled() -> bool:
    return (
        settings.AI_ASSISTANT_ENABLED
        and settings.AZURE_OPENAI_ENABLED
        and bool(settings.AZURE_OPENAI_ENDPOINT)
        and bool(settings.AZURE_OPENAI_API_KEY)
        and bool(settings.AZURE_OPENAI_DEPLOYMENT)
    )


def _get_owned_client_id(db: Session, current_user: User) -> int:
    client_id = db.execute(
        select(Client.id).where(
            Client.usuario_id == current_user.id,
            Client.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if client_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client profile not found",
        )
    return int(client_id)


def _resolve_scope(
    db: Session,
    *,
    current_user: User,
    client_id: int | None,
    irrigation_area_id: int | None,
) -> dict[str, int | None]:
    effective_client_id = client_id

    if current_user.rol != "admin":
        owned_client_id = _get_owned_client_id(db, current_user)
        if effective_client_id is not None and effective_client_id != owned_client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this client scope",
            )
        effective_client_id = owned_client_id

    if irrigation_area_id is not None:
        area_scope = db.execute(
            select(
                IrrigationArea.id,
                Property.cliente_id,
            )
            .select_from(IrrigationArea)
            .join(Property, Property.id == IrrigationArea.predio_id)
            .where(
                IrrigationArea.id == irrigation_area_id,
                IrrigationArea.eliminado_en.is_(None),
                Property.eliminado_en.is_(None),
            )
        ).first()
        if area_scope is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Irrigation area with id {irrigation_area_id} not found",
            )

        _, area_client_id = area_scope
        if effective_client_id is not None and int(area_client_id) != int(
            effective_client_id
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this irrigation area scope",
            )
        effective_client_id = int(area_client_id)

    if effective_client_id is not None:
        exists = db.execute(
            select(Client.id).where(
                Client.id == effective_client_id,
                Client.eliminado_en.is_(None),
            )
        ).scalar_one_or_none()
        if exists is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Client with id {effective_client_id} not found",
            )

    return {
        "client_id": effective_client_id,
        "irrigation_area_id": irrigation_area_id,
    }


def _collect_chat_context(
    db: Session,
    *,
    current_user: User,
    scope: dict[str, int | None],
    hours_back: int,
) -> dict[str, Any]:
    now_utc = _utc_now_naive()
    window_start = now_utc - timedelta(hours=hours_back)

    area_query = (
        select(
            IrrigationArea.id,
            IrrigationArea.nombre,
            IrrigationArea.tamano_area,
            Property.nombre,
            Property.cliente_id,
            CropType.nombre,
            Node.id,
            Node.nombre,
        )
        .select_from(IrrigationArea)
        .join(Property, Property.id == IrrigationArea.predio_id)
        .join(CropType, CropType.id == IrrigationArea.tipo_cultivo_id)
        .outerjoin(
            Node,
            and_(
                Node.area_riego_id == IrrigationArea.id,
                Node.eliminado_en.is_(None),
            ),
        )
        .where(
            IrrigationArea.eliminado_en.is_(None),
            Property.eliminado_en.is_(None),
            CropType.eliminado_en.is_(None),
        )
        .order_by(Property.id.asc(), IrrigationArea.id.asc())
    )

    if scope["client_id"] is not None:
        area_query = area_query.where(Property.cliente_id == scope["client_id"])
    if scope["irrigation_area_id"] is not None:
        area_query = area_query.where(IrrigationArea.id == scope["irrigation_area_id"])

    area_rows = list(
        db.execute(area_query.limit(settings.AI_ASSISTANT_MAX_AREAS)).all()
    )
    area_ids = [int(row[0]) for row in area_rows]

    areas: list[dict[str, Any]] = []
    stale_areas_20m = 0

    for row in area_rows:
        (
            area_id,
            area_name,
            area_size,
            property_name,
            client_id,
            crop_type_name,
            node_id,
            node_name,
        ) = row
        area_item: dict[str, Any] = {
            "area_id": int(area_id),
            "client_id": int(client_id),
            "property_name": property_name,
            "area_name": area_name,
            "crop_type_name": crop_type_name,
            "area_size": _to_float(area_size),
            "node_id": int(node_id) if node_id is not None else None,
            "node_name": node_name,
            "last_reading_timestamp": None,
            "freshness_minutes": None,
            "latest": {
                "soil_humidity": None,
                "flow_per_minute": None,
                "eto": None,
                "irrigation_active": None,
            },
            "window_stats": {
                "readings_count": 0,
                "soil_humidity_avg": None,
                "flow_avg": None,
                "eto_avg": None,
            },
            "daily_stats": [],
        }

        if node_id is not None:
            latest = db.execute(
                select(Reading)
                .where(Reading.nodo_id == node_id)
                .order_by(desc(Reading.marca_tiempo))
                .limit(1)
            ).scalar_one_or_none()
            if latest is not None:
                freshness_minutes = int(
                    (now_utc - latest.marca_tiempo).total_seconds() // 60
                )
                area_item["last_reading_timestamp"] = latest.marca_tiempo.isoformat()
                area_item["freshness_minutes"] = max(freshness_minutes, 0)
                area_item["latest"] = {
                    "soil_humidity": _round(_to_float(latest.suelo_humedad), digits=2),
                    "flow_per_minute": _round(
                        _to_float(latest.riego_flujo_por_minuto), digits=2
                    ),
                    "eto": _round(_to_float(latest.ambiental_eto), digits=3),
                    "irrigation_active": _to_bool(latest.riego_activo),
                }
                if freshness_minutes >= 20:
                    stale_areas_20m += 1

            agg = db.execute(
                select(
                    Reading.id,
                    Reading.marca_tiempo,
                    Reading.suelo_humedad,
                    Reading.riego_flujo_por_minuto,
                    Reading.ambiental_eto,
                )
                .where(
                    Reading.nodo_id == node_id,
                    Reading.marca_tiempo >= window_start,
                    Reading.marca_tiempo <= now_utc,
                )
                .order_by(Reading.marca_tiempo.desc())
            ).all()
            hum = [_to_float(item[2]) for item in agg if item[2] is not None]
            flow = [_to_float(item[3]) for item in agg if item[3] is not None]
            eto = [_to_float(item[4]) for item in agg if item[4] is not None]
            area_item["window_stats"] = {
                "readings_count": len(agg),
                "soil_humidity_avg": _round(sum(hum) / len(hum), digits=2) if hum else None,
                "flow_avg": _round(sum(flow) / len(flow), digits=2) if flow else None,
                "eto_avg": _round(sum(eto) / len(eto), digits=3) if eto else None,
            }

            # Daily buckets to answer questions like "como estuvo ayer"
            day_buckets: dict[str, dict[str, Any]] = {}
            for reading_id, reading_ts, soil_h, flow_m, eto_v in agg:
                _ = reading_id
                day_key = reading_ts.date().isoformat()
                bucket = day_buckets.setdefault(
                    day_key,
                    {
                        "readings_count": 0,
                        "soil_humidity_values": [],
                        "flow_values": [],
                        "eto_values": [],
                    },
                )
                bucket["readings_count"] += 1
                if soil_h is not None:
                    bucket["soil_humidity_values"].append(_to_float(soil_h))
                if flow_m is not None:
                    bucket["flow_values"].append(_to_float(flow_m))
                if eto_v is not None:
                    bucket["eto_values"].append(_to_float(eto_v))

            daily_stats: list[dict[str, Any]] = []
            for day in sorted(day_buckets.keys(), reverse=True)[:7]:
                bucket = day_buckets[day]
                hum_values = [v for v in bucket["soil_humidity_values"] if v is not None]
                flow_values = [v for v in bucket["flow_values"] if v is not None]
                eto_values = [v for v in bucket["eto_values"] if v is not None]
                daily_stats.append(
                    {
                        "date": day,
                        "readings_count": bucket["readings_count"],
                        "soil_humidity_avg": _round(sum(hum_values) / len(hum_values), digits=2)
                        if hum_values
                        else None,
                        "flow_avg": _round(sum(flow_values) / len(flow_values), digits=2)
                        if flow_values
                        else None,
                        "eto_avg": _round(sum(eto_values) / len(eto_values), digits=3)
                        if eto_values
                        else None,
                    }
                )
            area_item["daily_stats"] = daily_stats

        areas.append(area_item)

    alerts_query = select(Alert).where(
        Alert.marca_tiempo >= window_start,
        Alert.marca_tiempo <= now_utc,
    )
    if area_ids:
        alerts_query = alerts_query.where(Alert.area_riego_id.in_(area_ids))
    else:
        alerts_query = alerts_query.where(Alert.id == -1)

    recent_alerts_rows = list(
        db.execute(
            alerts_query.order_by(desc(Alert.marca_tiempo), desc(Alert.id)).limit(
                settings.AI_ASSISTANT_MAX_ALERTS
            )
        ).scalars()
    )
    alert_summary = {
        "total": len(recent_alerts_rows),
        "unread": 0,
        "info": 0,
        "warning": 0,
        "critical": 0,
        "inactivity": 0,
    }
    recent_alerts: list[dict[str, Any]] = []
    for item in recent_alerts_rows:
        if not item.leida:
            alert_summary["unread"] += 1
        if item.severidad in ("info", "warning", "critical"):
            alert_summary[item.severidad] += 1
        if item.tipo == "inactivity":
            alert_summary["inactivity"] += 1
        recent_alerts.append(
            {
                "id": item.id,
                "area_id": item.area_riego_id,
                "node_id": item.nodo_id,
                "type": item.tipo,
                "severity": item.severidad,
                "parameter": item.parametro,
                "value": _to_float(item.valor_detectado),
                "message": item.mensaje,
                "timestamp": item.marca_tiempo.isoformat(),
                "read": bool(item.leida),
            }
        )

    reports_query = select(
        AIReport.id,
        AIReport.cliente_id,
        AIReport.area_riego_id,
        AIReport.rango_inicio,
        AIReport.rango_fin,
        AIReport.resumen,
        AIReport.recomendacion,
        AIReport.generado_en,
    ).where(AIReport.estado == "completed")

    if scope["client_id"] is not None:
        reports_query = reports_query.where(AIReport.cliente_id == scope["client_id"])
    if scope["irrigation_area_id"] is not None:
        reports_query = reports_query.where(
            AIReport.area_riego_id == scope["irrigation_area_id"]
        )

    report_rows = list(
        db.execute(
            reports_query.order_by(desc(AIReport.generado_en), desc(AIReport.id)).limit(5)
        )
    )
    recent_reports = [
        {
            "id": int(row[0]),
            "client_id": int(row[1]),
            "irrigation_area_id": row[2],
            "range_start": row[3].isoformat(),
            "range_end": row[4].isoformat(),
            "summary": (row[5] or "")[:300],
            "recommendation": (row[6] or "")[:300],
            "generated_at": row[7].isoformat() if row[7] is not None else None,
        }
        for row in report_rows
    ]

    return {
        "generated_at": now_utc.isoformat(),
        "current_user_role": current_user.rol,
        "timezone_reference": "UTC",
        "today_utc": now_utc.date().isoformat(),
        "yesterday_utc": (now_utc.date() - timedelta(days=1)).isoformat(),
        "scope": scope,
        "window": {
            "hours_back": hours_back,
            "start": window_start.isoformat(),
            "end": now_utc.isoformat(),
        },
        "summary": {
            "areas_count": len(areas),
            "stale_areas_20m": stale_areas_20m,
            "alerts": alert_summary,
            "reports_count": len(recent_reports),
        },
        "areas": areas,
        "recent_alerts": recent_alerts,
        "recent_reports": recent_reports,
    }


def _build_fallback_answer(
    *,
    question: str,
    context: dict[str, Any],
) -> str:
    summary = context.get("summary", {})
    stale = summary.get("stale_areas_20m", 0)
    alerts = summary.get("alerts", {})
    areas = context.get("areas", [])

    top_areas = []
    for item in areas[:3]:
        top_areas.append(
            (
                f"{item['area_name']} (H={item['latest']['soil_humidity']}, "
                f"F={item['latest']['flow_per_minute']}, ETO={item['latest']['eto']}, "
                f"frescura={item['freshness_minutes']}m)"
            )
        )
    top_text = "; ".join(top_areas) if top_areas else "Sin areas con telemetria"

    return (
        "No pude usar Azure OpenAI en este momento, pero te comparto contexto operativo:\n"
        f"1. Ventana analizada: {context['window']['hours_back']}h. "
        f"Alertas total={alerts.get('total', 0)} (criticas={alerts.get('critical', 0)}, "
        f"warning={alerts.get('warning', 0)}, no leidas={alerts.get('unread', 0)}).\n"
        f"2. Areas con posible inactividad (>=20 min sin dato): {stale}.\n"
        f"3. Estado rapido de areas: {top_text}.\n"
        "4. Recomendacion: prioriza revisar las areas con menor humedad, alto ETO y "
        "alertas criticas/inactividad; valida las siguientes 2-3 lecturas antes de ajustar riego."
    )


def _build_dynamic_widgets(
    *,
    question: str,
    context: dict[str, Any],
) -> list[dict[str, Any]]:
    _ = question
    widgets: list[dict[str, Any]] = []
    summary = context.get("summary", {})
    alerts = summary.get("alerts", {}) or {}
    areas: list[dict[str, Any]] = context.get("areas", []) or []
    hours_back = context.get("window", {}).get("hours_back", 72)

    # KPI cards
    widgets.append(
        {
            "type": "kpi_cards",
            "title": f"Resumen operativo ({hours_back}h)",
            "items": [
                {
                    "key": "areas_count",
                    "label": "Areas en alcance",
                    "value": summary.get("areas_count", 0),
                },
                {
                    "key": "stale_areas_20m",
                    "label": "Areas sin datos >=20 min",
                    "value": summary.get("stale_areas_20m", 0),
                },
                {
                    "key": "critical_alerts",
                    "label": "Alertas criticas",
                    "value": alerts.get("critical", 0),
                },
                {
                    "key": "unread_alerts",
                    "label": "Alertas no leidas",
                    "value": alerts.get("unread", 0),
                },
            ],
        }
    )

    # Ranking table by risk (staleness + low humidity)
    table_rows: list[dict[str, Any]] = []
    for area in areas:
        latest = area.get("latest", {}) or {}
        window_stats = area.get("window_stats", {}) or {}
        freshness = area.get("freshness_minutes")
        humidity = latest.get("soil_humidity")
        row = {
            "area": area.get("area_name"),
            "predio": area.get("property_name"),
            "humedad": humidity,
            "flujo": latest.get("flow_per_minute"),
            "eto": latest.get("eto"),
            "frescura_min": freshness,
            "lecturas": window_stats.get("readings_count", 0),
        }
        table_rows.append(row)

    def _risk_key(item: dict[str, Any]) -> tuple[int, float, float]:
        freshness = item.get("frescura_min")
        humidity = item.get("humedad")
        freshness_score = freshness if isinstance(freshness, (int, float)) else -1
        humidity_score = humidity if isinstance(humidity, (int, float)) else 9999.0
        no_data_penalty = 1 if humidity is None else 0
        return (int(freshness_score), -float(humidity_score), -no_data_penalty)

    ranked_rows = sorted(table_rows, key=_risk_key, reverse=True)[:10]
    if ranked_rows:
        widgets.append(
            {
                "type": "table",
                "title": "Areas priorizadas para revision",
                "columns": [
                    {"key": "area", "label": "Area"},
                    {"key": "predio", "label": "Predio"},
                    {"key": "humedad", "label": "Humedad (%)"},
                    {"key": "flujo", "label": "Flujo (L/min)"},
                    {"key": "eto", "label": "ETO"},
                    {"key": "frescura_min", "label": "Sin dato (min)"},
                    {"key": "lecturas", "label": "Lecturas"},
                ],
                "rows": ranked_rows,
            }
        )

    # Daily trend chart aggregated across areas
    daily_buckets: dict[str, dict[str, float]] = {}
    for area in areas:
        for stat in area.get("daily_stats", []) or []:
            day = stat.get("date")
            if not day:
                continue
            readings_count = stat.get("readings_count")
            weight = float(readings_count) if isinstance(readings_count, (int, float)) else 0.0
            if weight <= 0:
                continue

            bucket = daily_buckets.setdefault(
                day,
                {
                    "weight": 0.0,
                    "hum_sum": 0.0,
                    "flow_sum": 0.0,
                    "eto_sum": 0.0,
                    "hum_weight": 0.0,
                    "flow_weight": 0.0,
                    "eto_weight": 0.0,
                },
            )
            bucket["weight"] += weight

            hum = stat.get("soil_humidity_avg")
            if isinstance(hum, (int, float)):
                bucket["hum_sum"] += float(hum) * weight
                bucket["hum_weight"] += weight
            flow = stat.get("flow_avg")
            if isinstance(flow, (int, float)):
                bucket["flow_sum"] += float(flow) * weight
                bucket["flow_weight"] += weight
            eto = stat.get("eto_avg")
            if isinstance(eto, (int, float)):
                bucket["eto_sum"] += float(eto) * weight
                bucket["eto_weight"] += weight

    chart_data: list[dict[str, Any]] = []
    for day in sorted(daily_buckets.keys())[-7:]:
        bucket = daily_buckets[day]
        chart_data.append(
            {
                "date": day,
                "soil_humidity_avg": _round(
                    (bucket["hum_sum"] / bucket["hum_weight"]) if bucket["hum_weight"] > 0 else None,
                    digits=2,
                ),
                "flow_avg": _round(
                    (bucket["flow_sum"] / bucket["flow_weight"]) if bucket["flow_weight"] > 0 else None,
                    digits=2,
                ),
                "eto_avg": _round(
                    (bucket["eto_sum"] / bucket["eto_weight"]) if bucket["eto_weight"] > 0 else None,
                    digits=3,
                ),
            }
        )

    if len(chart_data) >= 2:
        widgets.append(
            {
                "type": "line_chart",
                "title": "Tendencia diaria (promedio ponderado por lecturas)",
                "x_key": "date",
                "series": [
                    {
                        "key": "soil_humidity_avg",
                        "label": "Humedad (%)",
                        "color": "var(--chart-4)",
                    },
                    {
                        "key": "flow_avg",
                        "label": "Flujo (L/min)",
                        "color": "var(--chart-1)",
                    },
                    {
                        "key": "eto_avg",
                        "label": "ETO",
                        "color": "var(--chart-3)",
                    },
                ],
                "data": chart_data,
            }
        )

    return widgets


def _call_azure_chat_completion(
    *,
    question: str,
    context_payload: dict[str, Any],
    history: list[dict[str, str]],
) -> tuple[str, dict[str, Any]]:
    endpoint = settings.AZURE_OPENAI_ENDPOINT.rstrip("/")
    url = (
        f"{endpoint}/openai/deployments/{settings.AZURE_OPENAI_DEPLOYMENT}"
        f"/chat/completions?api-version={settings.AZURE_OPENAI_API_VERSION}"
    )

    system_message = (
        "Eres el asistente operativo de una plataforma de riego IoT. "
        "Responde en espanol con tono tecnico claro y accionable. "
        "Usa SOLO el contexto JSON proporcionado. Si falta informacion, dilo de forma explicita. "
        "Prioriza humedad de suelo, flujo de riego, ETO, alertas y frescura de datos. "
        "Incluye cifras concretas cuando existan en el contexto. "
        "Si preguntan por hoy o ayer, usa daily_stats por fecha UTC cuando exista. "
        "Si la pregunta no pertenece al dominio de riego/sensores, rechaza y pide reformular al dominio."
    )

    messages: list[dict[str, str]] = [
        {"role": "system", "content": system_message},
        {
            "role": "user",
            "content": (
                "Contexto operativo JSON (fuente de verdad para responder):\n"
                f"{json.dumps(context_payload, ensure_ascii=True, default=str)}"
            ),
        },
    ]
    messages.extend(history)
    messages.append({"role": "user", "content": question})

    body = {
        "messages": messages,
        "temperature": settings.AZURE_OPENAI_TEMPERATURE,
        "max_tokens": min(settings.AZURE_OPENAI_MAX_TOKENS, 700),
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
        answer = str(data["choices"][0]["message"]["content"]).strip()
        if not answer:
            raise ValueError("empty answer")
    except Exception as exc:
        raise RuntimeError(f"Invalid Azure OpenAI response payload: {exc}") from exc

    usage = data.get("usage", {})
    metadata: dict[str, Any] = {
        "provider": "azure-openai",
        "model": data.get("model"),
        "tokens_prompt": usage.get("prompt_tokens"),
        "tokens_completion": usage.get("completion_tokens"),
    }
    return answer, metadata


def ask_ai_assistant(
    db: Session,
    *,
    current_user: User,
    message: str,
    history: list[dict[str, str]],
    hours_back: int,
    client_id: int | None,
    irrigation_area_id: int | None,
) -> dict[str, Any]:
    normalized_history = [
        {
            "role": item["role"],
            "content": item["content"].strip(),
        }
        for item in history[-settings.AI_ASSISTANT_MAX_HISTORY_MESSAGES :]
        if item["role"] in ("user", "assistant") and item["content"].strip()
    ]

    scope = _resolve_scope(
        db,
        current_user=current_user,
        client_id=client_id,
        irrigation_area_id=irrigation_area_id,
    )

    generated_at = _utc_now_naive()
    if not _is_in_scope_question(message, normalized_history):
        return {
            "answer": _build_out_of_scope_answer(),
            "source": "fallback",
            "generated_at": generated_at,
            "metadata": {
                "provider": "rules-guardrail",
                "scope": scope,
                "hours_back": hours_back,
                "reason": "out_of_scope_question",
            },
            "widgets": [],
        }

    context = _collect_chat_context(
        db,
        current_user=current_user,
        scope=scope,
        hours_back=hours_back,
    )
    widgets = _build_dynamic_widgets(question=message, context=context)

    if _azure_openai_enabled():
        try:
            answer, metadata = _call_azure_chat_completion(
                question=message,
                context_payload=context,
                history=normalized_history,
            )
            metadata["scope"] = scope
            metadata["hours_back"] = hours_back
            metadata["context_counts"] = context.get("summary", {})
            return {
                "answer": answer,
                "source": "ai",
                "generated_at": generated_at,
                "metadata": metadata,
                "widgets": widgets,
            }
        except Exception as exc:
            answer = _build_fallback_answer(question=message, context=context)
            return {
                "answer": answer,
                "source": "fallback",
                "generated_at": generated_at,
                "metadata": {
                    "provider": "rules-fallback",
                    "error_detail": str(exc)[:1200],
                    "scope": scope,
                    "hours_back": hours_back,
                    "context_counts": context.get("summary", {}),
                },
                "widgets": widgets,
            }

    answer = _build_fallback_answer(question=message, context=context)
    return {
        "answer": answer,
        "source": "fallback",
        "generated_at": generated_at,
        "metadata": {
            "provider": "rules-fallback",
            "scope": scope,
            "hours_back": hours_back,
            "context_counts": context.get("summary", {}),
            "reason": "azure_openai_disabled",
        },
        "widgets": widgets,
    }
