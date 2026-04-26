from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.ai_chat import AIChatRequest, AIChatResponse
from app.services import ai_chat as ai_chat_service
from app.services import audit_log as audit_log_service

router = APIRouter()


def _ensure_ai_assistant_enabled() -> None:
    if not settings.AI_ASSISTANT_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI assistant feature is disabled",
        )


@router.post("/chat", response_model=AIChatResponse)
def ask_ai_assistant(
    payload: AIChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_ai_assistant_enabled()

    result = ai_chat_service.ask_ai_assistant(
        db,
        current_user=current_user,
        message=payload.message,
        history=[item.model_dump() for item in payload.history],
        hours_back=payload.hours_back,
        client_id=payload.client_id,
        irrigation_area_id=payload.irrigation_area_id,
    )

    audit_log_service.create_audit_log(
        db,
        user_id=current_user.id,
        action="execute",
        entity="ai_assistant_chat",
        detail=(
            f"source={result['source']}, "
            f"client_id={payload.client_id}, "
            f"irrigation_area_id={payload.irrigation_area_id}, "
            f"hours_back={payload.hours_back}"
        ),
    )
    return AIChatResponse.model_validate(result)
