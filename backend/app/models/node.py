from decimal import Decimal

from sqlalchemy import Boolean, DECIMAL, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import SoftDeleteMixin, TimestampMixin


class Node(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "nodos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    area_riego_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("areas_riego.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    api_key: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    numero_serie: Mapped[str | None] = mapped_column(
        String(100), nullable=True, default=None, unique=True
    )
    nombre: Mapped[str | None] = mapped_column(String(150), nullable=True, default=None)
    latitud: Mapped[Decimal | None] = mapped_column(
        DECIMAL(10, 7), nullable=True, default=None
    )
    longitud: Mapped[Decimal | None] = mapped_column(
        DECIMAL(10, 7), nullable=True, default=None
    )
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    # Relationships
    irrigation_area: Mapped["IrrigationArea"] = relationship(
        "IrrigationArea", back_populates="node"
    )
    readings: Mapped[list["Reading"]] = relationship("Reading", back_populates="node")
    alerts: Mapped[list["Alert"]] = relationship("Alert", back_populates="node")

    __table_args__ = (
        Index("idx_nodos_api_key", "api_key"),
        Index("idx_nodos_area_riego_id", "area_riego_id"),
    )
