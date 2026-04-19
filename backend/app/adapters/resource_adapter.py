"""
ResourceAdapter — Target interface for the Adapter pattern.

Three heterogeneous department APIs (Library, Engineering Lab, Sports Complex)
each get one concrete adapter. BookingService calls this interface; it never
imports or instantiates a concrete adapter directly.

Pattern: Adapter (GoF) — normalises incompatible external APIs behind a
         single internal interface.
SOLID:   OCP — adding a new resource type (e.g., Parking Lot) means creating
         a new adapter class + registering it. Existing code never changes.
         DIP — BookingService depends on this ABC, not on concrete adapters.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional
from uuid import UUID

from app.models.time_slot import TimeSlot


@dataclass
class ResourceDTO:
    """
    Data Transfer Object — flat, serialisable representation of a resource.
    Used to decouple the adapter layer from the ORM layer (no SQLAlchemy
    objects leak across the boundary).
    """
    id:        UUID
    name:      str
    type:      str
    capacity:  int
    location:  str
    amenities: list[str]


class ResourceAdapter(ABC):
    """
    Adapter pattern — Target interface.
    Three heterogeneous department APIs each get one adapter.
    BookingService calls this interface; never a concrete adapter.
    """

    @abstractmethod
    async def check_availability(self, slot: TimeSlot) -> bool:
        """Return True if the resource is available for the given time slot."""
        ...

    @abstractmethod
    async def get_details(self, id: UUID) -> ResourceDTO:
        """Return resource details as a ResourceDTO. Raises ValueError if not found."""
        ...

    @abstractmethod
    async def reserve_slot(self, slot: TimeSlot, user_id: UUID) -> None:
        """
        Reserve a slot in the external system.
        In prototype: no-op (handled by BookingService pessimistic lock).
        In production: would call the external department API.
        """
        ...

    @abstractmethod
    async def release_slot(self, slot: TimeSlot) -> None:
        """
        Release a previously reserved slot in the external system.
        In prototype: no-op (handled by state machine).
        In production: would call the external department API.
        """
        ...
