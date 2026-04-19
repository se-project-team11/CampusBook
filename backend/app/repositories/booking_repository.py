from __future__ import annotations

from abc import ABC, abstractmethod
from typing import List, Optional
from uuid import UUID

from app.models.booking import Booking, BookingState
from app.models.time_slot import TimeSlot


class BookingRepository(ABC):
    """
    Repository pattern — data access interface for Booking entities.

    WHY THIS EXISTS:
    BookingService (high-level domain logic) must not depend on PostgreSQL,
    SQLAlchemy, or any ORM concept. This interface is the abstraction that
    allows BookingService to be tested without a database and deployed against
    any storage backend.

    DIP: BookingService depends on this ABC, not on PostgresBookingRepository.
    LSP: PostgresBookingRepository and InMemoryBookingRepository are fully
         substitutable — BookingService cannot tell the difference.
    ISP: Only 5 methods — exactly what the booking engine needs. Analytics
         queries belong in a separate AnalyticsRepository.

    IMPLEMENTATIONS:
      PostgresBookingRepository — production (SQLAlchemy async)
      InMemoryBookingRepository — unit tests (dict, no DB connection)
    """

    @abstractmethod
    async def save(self, booking: Booking, db=None) -> None:
        """
        Persist a new booking. Must be called inside an open DB transaction
        when db is provided (pessimistic lock flow). If db is None, the
        implementation manages its own session.
        """
        ...

    @abstractmethod
    async def find_by_id(self, booking_id: UUID) -> Optional[Booking]:
        """Return booking or None if not found."""
        ...

    @abstractmethod
    async def find_active_by_slot(
        self, resource_id: UUID, slot: TimeSlot
    ) -> List[Booking]:
        """
        Return all non-terminal bookings for (resource_id, slot_start).
        Used inside the pessimistic lock check in BookingService.
        """
        ...

    @abstractmethod
    async def find_by_user(self, user_id: UUID) -> List[Booking]:
        """Return all bookings for a user, ordered by created_at desc."""
        ...

    @abstractmethod
    async def update_state(
        self, booking_id: UUID, new_state: str, db=None
    ) -> None:
        """
        Persist a state change after BookingStateMgr.transition() succeeds.
        Must be called after the in-memory transition to keep DB in sync.
        """
        ...
