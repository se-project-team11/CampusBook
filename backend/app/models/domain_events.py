from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID


@dataclass
class DomainEvent:
    """
    Base class for all domain events emitted by BookingService.
    Events are append-only — never mutated after creation.
    Each subclass must implement to_dict() for persistence in domain_events table.

    Pattern: Domain Events (Evans DDD) — decouples NotificationService from
    BookingService. BookingService emits; NotificationService observes.
    """
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> dict:
        raise NotImplementedError(
            f"{type(self).__name__} must implement to_dict()"
        )


@dataclass
class BookingCreated(DomainEvent):
    """
    Emitted when BookingService.create_booking() succeeds.
    Triggers: email confirmation, WebSocket grid update, Redis TTL write.
    """
    booking_id:  UUID     = None
    user_id:     UUID     = None
    resource_id: UUID     = None
    slot_start:  datetime = None
    slot_end:    datetime = None

    def to_dict(self) -> dict:
        return {
            "booking_id":  str(self.booking_id),
            "user_id":     str(self.user_id),
            "resource_id": str(self.resource_id),
            "slot_start":  self.slot_start.isoformat() if self.slot_start else None,
            "slot_end":    self.slot_end.isoformat() if self.slot_end else None,
            "occurred_at": self.occurred_at.isoformat(),
        }


@dataclass
class BookingCancelled(DomainEvent):
    """Emitted when a CONFIRMED booking is cancelled by the user."""
    booking_id:  UUID = None
    user_id:     UUID = None
    resource_id: UUID = None

    def to_dict(self) -> dict:
        return {
            "booking_id":  str(self.booking_id),
            "user_id":     str(self.user_id),
            "resource_id": str(self.resource_id),
            "occurred_at": self.occurred_at.isoformat(),
        }


@dataclass
class NoShowTriggered(DomainEvent):
    """
    Emitted by CheckInService when Redis TTL expires without QR scan.
    Included here so BookingService can reference the type in docstrings and tests.
    """
    booking_id:  UUID = None
    resource_id: UUID = None

    def to_dict(self) -> dict:
        return {
            "booking_id":  str(self.booking_id),
            "resource_id": str(self.resource_id),
            "occurred_at": self.occurred_at.isoformat(),
        }


@dataclass
class SlotReleased(DomainEvent):
    """Emitted when a slot returns to available state (cancel, no-show, or checkout)."""
    resource_id:       UUID = None
    slot_start:        datetime = None
    promoted_user_id:  UUID = None   # None if waitlist was empty

    def to_dict(self) -> dict:
        return {
            "resource_id":      str(self.resource_id),
            "slot_start":       self.slot_start.isoformat() if self.slot_start else None,
            "promoted_user_id": str(self.promoted_user_id) if self.promoted_user_id else None,
            "occurred_at":      self.occurred_at.isoformat(),
        }
