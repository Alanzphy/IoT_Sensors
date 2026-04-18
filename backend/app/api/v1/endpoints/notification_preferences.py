from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.base import PaginatedResponse
from app.schemas.notification_preference import (
    NotificationPreferenceBulkUpsertRequest,
    NotificationPreferenceBulkUpsertResponse,
    NotificationPreferenceResponse,
)
from app.services import audit_log as audit_log_service
from app.services import client as client_service
from app.services import notification_preference as np_service

router = APIRouter()


@router.get("", response_model=PaginatedResponse[NotificationPreferenceResponse])
def list_notification_preferences(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=500),
    client_id: int | None = Query(None),
    irrigation_area_id: int | None = Query(None),
    alert_type: str | None = Query(None),
    severity: str | None = Query(None),
    channel: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    resolved_client_id = client_id
    allowed_area_ids: list[int] | None = None

    if current_user.rol != "admin":
        current_client = client_service.get_client_by_user_id(db, current_user.id)
        resolved_client_id = current_client.id
        allowed_area_ids = np_service.get_client_area_ids(db, current_client.id)

    if (
        irrigation_area_id is not None
        and allowed_area_ids is not None
        and irrigation_area_id not in allowed_area_ids
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this irrigation area",
        )

    items, total = np_service.list_notification_preferences(
        db,
        page=page,
        per_page=per_page,
        client_id=resolved_client_id,
        irrigation_area_id=irrigation_area_id,
        alert_type=alert_type,
        severity=severity,
        channel=channel,
        allowed_area_ids=allowed_area_ids,
    )
    return PaginatedResponse(
        page=page,
        per_page=per_page,
        total=total,
        data=[NotificationPreferenceResponse.model_validate(item) for item in items],
    )


@router.put("/bulk", response_model=NotificationPreferenceBulkUpsertResponse)
def bulk_upsert_notification_preferences(
    payload: NotificationPreferenceBulkUpsertRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.rol != "cliente":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Client access required",
        )

    current_client = client_service.get_client_by_user_id(db, current_user.id)
    allowed_area_ids = set(np_service.get_client_area_ids(db, current_client.id))

    created, updated, touched = np_service.bulk_upsert_notification_preferences(
        db,
        client_id=current_client.id,
        allowed_area_ids=allowed_area_ids,
        items=payload.items,
    )
    audit_log_service.create_audit_log(
        db,
        user_id=current_user.id,
        action="update",
        entity="notification_preference",
        detail=f"Bulk upsert notification preferences created={created}, updated={updated}",
    )
    return NotificationPreferenceBulkUpsertResponse(
        created=created,
        updated=updated,
        data=[NotificationPreferenceResponse.model_validate(item) for item in touched],
    )
