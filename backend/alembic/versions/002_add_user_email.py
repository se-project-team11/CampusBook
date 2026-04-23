"""add user_email

Revision ID: 002
Revises: 001
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.add_column('bookings', sa.Column('user_email', sa.String(length=255), nullable=True))

def downgrade() -> None:
    op.drop_column('bookings', 'user_email')
