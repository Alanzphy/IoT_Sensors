from decimal import Decimal

from sqlalchemy import BigInteger, DECIMAL, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class ReadingSoil(Base):
    __tablename__ = "lecturas_suelo"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    lectura_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("lecturas.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    conductividad: Mapped[Decimal | None] = mapped_column(
        DECIMAL(8, 3), nullable=True, default=None
    )
    temperatura: Mapped[Decimal | None] = mapped_column(
        DECIMAL(6, 2), nullable=True, default=None
    )
    humedad: Mapped[Decimal | None] = mapped_column(
        DECIMAL(6, 2), nullable=True, default=None
    )
    potencial_hidrico: Mapped[Decimal | None] = mapped_column(
        DECIMAL(8, 4), nullable=True, default=None
    )

    # Relationships
    reading: Mapped["Reading"] = relationship("Reading", back_populates="soil")
