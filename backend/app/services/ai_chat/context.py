from datetime import timedelta
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import and_, desc, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.time import utc_now
from app.models.ai_report import AIReport
from app.models.alert import Alert
from app.models.client import Client
from app.models.crop_type import CropType
from app.models.irrigation_area import IrrigationArea
from app.models.node import Node
from app.models.property import Property
from app.models.reading import Reading
from app.models.user import User
from app.services.ai_chat.helpers import _to_bool, _to_float, _round


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
    now_utc = utc_now()
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
