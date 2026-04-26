from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base
from app.models.base import TimestampMixin


class AIReport(Base, TimestampMixin):
    __tablename__ = "reportes_ia"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    cliente_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("clientes.id", ondelete="CASCADE"),
        nullable=False,
    )
    area_riego_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("areas_riego.id", ondelete="SET NULL"),
        nullable=True,
    )
    rango_inicio: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    rango_fin: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    estado: Mapped[str] = mapped_column(
        Enum(
            "pending",
            "processing",
            "completed",
            "failed",
            name="estado_reporte_ia_enum",
        ),
        nullable=False,
        default="pending",
    )
    resumen: Mapped[str | None] = mapped_column(Text, nullable=True)
    hallazgos: Mapped[str | None] = mapped_column(Text, nullable=True)
    recomendacion: Mapped[str | None] = mapped_column(Text, nullable=True)
    metadatos_generacion: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_detalle: Mapped[str | None] = mapped_column(Text, nullable=True)
    generado_en: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    client: Mapped["Client"] = relationship("Client", back_populates="ai_reports")
    irrigation_area: Mapped["IrrigationArea | None"] = relationship(
        "IrrigationArea", back_populates="ai_reports"
    )

    __table_args__ = (
        Index("idx_reportes_ia_cliente_rango", "cliente_id", "rango_inicio", "rango_fin"),
        Index("idx_reportes_ia_area_rango", "area_riego_id", "rango_inicio", "rango_fin"),
        Index("idx_reportes_ia_estado_creado", "estado", "creado_en"),
    )
