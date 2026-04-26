"""add_ai_reports_table

Revision ID: 8f9c1d2b7a11
Revises: 2bc2e0e0d4a6
Create Date: 2026-04-25 23:20:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8f9c1d2b7a11"
down_revision: Union[str, Sequence[str], None] = "2bc2e0e0d4a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "reportes_ia",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("cliente_id", sa.Integer(), nullable=False),
        sa.Column("area_riego_id", sa.Integer(), nullable=True),
        sa.Column("rango_inicio", sa.DateTime(), nullable=False),
        sa.Column("rango_fin", sa.DateTime(), nullable=False),
        sa.Column(
            "estado",
            sa.Enum(
                "pending",
                "processing",
                "completed",
                "failed",
                name="estado_reporte_ia_enum",
            ),
            nullable=False,
        ),
        sa.Column("resumen", sa.Text(), nullable=True),
        sa.Column("hallazgos", sa.Text(), nullable=True),
        sa.Column("recomendacion", sa.Text(), nullable=True),
        sa.Column("metadatos_generacion", sa.Text(), nullable=True),
        sa.Column("error_detalle", sa.Text(), nullable=True),
        sa.Column("generado_en", sa.DateTime(), nullable=True),
        sa.Column("creado_en", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("actualizado_en", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["cliente_id"],
            ["clientes.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["area_riego_id"],
            ["areas_riego.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_reportes_ia_cliente_rango",
        "reportes_ia",
        ["cliente_id", "rango_inicio", "rango_fin"],
        unique=False,
    )
    op.create_index(
        "idx_reportes_ia_area_rango",
        "reportes_ia",
        ["area_riego_id", "rango_inicio", "rango_fin"],
        unique=False,
    )
    op.create_index(
        "idx_reportes_ia_estado_creado",
        "reportes_ia",
        ["estado", "creado_en"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_reportes_ia_estado_creado", table_name="reportes_ia")
    op.drop_index("idx_reportes_ia_area_rango", table_name="reportes_ia")
    op.drop_index("idx_reportes_ia_cliente_rango", table_name="reportes_ia")
    op.drop_table("reportes_ia")
