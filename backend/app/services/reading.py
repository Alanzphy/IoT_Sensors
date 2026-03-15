import csv
import io
from datetime import date, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.crop_cycle import CropCycle
from app.models.node import Node
from app.models.reading import Reading
from app.schemas.reading import ReadingCreate


def create_reading(db: Session, node: Node, data: ReadingCreate) -> Reading:
    """Insert reading in a single table."""
    reading = Reading(
        nodo_id=node.id,
        marca_tiempo=data.timestamp,
        suelo_conductividad=data.soil.conductivity,
        suelo_temperatura=data.soil.temperature,
        suelo_humedad=data.soil.humidity,
        suelo_potencial_hidrico=data.soil.water_potential,
        riego_activo=data.irrigation.active,
        riego_litros_acumulados=data.irrigation.accumulated_liters,
        riego_flujo_por_minuto=data.irrigation.flow_per_minute,
        ambiental_temperatura=data.environmental.temperature,
        ambiental_humedad_relativa=data.environmental.relative_humidity,
        ambiental_velocidad_viento=data.environmental.wind_speed,
        ambiental_radiacion_solar=data.environmental.solar_radiation,
        ambiental_eto=data.environmental.eto,
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)
    return reading


def get_latest_reading(db: Session, irrigation_area_id: int) -> Reading | None:
    """Get the most recent reading for an irrigation area's node."""
    node = db.execute(
        select(Node).where(
            Node.area_riego_id == irrigation_area_id,
            Node.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if node is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No node found for irrigation area {irrigation_area_id}",
        )

    reading = db.execute(
        select(Reading)
        .where(Reading.nodo_id == node.id)
        .order_by(Reading.marca_tiempo.desc())
        .limit(1)
    ).scalar_one_or_none()
    return reading


def _build_history_query(
    irrigation_area_id: int | None,
    node_ids: list[int] | None,
    start_date: date | None,
    end_date: date | None,
    crop_cycle_id: int | None,
    db: Session,
):
    """Build WHERE conditions for history/export queries."""
    conditions = []

    if node_ids is not None:
        conditions.append(Reading.nodo_id.in_(node_ids))
    elif irrigation_area_id is not None:
        node = db.execute(
            select(Node.id).where(
                Node.area_riego_id == irrigation_area_id,
                Node.eliminado_en.is_(None),
            )
        ).scalar_one_or_none()
        if node is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No node found for irrigation area {irrigation_area_id}",
            )
        conditions.append(Reading.nodo_id == node)

    # If crop_cycle_id is specified, use its dates
    if crop_cycle_id is not None:
        cycle = db.execute(
            select(CropCycle).where(
                CropCycle.id == crop_cycle_id,
                CropCycle.eliminado_en.is_(None),
            )
        ).scalar_one_or_none()
        if cycle is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Crop cycle with id {crop_cycle_id} not found",
            )
        conditions.append(
            Reading.marca_tiempo
            >= datetime.combine(cycle.fecha_inicio, datetime.min.time())
        )
        if cycle.fecha_fin is not None:
            conditions.append(
                Reading.marca_tiempo
                <= datetime.combine(cycle.fecha_fin, datetime.max.time())
            )
    else:
        if start_date is not None:
            conditions.append(
                Reading.marca_tiempo
                >= datetime.combine(start_date, datetime.min.time())
            )
        if end_date is not None:
            conditions.append(
                Reading.marca_tiempo <= datetime.combine(end_date, datetime.max.time())
            )

    return conditions


