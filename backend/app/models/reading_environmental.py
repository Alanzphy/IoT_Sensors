from decimal import Decimal

from sqlalchemy import BigInteger, DECIMAL, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class ReadingEnvironmental(Base):
    __tablename__ = "lecturas_ambiental"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    lectura_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("lecturas.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    temperatura: Mapped[Decimal | None] = mapped_column(
        DECIMAL(6, 2), nullable=True, default=None
    )
    humedad_relativa: Mapped[Decimal | None] = mapped_column(
        DECIMAL(6, 2), nullable=True, default=None
    )
    velocidad_viento: Mapped[Decimal | None] = mapped_column(
        DECIMAL(7, 2), nullable=True, default=None
    )
    radiacion_solar: Mapped[Decimal | None] = mapped_column(
        DECIMAL(8, 2), nullable=True, default=None
    )
    eto: Mapped[Decimal | None] = mapped_column(
        DECIMAL(6, 3), nullable=True, default=None
    )

    # Relationships
    reading: Mapped["Reading"] = relationship("Reading", back_populates="environmental")
