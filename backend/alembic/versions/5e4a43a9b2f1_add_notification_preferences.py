"""add_notification_preferences

Revision ID: 5e4a43a9b2f1
Revises: 39b6df94a95f
Create Date: 2026-04-18 10:45:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "5e4a43a9b2f1"
down_revision: Union[str, Sequence[str], None] = "39b6df94a95f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "clientes",
        sa.Column(
            "notificaciones_habilitadas",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("1"),
        ),
    )

    op.create_table(
        "preferencias_notificacion",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("cliente_id", sa.Integer(), nullable=False),
        sa.Column("area_riego_id", sa.Integer(), nullable=False),
        sa.Column(
            "tipo_alerta",
            sa.Enum("threshold", "inactivity", name="tipo_alerta_enum"),
            nullable=False,
        ),
        sa.Column(
            "severidad",
            sa.Enum("info", "warning", "critical", name="severidad_alerta_enum"),
            nullable=False,
        ),
        sa.Column(
            "canal",
            sa.Enum("email", "whatsapp", name="canal_notificacion_enum"),
            nullable=False,
        ),
        sa.Column("habilitado", sa.Boolean(), nullable=False),
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
        sa.ForeignKeyConstraint(["cliente_id"], ["clientes.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["area_riego_id"], ["areas_riego.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "cliente_id",
            "area_riego_id",
            "tipo_alerta",
            "severidad",
            "canal",
            name="uq_preferencias_notificacion_scope",
        ),
    )
    op.create_index(
        "idx_pref_notif_cliente",
        "preferencias_notificacion",
        ["cliente_id"],
        unique=False,
    )
    op.create_index(
        "idx_pref_notif_area",
        "preferencias_notificacion",
        ["area_riego_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_pref_notif_area", table_name="preferencias_notificacion")
    op.drop_index("idx_pref_notif_cliente", table_name="preferencias_notificacion")
    op.drop_table("preferencias_notificacion")
    op.drop_column("clientes", "notificaciones_habilitadas")
