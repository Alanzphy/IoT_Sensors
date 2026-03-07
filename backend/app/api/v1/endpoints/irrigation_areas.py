from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.client import Client
from app.models.property import Property
from app.models.user import User
from app.schemas.base import PaginatedResponse
from app.schemas.irrigation_area import (
    IrrigationAreaCreate,
    IrrigationAreaResponse,
    IrrigationAreaUpdate,
)
from app.services import irrigation_area as ia_service

router = APIRouter()


def _get_client_property_ids(user: User, db: Session) -> list[int]:
    """Return property IDs owned by a client user."""
    client = db.execute(
        select(Client).where(
            Client.usuario_id == user.id, Client.eliminado_en.is_(None)
        )
    ).scalar_one_or_none()
    if client is None:
        return []
    props = list(
        db.execute(
            select(Property.id).where(
                Property.cliente_id == client.id,
                Property.eliminado_en.is_(None),
            )
        ).scalars()
    )
    return props


def _check_area_ownership(user: User, db: Session, area_id: int) -> None:
    """Ensure a client user owns the irrigation area's property."""
    if user.rol == "admin":
        return
    area = ia_service.get_irrigation_area(db, area_id)
    prop_ids = _get_client_property_ids(user, db)
    if area.predio_id not in prop_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this irrigation area",
        )


@router.get("", response_model=PaginatedResponse[IrrigationAreaResponse])
def list_irrigation_areas(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    property_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Client: if no property_id filter, we need to restrict to their properties
    if current_user.rol != "admin" and property_id is None:
        prop_ids = _get_client_property_ids(current_user, db)
        # Fetch all areas for client's properties
        all_items = []
        total = 0
        for pid in prop_ids:
            items, cnt = ia_service.list_irrigation_areas(db, 1, 10000, pid)
            all_items.extend(items)
            total += cnt
        # Manual pagination
        start = (page - 1) * per_page
        paged = all_items[start : start + per_page]
        return PaginatedResponse(
            page=page,
            per_page=per_page,
            total=total,
            data=[IrrigationAreaResponse.model_validate(a) for a in paged],
        )

    if current_user.rol != "admin" and property_id is not None:
        prop_ids = _get_client_property_ids(current_user, db)
        if property_id not in prop_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this property",
            )

    items, total = ia_service.list_irrigation_areas(db, page, per_page, property_id)
    return PaginatedResponse(
        page=page,
        per_page=per_page,
        total=total,
        data=[IrrigationAreaResponse.model_validate(a) for a in items],
    )


@router.post("", response_model=IrrigationAreaResponse, status_code=201)
def create_irrigation_area(
    data: IrrigationAreaCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    area = ia_service.create_irrigation_area(db, data)
    return IrrigationAreaResponse.model_validate(area)


@router.get("/{area_id}", response_model=IrrigationAreaResponse)
def get_irrigation_area(
    area_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_area_ownership(current_user, db, area_id)
    area = ia_service.get_irrigation_area(db, area_id)
    return IrrigationAreaResponse.model_validate(area)


@router.put("/{area_id}", response_model=IrrigationAreaResponse)
def update_irrigation_area(
    area_id: int,
    data: IrrigationAreaUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    area = ia_service.update_irrigation_area(db, area_id, data)
    return IrrigationAreaResponse.model_validate(area)


@router.delete("/{area_id}", response_model=IrrigationAreaResponse)
def delete_irrigation_area(
    area_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    area = ia_service.soft_delete_irrigation_area(db, area_id)
    return IrrigationAreaResponse.model_validate(area)
