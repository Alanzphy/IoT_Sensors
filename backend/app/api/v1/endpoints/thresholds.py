from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.base import PaginatedResponse
from app.schemas.threshold import ThresholdCreate, ThresholdResponse, ThresholdUpdate
from app.services import audit_log as audit_log_service
from app.services import threshold as threshold_service

router = APIRouter()


def _require_admin(user: User) -> None:
    if user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )


@router.get("", response_model=PaginatedResponse[ThresholdResponse])
def list_thresholds(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    irrigation_area_id: int | None = Query(None),
    parameter: str | None = Query(None),
    active: bool | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    items, total = threshold_service.list_thresholds(
        db=db,
        page=page,
        per_page=per_page,
        irrigation_area_id=irrigation_area_id,
        parameter=parameter,
        active=active,
    )
    return PaginatedResponse(
        page=page,
        per_page=per_page,
        total=total,
        data=[ThresholdResponse.model_validate(item) for item in items],
    )


@router.post("", response_model=ThresholdResponse, status_code=201)
def create_threshold(
    data: ThresholdCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    threshold = threshold_service.create_threshold(db, data)
    audit_log_service.create_audit_log(
        db,
        user_id=current_user.id,
        action="create",
        entity="threshold",
        entity_id=str(threshold.id),
        detail=(
            f"Created threshold area={threshold.area_riego_id} "
            f"parameter={threshold.parametro}"
        ),
    )
    return ThresholdResponse.model_validate(threshold)


@router.get("/{threshold_id}", response_model=ThresholdResponse)
def get_threshold(
    threshold_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    threshold = threshold_service.get_threshold(db, threshold_id)
    return ThresholdResponse.model_validate(threshold)


@router.put("/{threshold_id}", response_model=ThresholdResponse)
def update_threshold(
    threshold_id: int,
    data: ThresholdUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    threshold = threshold_service.update_threshold(db, threshold_id, data)
    audit_log_service.create_audit_log(
        db,
        user_id=current_user.id,
        action="update",
        entity="threshold",
        entity_id=str(threshold.id),
        detail=(
            f"Updated threshold area={threshold.area_riego_id} "
            f"parameter={threshold.parametro}"
        ),
    )
    return ThresholdResponse.model_validate(threshold)


@router.delete("/{threshold_id}", response_model=ThresholdResponse)
def delete_threshold(
    threshold_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    threshold = threshold_service.soft_delete_threshold(db, threshold_id)
    audit_log_service.create_audit_log(
        db,
        user_id=current_user.id,
        action="delete",
        entity="threshold",
        entity_id=str(threshold.id),
        detail="Soft deleted threshold",
    )
    return ThresholdResponse.model_validate(threshold)
