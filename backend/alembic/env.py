"""
Alembic migration environment.

  The FastAPI app uses asyncpg (async driver) but Alembic needs a SYNC connection
  to run DDL (CREATE TABLE, EXCLUDE constraints, etc.).
  Use psycopg2 via DATABASE_SYNC_URL env var for migrations only.
  The app never uses psycopg2 at runtime.

  Alternative (async Alembic with asyncio.run) works but adds complexity for no benefit —
  DDL migrations do not need to be async.
"""

import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Ensure the root directory is in the sys.path so 'app' can be imported
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import Base so Alembic autogenerate can detect model changes
from app.db.base import Base

# Import all ORM models — autogenerate requires every model to be imported
# before context.run_migrations() is called
import app.db.models  # noqa: F401

# Alembic Config object — gives access to alembic.ini values
config = context.config

# Override sqlalchemy.url with DATABASE_SYNC_URL env var if set (Docker Compose sets this)
sync_url = os.getenv("DATABASE_SYNC_URL")
if sync_url:
    config.set_main_option("sqlalchemy.url", sync_url)

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata for autogenerate support
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Run migrations without a live DB connection.
    Generates SQL script to stdout — useful for review before applying.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # Include schema-level constructs in autogenerate comparisons
        compare_type=True,
        compare_server_default=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations against a live DB connection.
    Uses psycopg2 sync driver — asyncpg cannot run Alembic DDL migrations.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,  # No pooling for migration runs
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()