from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import SoftDeleteMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.notification_preference import NotificationPreference
    from app.models.property import Property
    from app.models.user import User


class Client(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "clientes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    usuario_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    nombre_empresa: Mapped[str] = mapped_column(String(200), nullable=False)
    telefono: Mapped[str | None] = mapped_column(
        String(30), nullable=True, default=None
    )
    direccion: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    notificaciones_habilitadas: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("1"),
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="client")
    properties: Mapped[list["Property"]] = relationship(
        "Property", back_populates="client"
    )
    notification_preferences: Mapped[list["NotificationPreference"]] = relationship(
        "NotificationPreference", back_populates="client"
    )

    __table_args__ = (Index("idx_clientes_usuario_id", "usuario_id"),)
