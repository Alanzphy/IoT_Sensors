from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.base import PaginatedResponse
from app.schemas.crop_type import CropTypeCreate, CropTypeResponse, CropTypeUpdate
from app.services import crop_type as crop_type_service

router = APIRouter()


@router.get("", response_model=PaginatedResponse[CropTypeResponse])
def list_crop_types(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items, total = crop_type_service.list_crop_types(db, page, per_page)
    return PaginatedResponse(
        page=page,
        per_page=per_page,
        total=total,
        data=[CropTypeResponse.model_validate(ct) for ct in items],
    )


@router.post("", response_model=CropTypeResponse, status_code=201)
def create_crop_type(
    data: CropTypeCreate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ct = crop_type_service.create_crop_type(db, data)
    return CropTypeResponse.model_validate(ct)


@router.get("/{crop_type_id}", response_model=CropTypeResponse)
def get_crop_type(
    crop_type_id: int,
    _user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ct = crop_type_service.get_crop_type(db, crop_type_id)
    return CropTypeResponse.model_validate(ct)


@router.put("/{crop_type_id}", response_model=CropTypeResponse)
def update_crop_type(
    crop_type_id: int,
    data: CropTypeUpdate,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ct = crop_type_service.update_crop_type(db, crop_type_id, data)
    return CropTypeResponse.model_validate(ct)


@router.delete("/{crop_type_id}", response_model=CropTypeResponse)
def delete_crop_type(
    crop_type_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ct = crop_type_service.soft_delete_crop_type(db, crop_type_id)
    return CropTypeResponse.model_validate(ct)
