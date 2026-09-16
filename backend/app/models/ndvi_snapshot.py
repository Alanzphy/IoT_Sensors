from sqlalchemy import CheckConstraint, Double, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.base import TimestampMixin


class NDVILatestSnapshot(Base, TimestampMixin):
    __tablename__ = "ndvi_ultimos"

    area_riego_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("areas_riego.id", ondelete="CASCADE"),
        primary_key=True,
    )
    ndvi: Mapped[float] = mapped_column(Double, nullable=False)
    proveedor: Mapped[str] = mapped_column(Text, nullable=False)
    coleccion: Mapped[str] = mapped_column(String(32), nullable=False)
    escena_id: Mapped[str] = mapped_column(Text, nullable=False)
    escena_observada_en: Mapped[str] = mapped_column(Text, nullable=False)
    cobertura_nubes_porcentaje: Mapped[float] = mapped_column(Double, nullable=False)
    metodo_muestreo: Mapped[str] = mapped_column(String(16), nullable=False)

    __table_args__ = (
        CheckConstraint("ndvi >= -1 AND ndvi <= 1", name="ck_ndvi_ultimos_ndvi"),
        CheckConstraint("proveedor <> ''", name="ck_ndvi_ultimos_proveedor"),
        CheckConstraint("coleccion = 'sentinel-2-l2a'", name="ck_ndvi_ultimos_coleccion"),
        CheckConstraint("escena_id <> ''", name="ck_ndvi_ultimos_escena_id"),
        CheckConstraint(
            "cobertura_nubes_porcentaje >= 0 AND cobertura_nubes_porcentaje <= 100",
            name="ck_ndvi_ultimos_cobertura_nubes",
        ),
        CheckConstraint("metodo_muestreo = 'point'", name="ck_ndvi_ultimos_muestreo"),
    )
