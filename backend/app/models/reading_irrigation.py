from decimal import Decimal

from sqlalchemy import BigInteger, Boolean, DECIMAL, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class ReadingIrrigation(Base):
    __tablename__ = "lecturas_riego"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    lectura_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("lecturas.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    activo: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=None)
    litros_acumulados: Mapped[Decimal | None] = mapped_column(
        DECIMAL(12, 2), nullable=True, default=None
    )
    flujo_por_minuto: Mapped[Decimal | None] = mapped_column(
        DECIMAL(8, 2), nullable=True, default=None
    )

    # Relationships
    reading: Mapped["Reading"] = relationship("Reading", back_populates="irrigation")
