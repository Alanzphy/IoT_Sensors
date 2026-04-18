"""add_phase2_thresholds_alerts_audit

Revision ID: 39b6df94a95f
Revises: 7a66ef728239
Create Date: 2026-04-17 12:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "39b6df94a95f"
down_revision: Union[str, Sequence[str], None] = "7a66ef728239"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "umbrales",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("area_riego_id", sa.Integer(), nullable=False),
        sa.Column("parametro", sa.String(length=64), nullable=False),
        sa.Column("rango_min", sa.DECIMAL(precision=12, scale=4), nullable=True),
        sa.Column("rango_max", sa.DECIMAL(precision=12, scale=4), nullable=True),
        sa.Column(
            "severidad",
            sa.Enum("info", "warning", "critical", name="severidad_alerta_enum"),
            nullable=False,
        ),
        sa.Column("activo", sa.Boolean(), nullable=False),
        sa.Column(
            "creado_en",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "actualizado_en",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("eliminado_en", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["area_riego_id"], ["areas_riego.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_umbrales_area_riego_id", "umbrales", ["area_riego_id"], unique=False
    )
    op.create_index(
        "idx_umbrales_area_parametro",
        "umbrales",
        ["area_riego_id", "parametro"],
        unique=False,
    )

    op.create_table(
        "alertas",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("nodo_id", sa.Integer(), nullable=False),
        sa.Column("area_riego_id", sa.Integer(), nullable=False),
        sa.Column("umbral_id", sa.Integer(), nullable=True),
        sa.Column(
            "tipo",
            sa.Enum("threshold", "inactivity", name="tipo_alerta_enum"),
            nullable=False,
        ),
        sa.Column("parametro", sa.String(length=64), nullable=True),
        sa.Column("valor_detectado", sa.DECIMAL(precision=12, scale=4), nullable=True),
        sa.Column(
            "severidad",
            sa.Enum("info", "warning", "critical", name="severidad_alerta_enum"),
            nullable=False,
        ),
        sa.Column("mensaje", sa.String(length=255), nullable=False),
        sa.Column("marca_tiempo", sa.DateTime(), nullable=False),
        sa.Column("leida", sa.Boolean(), nullable=False),
        sa.Column("leida_en", sa.DateTime(), nullable=True),
        sa.Column("notificada_email", sa.Boolean(), nullable=False),
        sa.Column("notificada_whatsapp", sa.Boolean(), nullable=False),
        sa.Column(
            "creado_en",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "actualizado_en",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["nodo_id"], ["nodos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["area_riego_id"], ["areas_riego.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["umbral_id"], ["umbrales.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_alertas_area_tiempo",
        "alertas",
        ["area_riego_id", "marca_tiempo"],
        unique=False,
    )
    op.create_index(
        "idx_alertas_nodo_tiempo", "alertas", ["nodo_id", "marca_tiempo"], unique=False
    )
    op.create_index(
        "idx_alertas_no_leidas",
        "alertas",
        ["area_riego_id", "leida", "marca_tiempo"],
        unique=False,
    )

    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=True),
        sa.Column("accion", sa.String(length=50), nullable=False),
        sa.Column("entidad", sa.String(length=80), nullable=False),
        sa.Column("entidad_id", sa.String(length=50), nullable=True),
        sa.Column("detalle", sa.Text(), nullable=True),
        sa.Column(
            "creado_en",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_audit_log_usuario", "audit_log", ["usuario_id"], unique=False)
    op.create_index(
        "idx_audit_log_entidad_tiempo",
        "audit_log",
        ["entidad", "creado_en"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_audit_log_entidad_tiempo", table_name="audit_log")
    op.drop_index("idx_audit_log_usuario", table_name="audit_log")
    op.drop_table("audit_log")

    op.drop_index("idx_alertas_no_leidas", table_name="alertas")
    op.drop_index("idx_alertas_nodo_tiempo", table_name="alertas")
    op.drop_index("idx_alertas_area_tiempo", table_name="alertas")
    op.drop_table("alertas")

    op.drop_index("idx_umbrales_area_parametro", table_name="umbrales")
    op.drop_index("idx_umbrales_area_riego_id", table_name="umbrales")
    op.drop_table("umbrales")
