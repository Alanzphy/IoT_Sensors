"""add_ai_recommendation_fields_to_alerts

Revision ID: b71f4c6e9a22
Revises: 8f9c1d2b7a11
Create Date: 2026-04-26 00:40:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b71f4c6e9a22"
down_revision: Union[str, Sequence[str], None] = "8f9c1d2b7a11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("alertas", sa.Column("recomendacion_ia", sa.Text(), nullable=True))
    op.add_column(
        "alertas", sa.Column("recomendacion_ia_error", sa.Text(), nullable=True)
    )
    op.add_column(
        "alertas",
        sa.Column("recomendacion_ia_generada_en", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "alertas",
        sa.Column("recomendacion_ia_metadata", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("alertas", "recomendacion_ia_metadata")
    op.drop_column("alertas", "recomendacion_ia_generada_en")
    op.drop_column("alertas", "recomendacion_ia_error")
    op.drop_column("alertas", "recomendacion_ia")
