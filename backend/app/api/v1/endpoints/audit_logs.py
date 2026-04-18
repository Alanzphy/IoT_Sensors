from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.audit_log import AuditLogResponse
from app.schemas.base import PaginatedResponse
from app.services import audit_log as audit_log_service

router = APIRouter()


def _require_admin(user: User) -> None:
    if user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )


@router.get("", response_model=PaginatedResponse[AuditLogResponse])
def list_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    user_id: int | None = Query(None),
    action: str | None = Query(None),
    entity: str | None = Query(None),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)

    items, total = audit_log_service.list_audit_logs(
        db=db,
        page=page,
        per_page=per_page,
        user_id=user_id,
        action=action,
        entity=entity,
        start_date=start_date,
        end_date=end_date,
    )
    return PaginatedResponse(
        page=page,
        per_page=per_page,
        total=total,
        data=[AuditLogResponse.model_validate(item) for item in items],
    )


@router.get("/{audit_log_id}", response_model=AuditLogResponse)
def get_audit_log(
    audit_log_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_admin(current_user)
    item = audit_log_service.get_audit_log(db, audit_log_id)
    return AuditLogResponse.model_validate(item)
