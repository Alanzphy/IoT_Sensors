from datetime import UTC, date, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.node import Node
from app.models.reading import Reading


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
