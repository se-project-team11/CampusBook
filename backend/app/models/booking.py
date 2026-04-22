from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID


class BookingState(str, Enum):
    """
    Full booking lifecycle states.
    str mixin means BookingState.CONFIRMED == "CONFIRMED" (useful for DB column comparison).

    State machine (enforced by BookingStateMgr):
      RESERVED → CONFIRMED → CHECKED_IN → RELEASED
      RESERVED → RELEASED  (validation failure / cancel before confirm)
      CONFIRMED → NO_SHOW  (Redis TTL expiry, no QR scan)
      CONFIRMED → RELEASED (user cancels confirmed booking)
      NO_SHOW  → RELEASED  (auto-release workflow)
      CHECKED_IN → RELEASED (session ends)
    """
    RESERVED   = "RESERVED"
    CONFIRMED  = "CONFIRMED"
    CHECKED_IN = "CHECKED_IN"
    NO_SHOW    = "NO_SHOW"
    RELEASED   = "RELEASED"


@dataclass
class Booking:
    """
    Core domain entity. Owns its own data — no external class mutates state directly.
    All state transitions go through BookingStateMgr.transition().

    GRASP Information Expert: Booking holds all booking data and exposes
    to_dict() for serialisation. External classes never reach into fields directly
    for mutation — that would be Feature Envy.
    """
    id:               UUID
    user_id:          UUID
    resource_id:      UUID
    slot_start:       datetime
    slot_end:         datetime
    state:            BookingState = BookingState.RESERVED
    qr_token:         Optional[str] = None
    requires_approval: bool = False
    user_email:       str = ""
    notes:            str = ""
    created_at:       Optional[datetime] = None
    expires_at:       Optional[datetime] = None

    def to_dict(self) -> dict:
        """Serialise to plain dict — used by DomainEventLog and API responses."""
        return {
            "id":               str(self.id),
            "user_id":          str(self.user_id),
            "resource_id":      str(self.resource_id),
            "slot_start":       self.slot_start.isoformat(),
            "slot_end":         self.slot_end.isoformat(),
            "state":            self.state.value,
            "qr_token":         self.qr_token,
            "requires_approval": self.requires_approval,
            "notes":            self.notes,
            "created_at":       self.created_at.isoformat() if self.created_at else None,
            "expires_at":       self.expires_at.isoformat() if self.expires_at else None,
        }

    def __repr__(self) -> str:
        return (
            f"Booking(id={str(self.id)[:8]}, "
            f"state={self.state.value}, "
            f"resource={str(self.resource_id)[:8]})"
        )
