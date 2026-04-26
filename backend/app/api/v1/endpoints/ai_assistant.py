import json
from datetime import UTC, datetime, timedelta
from time import perf_counter
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.ai_chat import (
    AIAssistantUsageItem,
    AIAssistantUsageResponse,
    AIAssistantUsageSummary,
    AIChatRequest,
    AIChatResponse,
)
from app.services import ai_chat as ai_chat_service
from app.services import audit_log as audit_log_service

router = APIRouter()


def _ensure_ai_assistant_enabled() -> None:
    if not settings.AI_ASSISTANT_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI assistant feature is disabled",
        )


def _require_admin(user: User) -> None:
    if user.rol != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )


def _utc_now_naive() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _to_int(value: Any) -> int | None:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    return None


def _safe_json_parse(detail: str | None) -> dict[str, Any]:
    if not detail:
        return {}
    try:
        parsed = json.loads(detail)
        if isinstance(parsed, dict):
            return parsed
        return {}
    except Exception:
        return {}


def _enforce_rate_limit(
    db: Session,
    *,
    current_user: User,
    payload: AIChatRequest,
) -> None:
    max_requests = settings.AI_ASSISTANT_RATE_LIMIT_MAX_REQUESTS
    window_minutes = settings.AI_ASSISTANT_RATE_LIMIT_WINDOW_MINUTES
    if max_requests <= 0 or window_minutes <= 0:
        return

    since = _utc_now_naive() - timedelta(minutes=window_minutes)
    recent_count = audit_log_service.count_audit_logs(
        db,
        user_id=current_user.id,
        entity="ai_assistant_chat",
        since=since,
    )

    if recent_count >= max_requests:
        audit_log_service.create_audit_log(
            db,
            user_id=current_user.id,
            action="rate_limited",
            entity="ai_assistant_chat",
            detail=json.dumps(
                {
                    "provider": "rate-limiter",
                    "status_code": 429,
                    "error_detail": (
                        f"Exceeded {max_requests} requests in {window_minutes} minutes"
                    ),
                    "client_id": payload.client_id,
                    "irrigation_area_id": payload.irrigation_area_id,
                    "hours_back": payload.hours_back,
                },
                ensure_ascii=True,
                default=str,
            ),
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"AI assistant rate limit exceeded: max {max_requests} requests "
                f"per {window_minutes} minutes"
            ),
        )


