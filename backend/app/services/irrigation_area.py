from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.crop_type import CropType
from app.models.irrigation_area import IrrigationArea
from app.models.property import Property
from app.schemas.irrigation_area import IrrigationAreaCreate, IrrigationAreaUpdate


def get_irrigation_area(db: Session, area_id: int) -> IrrigationArea:
    area = db.execute(
        select(IrrigationArea)
        .options(joinedload(IrrigationArea.crop_type))
        .where(IrrigationArea.id == area_id, IrrigationArea.eliminado_en.is_(None))
    ).scalar_one_or_none()
    if area is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Irrigation area with id {area_id} not found",
        )
    return area


def list_irrigation_areas(
    db: Session,
    page: int,
    per_page: int,
    property_id: int | None = None,
) -> tuple[list[IrrigationArea], int]:
    query = (
        select(IrrigationArea)
        .options(joinedload(IrrigationArea.crop_type))
        .where(IrrigationArea.eliminado_en.is_(None))
    )
    count_query = (
        select(func.count())
        .select_from(IrrigationArea)
        .where(IrrigationArea.eliminado_en.is_(None))
    )
    if property_id is not None:
        query = query.where(IrrigationArea.predio_id == property_id)
        count_query = count_query.where(IrrigationArea.predio_id == property_id)

    total = db.execute(count_query).scalar() or 0
    items = list(
        db.execute(
            query.order_by(IrrigationArea.id)
            .offset((page - 1) * per_page)
            .limit(per_page)
        )
        .unique()
        .scalars()
    )
    return items, total


def create_irrigation_area(db: Session, data: IrrigationAreaCreate) -> IrrigationArea:
    # Validate property exists
    prop = db.execute(
        select(Property).where(
            Property.id == data.property_id, Property.eliminado_en.is_(None)
        )
    ).scalar_one_or_none()
    if prop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Property with id {data.property_id} not found",
        )

    # Validate crop type exists
    ct = db.execute(
        select(CropType).where(
            CropType.id == data.crop_type_id, CropType.eliminado_en.is_(None)
        )
    ).scalar_one_or_none()
    if ct is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crop type with id {data.crop_type_id} not found",
        )

    area = IrrigationArea(
        predio_id=data.property_id,
        tipo_cultivo_id=data.crop_type_id,
        nombre=data.name,
        tamano_area=data.area_size,
    )
    db.add(area)
    db.commit()
    db.refresh(area)
    # Load crop_type relationship
    _ = area.crop_type
    return area


def update_irrigation_area(
    db: Session, area_id: int, data: IrrigationAreaUpdate
) -> IrrigationArea:
    area = get_irrigation_area(db, area_id)
    update_data = data.model_dump(exclude_unset=True)

    if "crop_type_id" in update_data:
        ct = db.execute(
            select(CropType).where(
                CropType.id == update_data["crop_type_id"],
                CropType.eliminado_en.is_(None),
            )
        ).scalar_one_or_none()
        if ct is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Crop type with id {update_data['crop_type_id']} not found",
            )
        area.tipo_cultivo_id = update_data["crop_type_id"]

    if "name" in update_data:
        area.nombre = update_data["name"]
    if "area_size" in update_data:
        area.tamano_area = update_data["area_size"]

    db.commit()
    db.refresh(area)
    return area


def soft_delete_irrigation_area(db: Session, area_id: int) -> IrrigationArea:
    area = get_irrigation_area(db, area_id)
    area.eliminado_en = func.now()
    db.commit()
    db.refresh(area)
    return area
