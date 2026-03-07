from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column


class TimestampMixin:
    """Adds creado_en and actualizado_en columns."""

    creado_en: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
    )
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )


class SoftDeleteMixin:
    """Adds eliminado_en column for logical deletion."""

    eliminado_en: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
        default=None,
    )
