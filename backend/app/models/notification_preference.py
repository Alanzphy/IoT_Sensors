from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Enum, ForeignKey, Index, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import TimestampMixin

if TYPE_CHECKING:
    from app.models.client import Client
    from app.models.irrigation_area import IrrigationArea


class NotificationPreference(Base, TimestampMixin):
    __tablename__ = "preferencias_notificacion"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("clientes.id", ondelete="CASCADE"),
        nullable=False,
    )
    area_riego_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("areas_riego.id", ondelete="CASCADE"),
        nullable=False,
    )
    tipo_alerta: Mapped[str] = mapped_column(
        Enum("threshold", "inactivity", name="tipo_alerta_enum"),
        nullable=False,
        default="threshold",
    )
    severidad: Mapped[str] = mapped_column(
        Enum("info", "warning", "critical", name="severidad_alerta_enum"),
        nullable=False,
        default="warning",
    )
    canal: Mapped[str] = mapped_column(
        Enum("email", "whatsapp", name="canal_notificacion_enum"),
        nullable=False,
    )
    habilitado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    client: Mapped["Client"] = relationship(
        "Client", back_populates="notification_preferences"
    )
    irrigation_area: Mapped["IrrigationArea"] = relationship(
        "IrrigationArea", back_populates="notification_preferences"
    )

    __table_args__ = (
        UniqueConstraint(
            "cliente_id",
            "area_riego_id",
            "tipo_alerta",
            "severidad",
            "canal",
            name="uq_preferencias_notificacion_scope",
        ),
        Index("idx_pref_notif_cliente", "cliente_id"),
        Index("idx_pref_notif_area", "area_riego_id"),
    )
