from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.irrigation_area import IrrigationArea
from app.models.threshold import Threshold
from app.schemas.threshold import ThresholdCreate, ThresholdUpdate


def _validate_irrigation_area_exists(db: Session, irrigation_area_id: int) -> None:
    area = db.execute(
        select(IrrigationArea.id).where(
            IrrigationArea.id == irrigation_area_id,
            IrrigationArea.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if area is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Irrigation area with id {irrigation_area_id} not found",
        )


def _exists_duplicate_threshold(
    db: Session,
    irrigation_area_id: int,
    parameter: str,
    exclude_id: int | None = None,
) -> bool:
    query = select(Threshold.id).where(
        Threshold.area_riego_id == irrigation_area_id,
        Threshold.parametro == parameter,
        Threshold.eliminado_en.is_(None),
    )
    if exclude_id is not None:
        query = query.where(Threshold.id != exclude_id)
    duplicate = db.execute(query.limit(1)).scalar_one_or_none()
    return duplicate is not None


def get_threshold(db: Session, threshold_id: int) -> Threshold:
    threshold = db.execute(
        select(Threshold).where(
            Threshold.id == threshold_id,
            Threshold.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if threshold is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Threshold with id {threshold_id} not found",
        )
    return threshold


def list_thresholds(
    db: Session,
    page: int,
    per_page: int,
    irrigation_area_id: int | None = None,
    parameter: str | None = None,
    active: bool | None = None,
    allowed_area_ids: list[int] | None = None,
) -> tuple[list[Threshold], int]:
    conditions = [Threshold.eliminado_en.is_(None)]

    if allowed_area_ids is not None:
        if len(allowed_area_ids) == 0:
            return [], 0
        conditions.append(Threshold.area_riego_id.in_(allowed_area_ids))

    if irrigation_area_id is not None:
        conditions.append(Threshold.area_riego_id == irrigation_area_id)
    if parameter is not None:
        conditions.append(Threshold.parametro == parameter)
    if active is not None:
        conditions.append(Threshold.activo.is_(active))

    total = (
        db.execute(
            select(func.count()).select_from(Threshold).where(*conditions)
        ).scalar()
        or 0
    )

    items = list(
        db.execute(
            select(Threshold)
            .where(*conditions)
            .order_by(Threshold.id)
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).scalars()
    )
    return items, total


def create_threshold(db: Session, data: ThresholdCreate) -> Threshold:
    _validate_irrigation_area_exists(db, data.irrigation_area_id)

    parameter = data.parameter.strip()
    if _exists_duplicate_threshold(db, data.irrigation_area_id, parameter):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A threshold for this area and parameter already exists",
        )

    threshold = Threshold(
        area_riego_id=data.irrigation_area_id,
        parametro=parameter,
        rango_min=data.min_value,
        rango_max=data.max_value,
        severidad=data.severity,
        activo=data.active,
    )
    db.add(threshold)
    db.commit()
    db.refresh(threshold)
    return threshold


def update_threshold(
    db: Session, threshold_id: int, data: ThresholdUpdate
) -> Threshold:
    threshold = get_threshold(db, threshold_id)
    payload = data.model_dump(exclude_unset=True)

    target_irrigation_area_id = payload.get(
        "irrigation_area_id", threshold.area_riego_id
    )
    target_parameter = payload.get("parameter", threshold.parametro)
    if isinstance(target_parameter, str):
        target_parameter = target_parameter.strip()

    if "irrigation_area_id" in payload:
        _validate_irrigation_area_exists(db, target_irrigation_area_id)

    if _exists_duplicate_threshold(
        db,
        target_irrigation_area_id,
        target_parameter,
        exclude_id=threshold.id,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A threshold for this area and parameter already exists",
        )

    if "irrigation_area_id" in payload:
        threshold.area_riego_id = target_irrigation_area_id
    if "parameter" in payload:
        threshold.parametro = target_parameter
    if "min_value" in payload:
        threshold.rango_min = payload["min_value"]
    if "max_value" in payload:
        threshold.rango_max = payload["max_value"]
    if "severity" in payload:
        threshold.severidad = payload["severity"]
    if "active" in payload:
        threshold.activo = payload["active"]

    db.commit()
    db.refresh(threshold)
    return threshold


def soft_delete_threshold(db: Session, threshold_id: int) -> Threshold:
    threshold = get_threshold(db, threshold_id)
    threshold.activo = False
    threshold.eliminado_en = func.now()
    db.commit()
    db.refresh(threshold)
    return threshold
