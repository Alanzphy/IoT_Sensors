from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.client import Client
from app.models.irrigation_area import IrrigationArea
from app.models.property import Property
from app.models.user import User
from app.schemas.alert import (
    AlertReadUpdate,
    AlertResponse,
    InactivityScanResponse,
    NotificationDispatchResponse,
)
from app.schemas.base import PaginatedResponse
from app.services import alert as alert_service
from app.services import audit_log as audit_log_service

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
    user: User, db: Session, irrigation_area_id: int
) -> None:
    if user.rol == "admin":
        return
    area_ids = _get_client_area_ids(user, db)
    if irrigation_area_id not in area_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this irrigation area",
        )


def _require_admin(user: User) -> None:
    if user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )


@router.get("", response_model=PaginatedResponse[AlertResponse])
def list_alerts(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    irrigation_area_id: int | None = Query(None),
    node_id: int | None = Query(None),
    severity: str | None = Query(None),
    read: bool | None = Query(None),
    alert_type: str | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    allowed_area_ids: list[int] | None = None

    if current_user.rol != "admin":
        allowed_area_ids = _get_client_area_ids(current_user, db)
        if irrigation_area_id is not None:
            _validate_client_area_access(current_user, db, irrigation_area_id)

    items, total = alert_service.list_alerts(
        db=db,
        page=page,
        per_page=per_page,
        irrigation_area_id=irrigation_area_id,
        node_id=node_id,
        severity=severity,
        read=read,
        alert_type=alert_type,
        start_date=start_date,
        end_date=end_date,
        allowed_area_ids=allowed_area_ids,
    )
    return PaginatedResponse(
        page=page,
        per_page=per_page,
        total=total,
        data=[AlertResponse.model_validate(item) for item in items],
    )


@router.get("/{alert_id}", response_model=AlertResponse)
def get_alert(
    alert_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = alert_service.get_alert(db, alert_id)
    if current_user.rol != "admin":
        _validate_client_area_access(current_user, db, alert.area_riego_id)
    return AlertResponse.model_validate(alert)


@router.patch("/{alert_id}/read", response_model=AlertResponse)
def mark_alert_read(
    alert_id: int,
    payload: AlertReadUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = alert_service.get_alert(db, alert_id)
    if current_user.rol != "admin":
        _validate_client_area_access(current_user, db, alert.area_riego_id)
    updated = alert_service.mark_alert_read(db, alert_id, read=payload.read)
    audit_log_service.create_audit_log(
        db,
        user_id=current_user.id,
        action="update",
        entity="alert",
        entity_id=str(updated.id),
        detail=f"Set read={payload.read}",
    )
    return AlertResponse.model_validate(updated)


@router.post("/scan-inactivity", response_model=InactivityScanResponse)
def scan_inactivity_alerts(
    minutes_without_data: int = Query(20, ge=1, le=1440),
    node_id: int | None = Query(None),
    irrigation_area_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)

    result = alert_service.scan_inactivity_alerts(
        db,
        minutes_without_data=minutes_without_data,
        node_id=node_id,
        irrigation_area_id=irrigation_area_id,
    )
    audit_log_service.create_audit_log(
        db,
        user_id=current_user.id,
        action="execute",
        entity="inactivity_scan",
        detail=(
            f"minutes={minutes_without_data}, node_id={node_id}, "
            f"irrigation_area_id={irrigation_area_id}, "
            f"created_alerts={result['created_alerts']}"
        ),
    )
    return InactivityScanResponse.model_validate(result)


@router.post(
    "/dispatch-notifications",
    response_model=NotificationDispatchResponse,
)
def dispatch_alert_notifications(
    limit: int = Query(200, ge=1, le=1000),
    only_unread: bool = Query(False),
    severity: str | None = Query(None),
    alert_type: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)

    result = alert_service.dispatch_pending_notifications(
        db,
        limit=limit,
        only_unread=only_unread,
        severity=severity,
        alert_type=alert_type,
    )
    audit_log_service.create_audit_log(
        db,
        user_id=current_user.id,
        action="execute",
        entity="alert_notification_dispatch",
        detail=(
            f"limit={limit}, only_unread={only_unread}, severity={severity}, "
            f"alert_type={alert_type}, processed={result['processed_alerts']}, "
            f"emailed={result['emailed_alerts']}, "
            f"whatsapp={result['whatsapp_alerts']}"
        ),
    )
    return NotificationDispatchResponse.model_validate(result)
