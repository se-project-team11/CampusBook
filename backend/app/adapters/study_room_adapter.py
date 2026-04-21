"""
StudyRoomAdapter — Concrete adapter for Library Management System resources.

In prototype: queries our own PostgreSQL database (BookingRow, ResourceRow).
In production: would call library_api_client.get_availability(slot) to
interface with the university library's existing booking system.

Pattern: Adapter (GoF) — adapts the internal DB schema to the ResourceAdapter
         interface that BookingService expects.
"""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.resource_adapter import ResourceAdapter, ResourceDTO
from app.db.models import BookingRow, ResourceRow
from app.models.time_slot import TimeSlot


class StudyRoomAdapter(ResourceAdapter):
    """
    Adapter for Library Management System.
    In prototype: queries our own DB.
    In production: would call library_api_client.get_availability(slot).
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    async def check_availability(self, slot: TimeSlot, resource_id: UUID) -> bool:
        """
        Check if any active booking exists for this resource and slot.
        Returns True if the slot is available (no conflicting booking found).
        """
        result = await self._session.execute(
            select(BookingRow).where(
                BookingRow.resource_id == resource_id,
                BookingRow.slot_start == slot.start,
                BookingRow.slot_end == slot.end,
                BookingRow.state.notin_(["RELEASED", "NO_SHOW"]),
            )
        )
        return result.scalar_one_or_none() is None

    async def get_details(self, id: UUID) -> ResourceDTO:
        """Fetch resource details from DB and return as ResourceDTO."""
        result = await self._session.execute(
            select(ResourceRow).where(ResourceRow.id == id)
        )
        row = result.scalar_one_or_none()
        if not row:
            raise ValueError(f"Resource {id} not found")
        return ResourceDTO(
            id=row.id,
            name=row.name,
            type=row.type,
            capacity=row.capacity,
            location=row.location,
            amenities=row.amenities or [],
        )

    async def reserve_slot(self, slot: TimeSlot, user_id: UUID) -> None:
        """No-op in prototype — handled by BookingService pessimistic lock."""
        pass

    async def release_slot(self, slot: TimeSlot) -> None:
        """No-op in prototype — handled by state machine."""
        pass
