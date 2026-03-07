import csv
import io
from datetime import date, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.crop_cycle import CropCycle
from app.models.node import Node
from app.models.reading import Reading
from app.models.reading_environmental import ReadingEnvironmental
from app.models.reading_irrigation import ReadingIrrigation
from app.models.reading_soil import ReadingSoil
from app.schemas.reading import ReadingCreate


def create_reading(db: Session, node: Node, data: ReadingCreate) -> Reading:
    """Insert reading + 3 sub-tables in a single atomic transaction."""
    reading = Reading(
        nodo_id=node.id,
        marca_tiempo=data.timestamp,
    )
    db.add(reading)
    db.flush()  # Get the reading.id

    soil = ReadingSoil(
        lectura_id=reading.id,
        conductividad=data.soil.conductivity,
        temperatura=data.soil.temperature,
        humedad=data.soil.humidity,
        potencial_hidrico=data.soil.water_potential,
    )
    irrigation = ReadingIrrigation(
        lectura_id=reading.id,
        activo=data.irrigation.active,
        litros_acumulados=data.irrigation.accumulated_liters,
        flujo_por_minuto=data.irrigation.flow_per_minute,
    )
    environmental = ReadingEnvironmental(
        lectura_id=reading.id,
        temperatura=data.environmental.temperature,
        humedad_relativa=data.environmental.relative_humidity,
        velocidad_viento=data.environmental.wind_speed,
        radiacion_solar=data.environmental.solar_radiation,
        eto=data.environmental.eto,
    )
    db.add_all([soil, irrigation, environmental])
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
        .options(
            joinedload(Reading.soil),
            joinedload(Reading.irrigation),
            joinedload(Reading.environmental),
        )
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
        .options(
            joinedload(Reading.soil),
            joinedload(Reading.irrigation),
            joinedload(Reading.environmental),
        )
        .where(*conditions)
        .order_by(Reading.marca_tiempo.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    items = list(db.execute(query).unique().scalars())
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
            select(Reading)
            .options(
                joinedload(Reading.soil),
                joinedload(Reading.irrigation),
                joinedload(Reading.environmental),
            )
            .where(*conditions)
            .order_by(Reading.marca_tiempo.asc())
        )
        .unique()
        .scalars()
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
        s = r.soil
        irr = r.irrigation
        e = r.environmental
        writer.writerow(
            [
                r.marca_tiempo.isoformat(),
                r.nodo_id,
                s.conductividad if s else None,
                s.temperatura if s else None,
                s.humedad if s else None,
                s.potencial_hidrico if s else None,
                irr.activo if irr else None,
                irr.litros_acumulados if irr else None,
                irr.flujo_por_minuto if irr else None,
                e.temperatura if e else None,
                e.humedad_relativa if e else None,
                e.velocidad_viento if e else None,
                e.radiacion_solar if e else None,
                e.eto if e else None,
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
            select(Reading)
            .options(
                joinedload(Reading.soil),
                joinedload(Reading.irrigation),
                joinedload(Reading.environmental),
            )
            .where(*conditions)
            .order_by(Reading.marca_tiempo.asc())
        )
        .unique()
        .scalars()
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
        s = r.soil
        irr = r.irrigation
        e = r.environmental
        ws.append(
            [
                r.marca_tiempo.isoformat(),
                r.nodo_id,
                float(s.conductividad) if s and s.conductividad is not None else None,
                float(s.temperatura) if s and s.temperatura is not None else None,
                float(s.humedad) if s and s.humedad is not None else None,
                (
                    float(s.potencial_hidrico)
                    if s and s.potencial_hidrico is not None
                    else None
                ),
                irr.activo if irr else None,
                (
                    float(irr.litros_acumulados)
                    if irr and irr.litros_acumulados is not None
                    else None
                ),
                (
                    float(irr.flujo_por_minuto)
                    if irr and irr.flujo_por_minuto is not None
                    else None
                ),
                float(e.temperatura) if e and e.temperatura is not None else None,
                (
                    float(e.humedad_relativa)
                    if e and e.humedad_relativa is not None
                    else None
                ),
                (
                    float(e.velocidad_viento)
                    if e and e.velocidad_viento is not None
                    else None
                ),
                (
                    float(e.radiacion_solar)
                    if e and e.radiacion_solar is not None
                    else None
                ),
                float(e.eto) if e and e.eto is not None else None,
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
            select(Reading)
            .options(
                joinedload(Reading.soil),
                joinedload(Reading.irrigation),
                joinedload(Reading.environmental),
            )
            .where(*conditions)
            .order_by(Reading.marca_tiempo.asc())
        )
        .unique()
        .scalars()
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
        s = r.soil
        irr = r.irrigation
        e = r.environmental
        table_data.append(
            [
                r.marca_tiempo.strftime("%Y-%m-%d %H:%M"),
                r.nodo_id,
                s.conductividad if s else "",
                s.temperatura if s else "",
                s.humedad if s else "",
                s.potencial_hidrico if s else "",
                "On" if (irr and irr.activo) else "Off" if irr else "",
                irr.litros_acumulados if irr else "",
                irr.flujo_por_minuto if irr else "",
                e.temperatura if e else "",
                e.humedad_relativa if e else "",
                e.velocidad_viento if e else "",
                e.radiacion_solar if e else "",
                e.eto if e else "",
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
