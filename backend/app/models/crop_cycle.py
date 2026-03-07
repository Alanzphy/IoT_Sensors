from datetime import date

from sqlalchemy import Date, ForeignKey, Index, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import SoftDeleteMixin, TimestampMixin


class CropCycle(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "ciclos_cultivo"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    area_riego_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("areas_riego.id", ondelete="CASCADE"), nullable=False
    )
    fecha_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    fecha_fin: Mapped[date | None] = mapped_column(Date, nullable=True, default=None)

    # Relationships
    irrigation_area: Mapped["IrrigationArea"] = relationship(
        "IrrigationArea", back_populates="crop_cycles"
    )

    __table_args__ = (
        Index("idx_ciclos_cultivo_area_id", "area_riego_id"),
        Index("idx_ciclos_cultivo_area_fechas", "area_riego_id", "fecha_fin"),
    )
