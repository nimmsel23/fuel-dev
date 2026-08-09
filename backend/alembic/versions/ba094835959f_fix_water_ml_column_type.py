"""Fix water_ml column type (SQLite-compatible noop)

Revision ID: ba094835959f
Revises: c1fbe6c436a6
Create Date: 2026-07-10 07:25:27.561458

Hinweis: Diese Migration war ursprünglich für PostgreSQL geschrieben.
SQLite unterstützt ALTER COLUMN ... TYPE nicht nativ — es ist ein noop
für SQLite-Datenbanken. Das Schema bereits gültiger Tabellen wird
beibehalten.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'ba094835959f'
down_revision: Union[str, Sequence[str], None] = 'c1fbe6c436a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # SQLite unterstützt ALTER COLUMN ... TYPE nicht — noop
    # Die water_ml Spalte ist bereits vom korrekten Typ (Integer) seit
    # der Initialen Migration.
    pass


def downgrade() -> None:
    """Downgrade schema."""
    # noop
    pass
