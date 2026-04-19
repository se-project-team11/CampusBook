"""
Stub implementations of BE2-owned interfaces.
Used by dependencies.py until BE2 delivers AdapterRegistry, StrategyRegistry,
and NotificationService.

These stubs make the app runnable end-to-end from Day 6 without waiting for BE2.
They always return "available=True" and "validation OK" — sufficient for demo/testing.
"""
from __future__ import annotations

from uuid import UUID

from app.models.time_slot import TimeSlot
from app.models.validation_result import ValidationResult
from app.models.domain_events import DomainEvent


class StubAdapter:
    """Always reports slot as available. Suitable for prototype demo."""
    async def check_availability(self, slot: TimeSlot) -> bool:
        return True

    async def get_details(self, id: UUID):
        return None

    async def reserve_slot(self, slot: TimeSlot, user_id: UUID) -> None:
        pass

    async def release_slot(self, slot: TimeSlot) -> None:
        pass


class StubAdapterRegistry:
    async def get_for_resource(self, resource_id: UUID) -> StubAdapter:
        return StubAdapter()


class StubStrategy:
    """Always passes validation. No approval required."""
    async def validate_async(
        self, user_id: UUID, resource_id: UUID, slot: TimeSlot
    ) -> ValidationResult:
        return ValidationResult(ok=True, needs_approval=False)


class StubStrategyRegistry:
    async def get_for_resource(self, resource_id: UUID) -> StubStrategy:
        return StubStrategy()


class StubNotificationService:
    """Prints to stdout. No email, no WebSocket. Suitable for prototype."""
    async def on_booking_event(self, event: DomainEvent) -> None:
        print(f"[STUB NOTIFICATION] {type(event).__name__}: {event.to_dict()}")
