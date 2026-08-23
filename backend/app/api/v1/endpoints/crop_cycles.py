from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.authz import get_client_area_ids
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.base import PaginatedResponse
from app.schemas.crop_cycle import CropCycleCreate, CropCycleResponse, CropCycleUpdate
from app.services import crop_cycle as cycle_service

router = APIRouter()


def _check_cycle_ownership(user: User, db: Session, cycle_id: int) -> None:
    if user.rol == "admin":
        return
    cycle = cycle_service.get_crop_cycle(db, cycle_id)
    area_ids = get_client_area_ids(user, db)
    if cycle.area_riego_id not in area_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this crop cycle",
        )


@router.get("", response_model=PaginatedResponse[CropCycleResponse])
def list_crop_cycles(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    irrigation_area_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.rol != "admin" and irrigation_area_id is not None:
        area_ids = get_client_area_ids(current_user, db)
        if irrigation_area_id not in area_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this irrigation area",
            )

    allowed_area_ids: list[int] | None = None
    if current_user.rol != "admin" and irrigation_area_id is None:
        allowed_area_ids = get_client_area_ids(current_user, db)
        if not allowed_area_ids:
            return PaginatedResponse(
                page=page,
                per_page=per_page,
                total=0,
                data=[],
            )

    items, total = cycle_service.list_crop_cycles(
        db, page, per_page, irrigation_area_id, allowed_area_ids=allowed_area_ids
    )
    return PaginatedResponse(
        page=page,
        per_page=per_page,
        total=total,
        data=[CropCycleResponse.model_validate(c) for c in items],
    )


@router.post("", response_model=CropCycleResponse, status_code=201)
def create_crop_cycle(
    data: CropCycleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    cycle = cycle_service.create_crop_cycle(db, data)
    return CropCycleResponse.model_validate(cycle)


@router.get("/{cycle_id}", response_model=CropCycleResponse)
def get_crop_cycle(
    cycle_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_cycle_ownership(current_user, db, cycle_id)
    cycle = cycle_service.get_crop_cycle(db, cycle_id)
    return CropCycleResponse.model_validate(cycle)


@router.put("/{cycle_id}", response_model=CropCycleResponse)
def update_crop_cycle(
    cycle_id: int,
    data: CropCycleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    cycle = cycle_service.update_crop_cycle(db, cycle_id, data)
    return CropCycleResponse.model_validate(cycle)


@router.delete("/{cycle_id}", response_model=CropCycleResponse)
def delete_crop_cycle(
    cycle_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    cycle = cycle_service.soft_delete_crop_cycle(db, cycle_id)
    return CropCycleResponse.model_validate(cycle)
