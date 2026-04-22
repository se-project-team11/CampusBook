from __future__ import annotations

from typing import Dict, List, Optional
from uuid import UUID

from app.models.booking import Booking, BookingState
from app.models.time_slot import TimeSlot
from app.repositories.booking_repository import BookingRepository


class InMemoryBookingRepository(BookingRepository):
    """
    Test double — in-memory dict storage, no database connection.

    Injected into BookingService during unit tests. Domain logic is tested
    in complete isolation from infrastructure. This is the Repository pattern's
    killer feature: swap concrete implementations without changing a single
    line in BookingService.

    IMPORTANT: InMemoryBookingRepository is NOT thread-safe. It is intended
    only for synchronous unit tests (pytest without real concurrent DB).
    """

    def __init__(self) -> None:
        self._store: Dict[UUID, Booking] = {}

    async def save(self, booking: Booking, db=None) -> None:
        # db param accepted but ignored — no session concept in memory
        self._store[booking.id] = booking

    async def find_by_id(self, booking_id: UUID) -> Optional[Booking]:
        return self._store.get(booking_id)

    async def find_active_by_slot(
        self, resource_id: UUID, slot: TimeSlot
    ) -> List[Booking]:
        return [
            b for b in self._store.values()
            if b.resource_id == resource_id
            and b.slot_start == slot.start
            and b.slot_end   == slot.end
            and b.state not in (BookingState.RELEASED, BookingState.NO_SHOW)
        ]

    async def find_by_user(self, user_id: UUID) -> List[Booking]:
        return [b for b in self._store.values() if b.user_id == user_id]

    async def find_active_bookings(self) -> List[Booking]:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        return [
            b for b in self._store.values()
            if b.state in (BookingState.CONFIRMED, BookingState.CHECKED_IN)
            and b.slot_end > now
        ]

    async def find_pending_approvals(self) -> List[Booking]:
        return [
            b for b in self._store.values()
            if b.state == BookingState.RESERVED and getattr(b, 'requires_approval', False)
        ]

    async def update_state(
        self, booking_id: UUID, new_state: str, db=None
    ) -> None:
        if booking_id in self._store:
            self._store[booking_id].state = BookingState(new_state)

    # ── Test helpers ─────────────────────────────────────────────────────────

    def count(self) -> int:
        """Return total number of stored bookings. Useful in assertions."""
        return len(self._store)

    def all(self) -> List[Booking]:
        """Return all stored bookings. Useful for verifying test state."""
        return list(self._store.values())

    def clear(self) -> None:
        """Reset store between tests."""
        self._store.clear()
