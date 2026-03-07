from typing import Generic, TypeVar

from pydantic import BaseModel, Field

from app.core.config import settings

T = TypeVar("T")


class PaginationParams(BaseModel):
    page: int = Field(default=1, ge=1)
    per_page: int = Field(
        default=settings.DEFAULT_PAGE_SIZE,
        ge=1,
        le=settings.MAX_PAGE_SIZE,
    )


class PaginatedResponse(BaseModel, Generic[T]):
    page: int
    per_page: int
    total: int
    data: list[T]
