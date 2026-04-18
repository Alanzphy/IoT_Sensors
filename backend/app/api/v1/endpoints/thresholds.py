from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.client import Client
from app.models.irrigation_area import IrrigationArea
from app.models.property import Property
from app.models.user import User
from app.schemas.base import PaginatedResponse
from app.schemas.threshold import ThresholdCreate, ThresholdResponse, ThresholdUpdate
from app.services import audit_log as audit_log_service
from app.services import threshold as threshold_service

router = APIRouter()


def _get_client_area_ids(user: User, db: Session) -> list[int]:
    client = db.execute(
        select(Client).where(
            Client.usuario_id == user.id,
            Client.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if client is None:
        return []

    property_ids = list(
        db.execute(
            select(Property.id).where(
                Property.cliente_id == client.id,
                Property.eliminado_en.is_(None),
            )
        ).scalars()
    )
    if not property_ids:
        return []

    return list(
        db.execute(
            select(IrrigationArea.id).where(
                IrrigationArea.predio_id.in_(property_ids),
                IrrigationArea.eliminado_en.is_(None),
            )
        ).scalars()
    )


def _validate_client_area_access(
    user: User,
    db: Session,
    irrigation_area_id: int,
) -> None:
    if user.rol == "admin":
        return

    area_ids = _get_client_area_ids(user, db)
    if irrigation_area_id not in area_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this irrigation area",
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
    allowed_area_ids: list[int] | None = None

    if current_user.rol != "admin":
        allowed_area_ids = _get_client_area_ids(current_user, db)
        if irrigation_area_id is not None:
            _validate_client_area_access(current_user, db, irrigation_area_id)

    items, total = threshold_service.list_thresholds(
        db=db,
        page=page,
        per_page=per_page,
        irrigation_area_id=irrigation_area_id,
        parameter=parameter,
        active=active,
        allowed_area_ids=allowed_area_ids,
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
    if current_user.rol != "admin":
        _validate_client_area_access(current_user, db, data.irrigation_area_id)

    threshold = threshold_service.create_threshold(db, data)
    actor_scope = "admin" if current_user.rol == "admin" else "client-self-service"
    audit_log_service.create_audit_log(
        db,
        user_id=current_user.id,
        action="create",
        entity="threshold",
        entity_id=str(threshold.id),
        detail=(
            f"Created threshold area={threshold.area_riego_id} "
            f"parameter={threshold.parametro} actor={actor_scope}"
        ),
    )
    return ThresholdResponse.model_validate(threshold)


@router.get("/{threshold_id}", response_model=ThresholdResponse)
def get_threshold(
    threshold_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    threshold = threshold_service.get_threshold(db, threshold_id)
    if current_user.rol != "admin":
        _validate_client_area_access(current_user, db, threshold.area_riego_id)
    return ThresholdResponse.model_validate(threshold)


@router.put("/{threshold_id}", response_model=ThresholdResponse)
def update_threshold(
    threshold_id: int,
    data: ThresholdUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.rol != "admin":
        current_threshold = threshold_service.get_threshold(db, threshold_id)
        _validate_client_area_access(current_user, db, current_threshold.area_riego_id)
        if data.irrigation_area_id is not None:
            _validate_client_area_access(current_user, db, data.irrigation_area_id)

    threshold = threshold_service.update_threshold(db, threshold_id, data)
    actor_scope = "admin" if current_user.rol == "admin" else "client-self-service"
    audit_log_service.create_audit_log(
        db,
        user_id=current_user.id,
        action="update",
        entity="threshold",
        entity_id=str(threshold.id),
        detail=(
            f"Updated threshold area={threshold.area_riego_id} "
            f"parameter={threshold.parametro} actor={actor_scope}"
        ),
    )
    return ThresholdResponse.model_validate(threshold)


@router.delete("/{threshold_id}", response_model=ThresholdResponse)
def delete_threshold(
    threshold_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    threshold = threshold_service.get_threshold(db, threshold_id)
    if current_user.rol != "admin":
        _validate_client_area_access(current_user, db, threshold.area_riego_id)

    threshold = threshold_service.soft_delete_threshold(db, threshold_id)
    actor_scope = "admin" if current_user.rol == "admin" else "client-self-service"
    audit_log_service.create_audit_log(
        db,
        user_id=current_user.id,
        action="delete",
        entity="threshold",
        entity_id=str(threshold.id),
        detail=f"Soft deleted threshold actor={actor_scope}",
    )
    return ThresholdResponse.model_validate(threshold)
