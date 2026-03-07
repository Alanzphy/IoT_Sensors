from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class RefreshToken(Base):
    __tablename__ = "tokens_refresco"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    usuario_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False
    )
    token: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)
    expira_en: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    revocado_en: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, default=None
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="refresh_tokens")

    __table_args__ = (
        Index("idx_tokens_refresco_token", "token"),
        Index("idx_tokens_refresco_usuario_id", "usuario_id"),
    )
