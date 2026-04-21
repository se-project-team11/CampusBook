"""
CatalogueService — Resource search and availability grid.

Responsible for GET /api/resources and GET /api/resources/{id}/availability.
Implements Redis response caching (TTL=30s) to improve read performance.

Cache keys:
  - resources:{type}:{capacity}:{location} -> List[ResourceDTO]
  - availability:{resource_id}:{date}      -> List[TimeSlotAvailability]
"""
import json
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import BookingRow, ResourceRow


class CatalogueService:
    """
    Service for resource discovery and availability checking.
    Uses Redis caching to reduce database load.
    """

    CACHE_TTL = 30  # seconds

    def __init__(self, session: AsyncSession, redis):
        self._session = session
        self._redis = redis

    async def search_resources(
        self,
        type: Optional[str] = None,
        capacity: Optional[int] = None,
        location: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search for resources matching the given filters.
        Results are cached for CACHE_TTL seconds.
        """
        # Build cache key
        cache_key = f"resources:{type or 'all'}:{capacity or 'any'}:{location or 'any'}"
        cached = await self._redis.get(cache_key)
        if cached:
            return json.loads(cached)

        # Cache miss — query DB
        query = select(ResourceRow)
        if type and type.lower() != "all":
            query = query.where(ResourceRow.type == type.upper())
        if capacity:
            query = query.where(ResourceRow.capacity >= capacity)
        if location:
            query = query.where(ResourceRow.location.ilike(f"%{location}%"))

        result = await self._session.execute(query)
        rows = result.scalars().all()

        data = [
            {
                "id": str(r.id),
                "name": r.name,
                "type": r.type,
                "capacity": r.capacity,
                "location": r.location,
                "amenities": r.amenities or [],
            }
            for r in rows
        ]

        # Save to cache
        await self._redis.set(cache_key, json.dumps(data), ex=self.CACHE_TTL)
        return data

    async def get_availability(
        self, resource_id: UUID, for_date: date
    ) -> List[Dict[str, Any]]:
        """
        Build an availability grid (1-hour slots from 8 AM to 10 PM) for a resource.
        Results are cached for CACHE_TTL seconds.
        """
        cache_key = f"availability:{resource_id}:{for_date.isoformat()}"
        cached = await self._redis.get(cache_key)
        if cached:
            return json.loads(cached)

        # Build 1-hour slots from 8 AM to 10 PM (14 slots)
        slots = []
        day_start = datetime.combine(for_date, datetime.min.time()).replace(hour=8, tzinfo=timezone.utc)
        
        for h in range(14):
            slot_start = day_start + timedelta(hours=h)
            slot_end = slot_start + timedelta(hours=1)

            # Check for any active booking in this exact slot
            result = await self._session.execute(
                select(BookingRow).where(
                    BookingRow.resource_id == resource_id,
                    BookingRow.slot_start == slot_start,
                    BookingRow.slot_end == slot_end,
                    BookingRow.state.notin_(["RELEASED", "NO_SHOW"]),
                )
            )
            booked = result.scalar_one_or_none()

            slots.append(
                {
                    "slot_start": slot_start.isoformat(),
                    "slot_end": slot_end.isoformat(),
                    "status": "BOOKED" if booked else "AVAILABLE",
                    "waitlist_count": 0,  # F4 Waitlist feature placeholder
                }
            )

        # Save to cache
        await self._redis.set(cache_key, json.dumps(slots), ex=self.CACHE_TTL)
        return slots

    async def invalidate_cache(self, resource_id: UUID, for_date: date) -> None:
        """
        Invalidate the availability cache for a resource+date.
        Called when a booking's state changes (e.g. booked, cancelled, no-show).
        """
        cache_key = f"availability:{resource_id}:{for_date.isoformat()}"
        await self._redis.delete(cache_key)
