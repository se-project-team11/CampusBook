"""Initial schema: resources, bookings, domain_events, waitlist

Revision ID: 001
Revises:
Create Date: 2026-04-15

The EXCLUDE constraint is the DB-level guarantee against overlapping bookings.
Even if app-level pessimistic locking fails, this constraint prevents corrupt data.
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Extension: required for EXCLUDE USING GIST ───────────────────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    # ── resources ────────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE resources (
            id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name      TEXT NOT NULL,
            type      TEXT NOT NULL
                CHECK (type IN ('STUDY_ROOM', 'LAB', 'SPORTS', 'SEMINAR')),
            capacity  INTEGER NOT NULL CHECK (capacity > 0),
            location  TEXT NOT NULL,
            amenities JSONB NOT NULL DEFAULT '[]'::jsonb
        )
    """)

    # Index: resource search page filters by type
    op.execute("CREATE INDEX ix_resources_type ON resources (type)")

    # ── bookings ─────────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE bookings (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id           UUID NOT NULL,
            resource_id       UUID NOT NULL REFERENCES resources(id) ON DELETE RESTRICT,
            slot_start        TIMESTAMPTZ NOT NULL,
            slot_end          TIMESTAMPTZ NOT NULL,
            state             TEXT NOT NULL DEFAULT 'RESERVED'
                CHECK (state IN ('RESERVED', 'CONFIRMED', 'CHECKED_IN', 'NO_SHOW', 'RELEASED')),
            qr_token          TEXT UNIQUE,
            requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
            notes             TEXT NOT NULL DEFAULT '',
            created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at        TIMESTAMPTZ,

            -- Sanity check: slot_end must be after slot_start
            CONSTRAINT chk_slot_order CHECK (slot_end > slot_start),

            -- EXCLUDE constraint: the primary double-booking prevention at DB level.
            -- Belt-and-suspenders alongside pessimistic locking in BookingService.
            -- tstzrange '[)': inclusive start, exclusive end (standard interval convention).
            -- Only enforced on active bookings — RELEASED and NO_SHOW slots are freed.
            EXCLUDE USING GIST (
                resource_id WITH =,
                tstzrange(slot_start, slot_end, '[)') WITH &&
            ) WHERE (state NOT IN ('RELEASED', 'NO_SHOW'))
        )
    """)

    # Index 1: most frequent query — find active bookings for (resource, slot)
    # Used by: BookingService pessimistic lock check, CatalogueService availability grid
    op.execute("""
        CREATE INDEX ix_bookings_resource_slot
        ON bookings (resource_id, slot_start, slot_end)
        WHERE state NOT IN ('RELEASED', 'NO_SHOW')
    """)
    # Partial index: only active bookings — significantly smaller, faster for conflict checks

    # Index 2: student dashboard — all bookings by user
    op.execute("CREATE INDEX ix_bookings_user_id ON bookings (user_id)")

    # Index 3: CheckInService queries CONFIRMED bookings on TTL expiry
    op.execute("CREATE INDEX ix_bookings_state ON bookings (state)")

    # ── domain_events ─────────────────────────────────────────────────────────
    # Append-only audit log. No updates or deletes ever happen to this table.
    op.execute("""
        CREATE TABLE domain_events (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_type  TEXT NOT NULL,
            payload     JSONB NOT NULL,
            occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # Index: analytics queries by event type (e.g. count all NoShowTriggered events)
    op.execute("CREATE INDEX ix_domain_events_type ON domain_events (event_type)")
    # Index: time-range queries for audit log review
    op.execute("CREATE INDEX ix_domain_events_occurred_at ON domain_events (occurred_at)")

    # ── waitlist ─────────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE waitlist (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
            slot_start  TIMESTAMPTZ NOT NULL,
            slot_end    TIMESTAMPTZ NOT NULL,
            user_id     UUID NOT NULL,
            position    INTEGER NOT NULL CHECK (position > 0),
            joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            -- Prevent a user from joining the same slot's waitlist twice
            CONSTRAINT uq_waitlist_user_slot UNIQUE (resource_id, slot_start, user_id)
        )
    """)

    # Index: promote next entry — query (resource, slot) ORDER BY position LIMIT 1
    op.execute("""
        CREATE INDEX ix_waitlist_resource_slot_position
        ON waitlist (resource_id, slot_start, position)
    """)


def downgrade() -> None:
    # Drop in reverse dependency order

    # Indexes first
    op.execute("DROP INDEX IF EXISTS ix_waitlist_resource_slot_position")
    op.execute("DROP INDEX IF EXISTS ix_domain_events_occurred_at")
    op.execute("DROP INDEX IF EXISTS ix_domain_events_type")
    op.execute("DROP INDEX IF EXISTS ix_bookings_state")
    op.execute("DROP INDEX IF EXISTS ix_bookings_user_id")
    op.execute("DROP INDEX IF EXISTS ix_bookings_resource_slot")
    op.execute("DROP INDEX IF EXISTS ix_resources_type")

    # Tables (bookings before resources due to FK)
    op.execute("DROP TABLE IF EXISTS waitlist")
    op.execute("DROP TABLE IF EXISTS domain_events")
    op.execute("DROP TABLE IF EXISTS bookings")
    op.execute("DROP TABLE IF EXISTS resources")

    # Extension last — only drop if no other tables use it
    op.execute("DROP EXTENSION IF EXISTS btree_gist")