"""
LabAdapter — Concrete adapter for Engineering/Science Lab resources.

In prototype: queries our own PostgreSQL database.
In production: would call the department lab scheduling API.

Pattern: Adapter (GoF) — same interface as StudyRoomAdapter, different
         class name for future extensibility (e.g., lab-specific availability
         rules like equipment checks, safety clearance).
"""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.resource_adapter import ResourceAdapter, ResourceDTO
from app.db.models import BookingRow, ResourceRow
from app.models.time_slot import TimeSlot


class LabAdapter(ResourceAdapter):
    """
    Adapter for Department Lab Scheduling System.
    In prototype: queries our own DB.
    In production: would call lab_scheduling_api.check_slot(slot).
    """

    def __init__(self, session: AsyncSession):
        self._session = session

    async def check_availability(self, slot: TimeSlot) -> bool:
        """Check if any active booking exists for this slot."""
        result = await self._session.execute(
            select(BookingRow).where(
                BookingRow.slot_start == slot.start,
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
