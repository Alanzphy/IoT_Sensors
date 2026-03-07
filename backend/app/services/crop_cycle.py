from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.crop_cycle import CropCycle
from app.models.irrigation_area import IrrigationArea
from app.schemas.crop_cycle import CropCycleCreate, CropCycleUpdate


def get_crop_cycle(db: Session, cycle_id: int) -> CropCycle:
    cycle = db.execute(
        select(CropCycle).where(
            CropCycle.id == cycle_id, CropCycle.eliminado_en.is_(None)
        )
    ).scalar_one_or_none()
    if cycle is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crop cycle with id {cycle_id} not found",
        )
    return cycle


def list_crop_cycles(
    db: Session,
    page: int,
    per_page: int,
    irrigation_area_id: int | None = None,
) -> tuple[list[CropCycle], int]:
    query = select(CropCycle).where(CropCycle.eliminado_en.is_(None))
    count_query = (
        select(func.count())
        .select_from(CropCycle)
        .where(CropCycle.eliminado_en.is_(None))
    )
    if irrigation_area_id is not None:
        query = query.where(CropCycle.area_riego_id == irrigation_area_id)
        count_query = count_query.where(CropCycle.area_riego_id == irrigation_area_id)

    total = db.execute(count_query).scalar() or 0
    items = list(
        db.execute(
            query.order_by(CropCycle.fecha_inicio.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).scalars()
    )
    return items, total


def create_crop_cycle(db: Session, data: CropCycleCreate) -> CropCycle:
    # Validate irrigation area exists
    area = db.execute(
        select(IrrigationArea).where(
            IrrigationArea.id == data.irrigation_area_id,
            IrrigationArea.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if area is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Irrigation area with id {data.irrigation_area_id} not found",
        )

    # Check no active cycle exists (end_date IS NULL)
    if data.end_date is None:
        active_cycle = db.execute(
            select(CropCycle).where(
                CropCycle.area_riego_id == data.irrigation_area_id,
                CropCycle.fecha_fin.is_(None),
                CropCycle.eliminado_en.is_(None),
            )
        ).scalar_one_or_none()
        if active_cycle:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An active crop cycle already exists for this area. "
                "Close the current cycle before creating a new one.",
            )

    cycle = CropCycle(
        area_riego_id=data.irrigation_area_id,
        fecha_inicio=data.start_date,
        fecha_fin=data.end_date,
    )
    db.add(cycle)
    db.commit()
    db.refresh(cycle)
    return cycle


def update_crop_cycle(db: Session, cycle_id: int, data: CropCycleUpdate) -> CropCycle:
    cycle = get_crop_cycle(db, cycle_id)
    update_data = data.model_dump(exclude_unset=True)

    if "start_date" in update_data:
        cycle.fecha_inicio = update_data["start_date"]
    if "end_date" in update_data:
        cycle.fecha_fin = update_data["end_date"]

    db.commit()
    db.refresh(cycle)
    return cycle


def soft_delete_crop_cycle(db: Session, cycle_id: int) -> CropCycle:
    cycle = get_crop_cycle(db, cycle_id)
    cycle.eliminado_en = func.now()
    db.commit()
    db.refresh(cycle)
    return cycle
