from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    func,
    DECIMAL,
    Boolean,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class Reading(Base):
    __tablename__ = "lecturas"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    nodo_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("nodos.id", ondelete="CASCADE"), nullable=False
    )
    marca_tiempo: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    # Datos Suelo
    suelo_conductividad: Mapped[Decimal | None] = mapped_column(
        DECIMAL(8, 3), nullable=True
    )
    suelo_temperatura: Mapped[Decimal | None] = mapped_column(
        DECIMAL(6, 2), nullable=True
    )
    suelo_humedad: Mapped[Decimal | None] = mapped_column(DECIMAL(6, 2), nullable=True)
    suelo_potencial_hidrico: Mapped[Decimal | None] = mapped_column(
        DECIMAL(8, 4), nullable=True
    )

    # Datos Riego
    riego_activo: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    riego_litros_acumulados: Mapped[Decimal | None] = mapped_column(
        DECIMAL(12, 2), nullable=True
    )
    riego_flujo_por_minuto: Mapped[Decimal | None] = mapped_column(
        DECIMAL(8, 2), nullable=True
    )

    # Datos Ambientales
    ambiental_temperatura: Mapped[Decimal | None] = mapped_column(
        DECIMAL(6, 2), nullable=True
    )
    ambiental_humedad_relativa: Mapped[Decimal | None] = mapped_column(
        DECIMAL(6, 2), nullable=True
    )
    ambiental_velocidad_viento: Mapped[Decimal | None] = mapped_column(
        DECIMAL(7, 2), nullable=True
    )
    ambiental_radiacion_solar: Mapped[Decimal | None] = mapped_column(
        DECIMAL(8, 2), nullable=True
    )
    ambiental_eto: Mapped[Decimal | None] = mapped_column(DECIMAL(6, 3), nullable=True)

    # Relationships
    node: Mapped["Node"] = relationship("Node", back_populates="readings")

    __table_args__ = (
        Index("idx_lecturas_nodo_tiempo", "nodo_id", "marca_tiempo"),
        Index("idx_lecturas_tiempo", "marca_tiempo"),
    )

    @property
    def soil(self):
        return self

    @property
    def irrigation(self):
        return self

    @property
    def environmental(self):
        return self
