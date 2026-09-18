"""Persist telemetry idempotency keys and request fingerprints.

Revision ID: d4a8c2e67190
Revises: c2f7a1d94e30
"""

from alembic import op
import sqlalchemy as sa

revision = "d4a8c2e67190"
down_revision = "c2f7a1d94e30"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Existing readings retain NULL keys; MySQL allows multiple NULLs in a
    # unique index, so historical data needs no invented event IDs or backfill.
    op.add_column("lecturas", sa.Column("event_id", sa.String(36), nullable=True))
    op.add_column("lecturas", sa.Column("payload_hash", sa.String(64), nullable=True))
    op.create_index("uq_lecturas_nodo_event_id", "lecturas", ["nodo_id", "event_id"], unique=True)


def downgrade() -> None:
    op.drop_index("uq_lecturas_nodo_event_id", table_name="lecturas")
    op.drop_column("lecturas", "payload_hash")
    op.drop_column("lecturas", "event_id")
