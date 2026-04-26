from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.client import Client
from app.models.user import User
from app.schemas.ai_report import (
    AIReportGenerateRequest,
    AIReportGenerateResponse,
    AIReportResponse,
)
from app.schemas.base import PaginatedResponse
from app.services import ai_report as ai_report_service
from app.services import audit_log as audit_log_service

router = APIRouter()


def _ensure_ai_reports_enabled() -> None:
    if not settings.AI_REPORTS_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI reports feature is disabled",
        )


def _require_admin(user: User) -> None:
    if user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )


def _get_owned_client_id(user: User, db: Session) -> int:
    client_id = db.execute(
        select(Client.id).where(
            Client.usuario_id == user.id,
            Client.eliminado_en.is_(None),
        )
    ).scalar_one_or_none()
    if client_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Client profile not found",
        )
    return int(client_id)


@router.get("", response_model=PaginatedResponse[AIReportResponse])
def list_ai_reports(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    client_id: int | None = Query(None),
    irrigation_area_id: int | None = Query(None),
    status_value: str | None = Query(None, alias="status"),
    start_date: date | None = Query(None),
    end_date: date | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_ai_reports_enabled()
    allowed_client_id: int | None = None

    if current_user.rol != "admin":
        allowed_client_id = _get_owned_client_id(current_user, db)
        if client_id is not None and client_id != allowed_client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this client scope",
            )

    items, total = ai_report_service.list_ai_reports(
        db=db,
        page=page,
        per_page=per_page,
        client_id=client_id,
        irrigation_area_id=irrigation_area_id,
        status_value=status_value,
        start_date=start_date,
        end_date=end_date,
        allowed_client_id=allowed_client_id,
    )
    return PaginatedResponse(
        page=page,
        per_page=per_page,
        total=total,
        data=[AIReportResponse.model_validate(item) for item in items],
    )


@router.get("/{report_id}", response_model=AIReportResponse)
def get_ai_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_ai_reports_enabled()
    report = ai_report_service.get_ai_report(db, report_id)

    if current_user.rol != "admin":
        owned_client_id = _get_owned_client_id(current_user, db)
        if report.cliente_id != owned_client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this report",
            )

    return AIReportResponse.model_validate(report)


@router.post("/generate", response_model=AIReportGenerateResponse)
def generate_ai_reports(
    payload: AIReportGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_ai_reports_enabled()
    _require_admin(current_user)

    result = ai_report_service.generate_ai_reports(
        db=db,
        client_id=payload.client_id,
        irrigation_area_id=payload.irrigation_area_id,
        start_datetime=payload.start_datetime,
        end_datetime=payload.end_datetime,
        notify=payload.notify,
        force=payload.force,
    )

    audit_log_service.create_audit_log(
        db,
        user_id=current_user.id,
        action="execute",
        entity="ai_report_generation",
        detail=(
            f"client_id={payload.client_id}, irrigation_area_id={payload.irrigation_area_id}, "
            f"force={payload.force}, notify={payload.notify}, "
            f"generated={result['generated_count']}, skipped={result['skipped_count']}, "
            f"failed={result['failed_count']}"
        ),
    )
    return AIReportGenerateResponse.model_validate(result)
