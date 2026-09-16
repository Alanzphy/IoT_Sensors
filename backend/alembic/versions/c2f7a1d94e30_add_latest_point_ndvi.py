"""add latest point NDVI snapshot

Revision ID: c2f7a1d94e30
Revises: b71f4c6e9a22
Create Date: 2026-09-15 06:15:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "c2f7a1d94e30"
down_revision: Union[str, Sequence[str], None] = "b71f4c6e9a22"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ndvi_ultimos",
        sa.Column("area_riego_id", sa.Integer(), nullable=False),
        sa.Column("ndvi", sa.Double(), nullable=False),
        sa.Column("proveedor", sa.Text(), nullable=False),
        sa.Column("coleccion", sa.String(length=32), nullable=False),
        sa.Column("escena_id", sa.Text(), nullable=False),
        sa.Column("escena_observada_en", sa.Text(), nullable=False),
        sa.Column("cobertura_nubes_porcentaje", sa.Double(), nullable=False),
        sa.Column("metodo_muestreo", sa.String(length=16), nullable=False),
        sa.Column("creado_en", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("actualizado_en", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("ndvi >= -1 AND ndvi <= 1", name="ck_ndvi_ultimos_ndvi"),
        sa.CheckConstraint("proveedor <> ''", name="ck_ndvi_ultimos_proveedor"),
        sa.CheckConstraint("coleccion = 'sentinel-2-l2a'", name="ck_ndvi_ultimos_coleccion"),
        sa.CheckConstraint("escena_id <> ''", name="ck_ndvi_ultimos_escena_id"),
        sa.CheckConstraint(
            "cobertura_nubes_porcentaje >= 0 AND cobertura_nubes_porcentaje <= 100",
            name="ck_ndvi_ultimos_cobertura_nubes",
        ),
        sa.CheckConstraint("metodo_muestreo = 'point'", name="ck_ndvi_ultimos_muestreo"),
        sa.ForeignKeyConstraint(["area_riego_id"], ["areas_riego.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("area_riego_id"),
    )


def downgrade() -> None:
    op.drop_table("ndvi_ultimos")
