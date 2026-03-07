from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, func
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

    # Relationships
    node: Mapped["Node"] = relationship("Node", back_populates="readings")
    soil: Mapped["ReadingSoil | None"] = relationship(
        "ReadingSoil", back_populates="reading", uselist=False
    )
    irrigation: Mapped["ReadingIrrigation | None"] = relationship(
        "ReadingIrrigation", back_populates="reading", uselist=False
    )
    environmental: Mapped["ReadingEnvironmental | None"] = relationship(
        "ReadingEnvironmental", back_populates="reading", uselist=False
    )

    __table_args__ = (
        Index("idx_lecturas_nodo_tiempo", "nodo_id", "marca_tiempo"),
        Index("idx_lecturas_tiempo", "marca_tiempo"),
    )
