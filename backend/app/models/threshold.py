from decimal import Decimal

from sqlalchemy import Boolean, DECIMAL, Enum, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import SoftDeleteMixin, TimestampMixin


class Threshold(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "umbrales"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    area_riego_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("areas_riego.id", ondelete="CASCADE"),
        nullable=False,
    )
    parametro: Mapped[str] = mapped_column(String(64), nullable=False)
    rango_min: Mapped[Decimal | None] = mapped_column(DECIMAL(12, 4), nullable=True)
    rango_max: Mapped[Decimal | None] = mapped_column(DECIMAL(12, 4), nullable=True)
    severidad: Mapped[str] = mapped_column(
        Enum("info", "warning", "critical", name="severidad_alerta_enum"),
        nullable=False,
        default="warning",
    )
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    irrigation_area: Mapped["IrrigationArea"] = relationship(
        "IrrigationArea", back_populates="thresholds"
    )
    alerts: Mapped[list["Alert"]] = relationship("Alert", back_populates="threshold")

    __table_args__ = (
        Index("idx_umbrales_area_riego_id", "area_riego_id"),
        Index("idx_umbrales_area_parametro", "area_riego_id", "parametro"),
    )
