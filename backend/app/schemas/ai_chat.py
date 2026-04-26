from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class AIChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class AIChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    client_id: int | None = None
    irrigation_area_id: int | None = None
    hours_back: int = Field(default=72, ge=1, le=24 * 30)
    history: list[AIChatMessage] = Field(default_factory=list, max_length=20)


class AIChatResponse(BaseModel):
    answer: str
    source: str
    generated_at: datetime
    metadata: dict[str, Any] = Field(default_factory=dict)
    widgets: list[dict[str, Any]] = Field(default_factory=list)


class AIAssistantUsageItem(BaseModel):
    id: int
    created_at: datetime
    user_id: int | None = None
    user_email: str | None = None
    user_name: str | None = None
    action: str
    source: str | None = None
    provider: str | None = None
    model: str | None = None
    latency_ms: int | None = None
    tokens_prompt: int | None = None
    tokens_completion: int | None = None
    status_code: int | None = None
    error_detail: str | None = None
    client_id: int | None = None
    irrigation_area_id: int | None = None
    hours_back: int | None = None


class AIAssistantUsageSummary(BaseModel):
    total_requests: int = 0
    successful_requests: int = 0
    ai_responses: int = 0
    fallback_responses: int = 0
    error_requests: int = 0
    rate_limited_requests: int = 0
    total_prompt_tokens: int = 0
    total_completion_tokens: int = 0
    avg_latency_ms: float | None = None


class AIAssistantUsageResponse(BaseModel):
    page: int
    per_page: int
    total: int
    window_hours: int
    summary: AIAssistantUsageSummary
    data: list[AIAssistantUsageItem]
