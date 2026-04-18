"""add_password_recovery_tokens

Revision ID: 2bc2e0e0d4a6
Revises: 5e4a43a9b2f1
Create Date: 2026-04-18 13:40:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "2bc2e0e0d4a6"
down_revision: Union[str, Sequence[str], None] = "5e4a43a9b2f1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "tokens_recuperacion",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("expira_en", sa.DateTime(), nullable=False),
        sa.Column(
            "creado_en",
            sa.DateTime(),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("usado_en", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )
    op.create_index(
        "idx_tokens_recuperacion_usuario_id",
        "tokens_recuperacion",
        ["usuario_id"],
        unique=False,
    )
    op.create_index(
        "idx_tokens_recuperacion_expira_en",
        "tokens_recuperacion",
        ["expira_en"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_tokens_recuperacion_expira_en", table_name="tokens_recuperacion")
    op.drop_index(
        "idx_tokens_recuperacion_usuario_id", table_name="tokens_recuperacion"
    )
    op.drop_table("tokens_recuperacion")
