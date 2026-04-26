from decimal import Decimal

from sqlalchemy import DECIMAL, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import SoftDeleteMixin, TimestampMixin


class IrrigationArea(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "areas_riego"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    predio_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("predios.id", ondelete="CASCADE"), nullable=False
    )
    tipo_cultivo_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("tipos_cultivo.id", ondelete="RESTRICT"), nullable=False
    )
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    tamano_area: Mapped[Decimal | None] = mapped_column(
        DECIMAL(10, 2), nullable=True, default=None
    )

    # Relationships
    property: Mapped["Property"] = relationship(
        "Property", back_populates="irrigation_areas"
    )
    crop_type: Mapped["CropType"] = relationship(
        "CropType", back_populates="irrigation_areas"
    )
    crop_cycles: Mapped[list["CropCycle"]] = relationship(
        "CropCycle", back_populates="irrigation_area"
    )
    node: Mapped["Node | None"] = relationship(
        "Node", back_populates="irrigation_area", uselist=False
    )
    thresholds: Mapped[list["Threshold"]] = relationship(
        "Threshold", back_populates="irrigation_area"
    )
    alerts: Mapped[list["Alert"]] = relationship(
        "Alert", back_populates="irrigation_area"
    )
    notification_preferences: Mapped[list["NotificationPreference"]] = relationship(
        "NotificationPreference", back_populates="irrigation_area"
    )
    ai_reports: Mapped[list["AIReport"]] = relationship(
        "AIReport", back_populates="irrigation_area"
    )

    __table_args__ = (
        Index("idx_areas_riego_predio_id", "predio_id"),
        Index("idx_areas_riego_tipo_cultivo_id", "tipo_cultivo_id"),
    )
