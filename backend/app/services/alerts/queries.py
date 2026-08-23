from datetime import date, datetime

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.time import utc_now
from app.models.alert import Alert


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
def _build_alert_conditions(
    *,
    irrigation_area_id: int | None = None,
    node_id: int | None = None,
    severity: str | None = None,
    read: bool | None = None,
    alert_type: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    allowed_area_ids: list[int] | None = None,
    only_unread: bool = False,
) -> list:
    conditions = []

    if allowed_area_ids is not None:
        if not allowed_area_ids:
            return [Alert.id == -1]
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
    if only_unread:
        conditions.append(Alert.leida.is_(False))

    return conditions
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
    conditions = _build_alert_conditions(
        irrigation_area_id=irrigation_area_id,
        node_id=node_id,
        severity=severity,
        read=read,
        alert_type=alert_type,
        start_date=start_date,
        end_date=end_date,
        allowed_area_ids=allowed_area_ids,
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
    conditions = _build_alert_conditions(
        irrigation_area_id=irrigation_area_id,
        node_id=node_id,
        severity=severity,
        alert_type=alert_type,
        start_date=start_date,
        end_date=end_date,
        allowed_area_ids=allowed_area_ids,
        only_unread=True,
    )

    return (
        db.execute(select(func.count()).select_from(Alert).where(*conditions)).scalar()
        or 0
    )
def mark_alert_read(db: Session, alert_id: int, read: bool = True) -> Alert:
    alert = get_alert(db, alert_id)
    alert.leida = read
    alert.leida_en = utc_now() if read else None
    db.commit()
    db.refresh(alert)
    return alert
def mark_alerts_read_bulk(
    db: Session,
    *,
    irrigation_area_id: int | None = None,
    node_id: int | None = None,
    severity: str | None = None,
    alert_type: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    allowed_area_ids: list[int] | None = None,
) -> int:
    conditions = _build_alert_conditions(
        irrigation_area_id=irrigation_area_id,
        node_id=node_id,
        severity=severity,
        alert_type=alert_type,
        start_date=start_date,
        end_date=end_date,
        allowed_area_ids=allowed_area_ids,
        only_unread=True,
    )
    alerts = list(
        db.execute(
            select(Alert)
            .where(*conditions)
            .order_by(Alert.marca_tiempo.desc(), Alert.id.desc())
        ).scalars()
    )
    if not alerts:
        return 0

    read_at = utc_now()
    for item in alerts:
        item.leida = True
        item.leida_en = read_at

    db.commit()
    return len(alerts)
