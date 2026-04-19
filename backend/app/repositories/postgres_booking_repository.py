from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import BookingRow
from app.models.booking import Booking, BookingState
from app.models.time_slot import TimeSlot
from app.repositories.booking_repository import BookingRepository


class PostgresBookingRepository(BookingRepository):
    """
    Production implementation — PostgreSQL via SQLAlchemy async.

    The `db` parameter passed to save() and update_state() is the active
    AsyncSession from the calling BookingService transaction. This keeps
    the save + lock in the SAME transaction — critical for atomicity.

    When db=None (e.g., get_booking, get_user_bookings), the repository
    uses its own session held at construction time.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, booking: Booking, db: Optional[AsyncSession] = None) -> None:
        session = db or self._session
        row = BookingRow(
            id=booking.id,
            user_id=booking.user_id,
            resource_id=booking.resource_id,
            slot_start=booking.slot_start,
            slot_end=booking.slot_end,
            state=booking.state.value,
            qr_token=booking.qr_token,
            requires_approval=booking.requires_approval,
            notes=booking.notes,
            expires_at=booking.expires_at,
        )
        session.add(row)
        await session.flush()  # Write to DB within transaction, do not commit yet

    async def find_by_id(self, booking_id: UUID) -> Optional[Booking]:
        result = await self._session.execute(
            select(BookingRow).where(BookingRow.id == booking_id)
        )
        row = result.scalar_one_or_none()
        return self._to_domain(row) if row else None

    async def find_active_by_slot(
        self, resource_id: UUID, slot: TimeSlot
    ) -> List[Booking]:
        """
        Returns non-terminal bookings for (resource_id, slot_start).
        Used inside the pessimistic lock check — if this list is non-empty,
        the slot is taken and the current request must fail with 409.
        """
        result = await self._session.execute(
            select(BookingRow).where(
                BookingRow.resource_id == resource_id,
                BookingRow.slot_start  == slot.start,
                BookingRow.slot_end    == slot.end,
                BookingRow.state.notin_(
                    [BookingState.RELEASED.value, BookingState.NO_SHOW.value]
                ),
            )
        )
        return [self._to_domain(r) for r in result.scalars().all()]

    async def find_by_user(self, user_id: UUID) -> List[Booking]:
        result = await self._session.execute(
            select(BookingRow)
            .where(BookingRow.user_id == user_id)
            .order_by(BookingRow.created_at.desc())
        )
        return [self._to_domain(r) for r in result.scalars().all()]

    async def update_state(
        self, booking_id: UUID, new_state: str, db: Optional[AsyncSession] = None
    ) -> None:
        session = db or self._session
        await session.execute(
            update(BookingRow)
            .where(BookingRow.id == booking_id)
            .values(state=new_state)
        )

    # ── Private helpers ──────────────────────────────────────────────────────

    @staticmethod
    def _to_domain(row: BookingRow) -> Booking:
        """Convert ORM row → domain Booking. No ORM objects leak outside this class."""
        return Booking(
            id=row.id,
            user_id=row.user_id,
            resource_id=row.resource_id,
            slot_start=row.slot_start,
            slot_end=row.slot_end,
            state=BookingState(row.state),
            qr_token=row.qr_token,
            requires_approval=row.requires_approval,
            notes=row.notes or "",
            expires_at=row.expires_at,
        )