@router.post("/chat", response_model=AIChatResponse)
def ask_ai_assistant(
    payload: AIChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_ai_assistant_enabled()
    _enforce_rate_limit(db, current_user=current_user, payload=payload)
    started = perf_counter()

    try:
        result = ai_chat_service.ask_ai_assistant(
            db,
            current_user=current_user,
            message=payload.message,
            history=[item.model_dump() for item in payload.history],
            hours_back=payload.hours_back,
            client_id=payload.client_id,
            irrigation_area_id=payload.irrigation_area_id,
        )
        latency_ms = int((perf_counter() - started) * 1000)
        metadata = result.get("metadata", {})
        metadata_dict = metadata if isinstance(metadata, dict) else {}

        audit_log_service.create_audit_log(
            db,
            user_id=current_user.id,
            action="execute",
            entity="ai_assistant_chat",
            detail=json.dumps(
                {
                    "source": result.get("source"),
                    "provider": metadata_dict.get("provider"),
                    "model": metadata_dict.get("model"),
                    "tokens_prompt": _to_int(metadata_dict.get("tokens_prompt")),
                    "tokens_completion": _to_int(metadata_dict.get("tokens_completion")),
                    "latency_ms": latency_ms,
                    "status_code": 200,
                    "client_id": payload.client_id,
                    "irrigation_area_id": payload.irrigation_area_id,
                    "hours_back": payload.hours_back,
                },
                ensure_ascii=True,
                default=str,
            ),
        )
        return AIChatResponse.model_validate(result)
    except HTTPException as exc:
        latency_ms = int((perf_counter() - started) * 1000)
        audit_log_service.create_audit_log(
            db,
            user_id=current_user.id,
            action="error",
            entity="ai_assistant_chat",
            detail=json.dumps(
                {
                    "provider": "api",
                    "status_code": exc.status_code,
                    "error_detail": str(exc.detail),
                    "latency_ms": latency_ms,
                    "client_id": payload.client_id,
                    "irrigation_area_id": payload.irrigation_area_id,
                    "hours_back": payload.hours_back,
                },
                ensure_ascii=True,
                default=str,
            ),
        )
        raise


@router.get("/usage", response_model=AIAssistantUsageResponse)
def get_ai_assistant_usage(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=200),
    hours: int = Query(24, ge=1, le=24 * 30),
    user_id: int | None = Query(None),
    action: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_ai_assistant_enabled()
    _require_admin(current_user)

    now_utc = _utc_now_naive()
    since = now_utc - timedelta(hours=hours)
    conditions = [
        AuditLog.entidad == "ai_assistant_chat",
        AuditLog.creado_en >= since,
        AuditLog.creado_en <= now_utc,
    ]
    if user_id is not None:
        conditions.append(AuditLog.usuario_id == user_id)
    if action is not None:
        conditions.append(AuditLog.accion == action)

    total_count = (
        db.execute(
            select(func.count()).select_from(AuditLog).where(*conditions)
        ).scalar()
        or 0
    )

    logs = list(
        db.execute(
            select(AuditLog)
            .options(joinedload(AuditLog.user))
            .where(*conditions)
            .order_by(AuditLog.creado_en.desc(), AuditLog.id.desc())
            .offset((page - 1) * per_page)
            .limit(per_page)
        ).scalars()
    )

    all_log_details = list(
        db.execute(
            select(AuditLog.accion, AuditLog.detalle).where(*conditions)
        ).all()
    )

    prompt_tokens_total = 0
    completion_tokens_total = 0
    latencies: list[int] = []
    ai_responses = 0
    fallback_responses = 0
    successful_requests = 0
    error_requests = 0
    rate_limited_requests = 0

    for action_value, detail in all_log_details:
        parsed = _safe_json_parse(detail)
        if action_value == "execute":
            successful_requests += 1
            source = parsed.get("source")
            if source == "ai":
                ai_responses += 1
            elif source == "fallback":
                fallback_responses += 1
            prompt_tokens_total += _to_int(parsed.get("tokens_prompt")) or 0
            completion_tokens_total += _to_int(parsed.get("tokens_completion")) or 0
        elif action_value == "error":
            error_requests += 1
        elif action_value == "rate_limited":
            rate_limited_requests += 1

        latency = _to_int(parsed.get("latency_ms"))
        if latency is not None and latency >= 0:
            latencies.append(latency)

    avg_latency_ms = (
        round(sum(latencies) / len(latencies), 2) if latencies else None
    )

    items: list[AIAssistantUsageItem] = []
    for log in logs:
        parsed = _safe_json_parse(log.detalle)
        items.append(
            AIAssistantUsageItem(
                id=int(log.id),
                created_at=log.creado_en,
                user_id=log.usuario_id,
                user_email=log.user.correo if log.user is not None else None,
                user_name=log.user.nombre_completo if log.user is not None else None,
                action=log.accion,
                source=(
                    parsed.get("source")
                    if isinstance(parsed.get("source"), str)
                    else None
                ),
                provider=(
                    parsed.get("provider")
                    if isinstance(parsed.get("provider"), str)
                    else None
                ),
                model=(
                    parsed.get("model")
                    if isinstance(parsed.get("model"), str)
                    else None
                ),
                latency_ms=_to_int(parsed.get("latency_ms")),
                tokens_prompt=_to_int(parsed.get("tokens_prompt")),
                tokens_completion=_to_int(parsed.get("tokens_completion")),
                status_code=_to_int(parsed.get("status_code")),
                error_detail=(
                    parsed.get("error_detail")
                    if isinstance(parsed.get("error_detail"), str)
                    else None
                ),
                client_id=_to_int(parsed.get("client_id")),
                irrigation_area_id=_to_int(parsed.get("irrigation_area_id")),
                hours_back=_to_int(parsed.get("hours_back")),
            )
        )

    summary = AIAssistantUsageSummary(
        total_requests=total_count,
        successful_requests=successful_requests,
        ai_responses=ai_responses,
        fallback_responses=fallback_responses,
        error_requests=error_requests,
        rate_limited_requests=rate_limited_requests,
        total_prompt_tokens=prompt_tokens_total,
        total_completion_tokens=completion_tokens_total,
        avg_latency_ms=avg_latency_ms,
    )

    return AIAssistantUsageResponse(
        page=page,
        per_page=per_page,
        total=total_count,
        window_hours=hours,
        summary=summary,
        data=items,
    )
