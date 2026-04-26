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
