import json
from datetime import datetime
from urllib import error, request

from sqlalchemy import desc, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.time import utc_now
from app.models.alert import Alert
from app.models.crop_cycle import CropCycle
from app.models.crop_type import CropType
from app.models.irrigation_area import IrrigationArea
from app.models.node import Node
from app.models.property import Property
from app.models.reading import Reading
from app.models.threshold import Threshold

from app.services.alerts.queries import get_alert


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
    today = utc_now().date()
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
            utc_now() - last_timestamp
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

    generated_at = utc_now()
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
