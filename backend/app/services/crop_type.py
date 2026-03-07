from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.crop_type import CropType
from app.models.irrigation_area import IrrigationArea
from app.schemas.crop_type import CropTypeCreate, CropTypeUpdate


def get_crop_type(db: Session, crop_type_id: int) -> CropType:
    ct = db.execute(
        select(CropType).where(
            CropType.id == crop_type_id, CropType.eliminado_en.is_(None)
        )
    ).scalar_one_or_none()
    if ct is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crop type with id {crop_type_id} not found",
        )
    return ct


def list_crop_types(
    db: Session, page: int, per_page: int
) -> tuple[list[CropType], int]:
    query = select(CropType).where(CropType.eliminado_en.is_(None))
    count_query = (
        select(func.count())
        .select_from(CropType)
        .where(CropType.eliminado_en.is_(None))
    )
    total = db.execute(count_query).scalar() or 0
    items = list(
        db.execute(
            query.order_by(CropType.id).offset((page - 1) * per_page).limit(per_page)
        ).scalars()
    )
    return items, total


def create_crop_type(db: Session, data: CropTypeCreate) -> CropType:
    existing = db.execute(
        select(CropType).where(
            CropType.nombre == data.name, CropType.eliminado_en.is_(None)
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Crop type '{data.name}' already exists",
        )

    ct = CropType(nombre=data.name, descripcion=data.description)
    db.add(ct)
    db.commit()
    db.refresh(ct)
    return ct


def update_crop_type(db: Session, crop_type_id: int, data: CropTypeUpdate) -> CropType:
    ct = get_crop_type(db, crop_type_id)
    update_data = data.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] != ct.nombre:
        existing = db.execute(
            select(CropType).where(
                CropType.nombre == update_data["name"],
                CropType.id != crop_type_id,
                CropType.eliminado_en.is_(None),
            )
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Crop type '{update_data['name']}' already exists",
            )
        ct.nombre = update_data["name"]

    if "description" in update_data:
        ct.descripcion = update_data["description"]

    db.commit()
    db.refresh(ct)
    return ct


def soft_delete_crop_type(db: Session, crop_type_id: int) -> CropType:
    ct = get_crop_type(db, crop_type_id)

    # Check for active irrigation areas using this crop type
    active_area = db.execute(
        select(IrrigationArea).where(
            IrrigationArea.tipo_cultivo_id == crop_type_id,
            IrrigationArea.eliminado_en.is_(None),
        )
    ).first()
    if active_area:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete crop type: it has active irrigation areas",
        )

    ct.eliminado_en = func.now()
    db.commit()
    db.refresh(ct)
    return ct
