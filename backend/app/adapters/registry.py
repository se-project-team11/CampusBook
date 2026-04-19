"""
AdapterRegistry — Factory that maps resource type → ResourceAdapter.

SOLID OCP: Adding a new resource type (e.g., Parking Lot) requires only:
  1. Create ParkingAdapter(ResourceAdapter)
  2. Register "PARKING": ParkingAdapter(session) here
  BookingService never changes.

GRASP Protected Variation: BookingService is shielded from knowing which
adapter handles which resource type. The registry is the single point of
variation.
"""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.resource_adapter import ResourceAdapter
from app.adapters.study_room_adapter import StudyRoomAdapter
from app.adapters.lab_adapter import LabAdapter
from app.adapters.sports_adapter import SportsAdapter
from app.db.models import ResourceRow


class AdapterRegistry:
    """
    Factory that returns the appropriate ResourceAdapter for a resource's type.
    SOLID OCP: adding a new resource type = add new adapter + register here.
    BookingService never changes.
    """

    def __init__(self, session: AsyncSession):
        self._session = session
        self._adapters: dict[str, ResourceAdapter] = {
            "STUDY_ROOM": StudyRoomAdapter(session),
            "LAB":        LabAdapter(session),
            "SPORTS":     SportsAdapter(session),
            "SEMINAR":    StudyRoomAdapter(session),  # same rules as study room
        }

    async def get_for_resource(self, resource_id: UUID) -> ResourceAdapter:
        """
        Look up the resource's type in the database, then return the
        matching adapter instance.

        Raises:
            ValueError: if resource_id doesn't exist or type is unknown.
        """
        result = await self._session.execute(
            select(ResourceRow).where(ResourceRow.id == resource_id)
        )
        row = result.scalar_one_or_none()
        if not row:
            raise ValueError(f"Resource {resource_id} not found")
        adapter = self._adapters.get(row.type)
        if not adapter:
            raise ValueError(
                f"No adapter registered for resource type '{row.type}'"
            )
        return adapter