def list_readings(
    db: Session,
    page: int,
    per_page: int,
    irrigation_area_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    crop_cycle_id: int | None = None,
) -> tuple[list[Reading], int]:
    conditions = _build_history_query(
        irrigation_area_id, None, start_date, end_date, crop_cycle_id, db
    )

    count_query = select(func.count()).select_from(Reading).where(*conditions)
    total = db.execute(count_query).scalar() or 0

    query = (
        select(Reading)
        .where(*conditions)
        .order_by(Reading.marca_tiempo.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    items = list(db.execute(query).scalars())
    return items, total


def export_readings_csv(
    db: Session,
    irrigation_area_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    crop_cycle_id: int | None = None,
) -> str:
    """Export readings matching filters as CSV string."""
    conditions = _build_history_query(
        irrigation_area_id, None, start_date, end_date, crop_cycle_id, db
    )
    readings = list(
        db.execute(
            select(Reading).where(*conditions).order_by(Reading.marca_tiempo.asc())
        ).scalars()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "timestamp",
            "node_id",
            "soil_conductivity",
            "soil_temperature",
            "soil_humidity",
            "soil_water_potential",
            "irrigation_active",
            "irrigation_accumulated_liters",
            "irrigation_flow_per_minute",
            "env_temperature",
            "env_relative_humidity",
            "env_wind_speed",
            "env_solar_radiation",
            "env_eto",
        ]
    )
    for r in readings:
        writer.writerow(
            [
                r.marca_tiempo.isoformat(),
                r.nodo_id,
                r.suelo_conductividad,
                r.suelo_temperatura,
                r.suelo_humedad,
                r.suelo_potencial_hidrico,
                r.riego_activo,
                r.riego_litros_acumulados,
                r.riego_flujo_por_minuto,
                r.ambiental_temperatura,
                r.ambiental_humedad_relativa,
                r.ambiental_velocidad_viento,
                r.ambiental_radiacion_solar,
                r.ambiental_eto,
            ]
        )
    return output.getvalue()


def export_readings_xlsx(
    db: Session,
    irrigation_area_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    crop_cycle_id: int | None = None,
) -> bytes:
    """Export readings as XLSX bytes. Requires openpyxl."""
    from openpyxl import Workbook

    conditions = _build_history_query(
        irrigation_area_id, None, start_date, end_date, crop_cycle_id, db
    )
    readings = list(
        db.execute(
            select(Reading).where(*conditions).order_by(Reading.marca_tiempo.asc())
        ).scalars()
    )

    wb = Workbook()
    ws = wb.active
    ws.title = "Readings"
    headers = [
        "timestamp",
        "node_id",
        "soil_conductivity",
        "soil_temperature",
        "soil_humidity",
        "soil_water_potential",
        "irrigation_active",
        "irrigation_accumulated_liters",
        "irrigation_flow_per_minute",
        "env_temperature",
        "env_relative_humidity",
        "env_wind_speed",
        "env_solar_radiation",
        "env_eto",
    ]
    ws.append(headers)
    for r in readings:
        ws.append(
            [
                r.marca_tiempo.isoformat(),
                r.nodo_id,
                (
                    float(r.suelo_conductividad)
                    if r.suelo_conductividad is not None
                    else None
                ),
                float(r.suelo_temperatura) if r.suelo_temperatura is not None else None,
                float(r.suelo_humedad) if r.suelo_humedad is not None else None,
                (
                    float(r.suelo_potencial_hidrico)
                    if r.suelo_potencial_hidrico is not None
                    else None
                ),
                r.riego_activo,
                (
                    float(r.riego_litros_acumulados)
                    if r.riego_litros_acumulados is not None
                    else None
                ),
                (
                    float(r.riego_flujo_por_minuto)
                    if r.riego_flujo_por_minuto is not None
                    else None
                ),
                (
                    float(r.ambiental_temperatura)
                    if r.ambiental_temperatura is not None
                    else None
                ),
                (
                    float(r.ambiental_humedad_relativa)
                    if r.ambiental_humedad_relativa is not None
                    else None
                ),
                (
                    float(r.ambiental_velocidad_viento)
                    if r.ambiental_velocidad_viento is not None
                    else None
                ),
                (
                    float(r.ambiental_radiacion_solar)
                    if r.ambiental_radiacion_solar is not None
                    else None
                ),
                float(r.ambiental_eto) if r.ambiental_eto is not None else None,
            ]
        )

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def export_readings_pdf(
    db: Session,
    irrigation_area_id: int | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    crop_cycle_id: int | None = None,
) -> bytes:
    """Export readings as PDF bytes. Requires reportlab."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import landscape, letter
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle

    conditions = _build_history_query(
        irrigation_area_id, None, start_date, end_date, crop_cycle_id, db
    )
    readings = list(
        db.execute(
            select(Reading).where(*conditions).order_by(Reading.marca_tiempo.asc())
        ).scalars()
    )

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(letter))
    headers = [
        "Timestamp",
        "Node",
        "Cond.",
        "Temp.S",
        "Hum.S",
        "W.Pot",
        "Active",
        "Liters",
        "Flow",
        "Temp.E",
        "RH%",
        "Wind",
        "Solar",
        "ETo",
    ]
    table_data = [headers]
    for r in readings:
        table_data.append(
            [
                r.marca_tiempo.strftime("%Y-%m-%d %H:%M"),
                r.nodo_id,
                r.suelo_conductividad if r.suelo_conductividad is not None else "",
                r.suelo_temperatura if r.suelo_temperatura is not None else "",
                r.suelo_humedad if r.suelo_humedad is not None else "",
                r.suelo_potencial_hidrico if r.suelo_potencial_hidrico is not None else "",
                "On" if r.riego_activo else "Off",
                r.riego_litros_acumulados if r.riego_litros_acumulados is not None else "",
                r.riego_flujo_por_minuto if r.riego_flujo_por_minuto is not None else "",
                r.ambiental_temperatura if r.ambiental_temperatura is not None else "",
                r.ambiental_humedad_relativa if r.ambiental_humedad_relativa is not None else "",
                r.ambiental_velocidad_viento if r.ambiental_velocidad_viento is not None else "",
                r.ambiental_radiacion_solar if r.ambiental_radiacion_solar is not None else "",
                r.ambiental_eto if r.ambiental_eto is not None else "",
            ]
        )

    table = Table(table_data)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    doc.build([table])
    return buf.getvalue()
