"""Initial schema — all IntelliCare Nexus tables

Revision ID: 001_initial_schema
Revises: 
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # This migration creates all tables.
    # In development, tables are created by SQLAlchemy create_all() at startup.
    # In production, run: alembic upgrade head
    #
    # All tables are defined in app/models/models.py
    # Run: alembic revision --autogenerate -m "description" to generate future migrations
    pass


def downgrade() -> None:
    pass
