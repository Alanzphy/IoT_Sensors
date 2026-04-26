from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    DECIMAL,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import TimestampMixin


class Alert(Base, TimestampMixin):
    __tablename__ = "alertas"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    nodo_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("nodos.id", ondelete="CASCADE"),
        nullable=False,
    )
    area_riego_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("areas_riego.id", ondelete="CASCADE"),
        nullable=False,
    )
    umbral_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("umbrales.id", ondelete="SET NULL"),
        nullable=True,
    )
    tipo: Mapped[str] = mapped_column(
        Enum("threshold", "inactivity", name="tipo_alerta_enum"),
        nullable=False,
        default="threshold",
    )
    parametro: Mapped[str | None] = mapped_column(String(64), nullable=True)
    valor_detectado: Mapped[Decimal | None] = mapped_column(
        DECIMAL(12, 4), nullable=True
    )
    severidad: Mapped[str] = mapped_column(
        Enum("info", "warning", "critical", name="severidad_alerta_enum"),
        nullable=False,
    )
    mensaje: Mapped[str] = mapped_column(String(255), nullable=False)
    marca_tiempo: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    leida: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    leida_en: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    notificada_email: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    notificada_whatsapp: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    recomendacion_ia: Mapped[str | None] = mapped_column(Text, nullable=True)
    recomendacion_ia_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    recomendacion_ia_generada_en: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    recomendacion_ia_metadata: Mapped[str | None] = mapped_column(Text, nullable=True)

    node: Mapped["Node"] = relationship("Node", back_populates="alerts")
    irrigation_area: Mapped["IrrigationArea"] = relationship(
        "IrrigationArea", back_populates="alerts"
    )
    threshold: Mapped["Threshold | None"] = relationship(
        "Threshold", back_populates="alerts"
    )

    __table_args__ = (
        Index("idx_alertas_area_tiempo", "area_riego_id", "marca_tiempo"),
        Index("idx_alertas_nodo_tiempo", "nodo_id", "marca_tiempo"),
        Index("idx_alertas_no_leidas", "area_riego_id", "leida", "marca_tiempo"),
    )
