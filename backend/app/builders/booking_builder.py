from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID

from app.models.booking import Booking, BookingState
from app.models.time_slot import TimeSlot


class BookingBuilder:
    """
    Builder pattern - prevents telescoping constructors.

    A Booking has 3 mandatory fields (user, resource, slot) and 4 optional
    fields (notes, requiresApproval, qrToken, expiresAt). Without a builder,
    BookingService would need overloaded constructors or a 7-argument call
    site - unreadable and error-prone (Primitive Obsession smell).

    GRASP Creator: BookingService is the Director that calls builder methods
    in sequence. Construction logic lives here, not in BookingService (SRP).

    USAGE:
        booking = (
            BookingBuilder()
            .set_user(user_id)
            .set_resource(resource_id)
            .set_slot(slot)
            .requires_approval(True)
            .build()  # auto-generates qr_token and expires_at
        )
    """

    def __init__(self) -> None:
        self._user_id:            Optional[UUID]     = None
        self._resource_id:        Optional[UUID]     = None
        self._slot:               Optional[TimeSlot] = None
        self._notes:              str                = ""
        self._requires_approval:  bool               = False
        self._user_email:         str                = ""
        self._qr_token:           Optional[str]      = None
        self._expires_at:         Optional[datetime] = None

    # Setters (Mandatory)

    def set_user(self, user_id: UUID) -> "BookingBuilder":
        self._user_id = user_id
        return self

    def set_resource(self, resource_id: UUID) -> "BookingBuilder":
        self._resource_id = resource_id
        return self

    def set_slot(self, slot: TimeSlot) -> "BookingBuilder":
        self._slot = slot
        return self

    # Setters (Optional)

    def set_notes(self, notes: str) -> "BookingBuilder":
        self._notes = notes
        return self

    def set_user_email(self, email: str) -> "BookingBuilder":
        self._user_email = email
        return self

    def requires_approval(self, flag: bool) -> "BookingBuilder":
        self._requires_approval = flag
        return self

    def set_qr_token(self, token: str) -> "BookingBuilder":
        """Override auto-generated QR token. Useful for testing deterministic tokens."""
        self._qr_token = token
        return self

    def set_expires_at(self, dt: datetime) -> "BookingBuilder":
        """Override auto-calculated expiry. Useful for testing short TTL windows."""
        self._expires_at = dt
        return self

    # Build

    def build(self) -> Booking:
        """
        Validates mandatory fields, auto-fills optional fields, and returns Booking.
        Raises ValueError with a clear message if any mandatory field is missing.
        Returned booking always has state=RESERVED - state machine handles all transitions.
        """
        if self._user_id is None:
            raise ValueError("BookingBuilder: user_id is required. Call .set_user(uuid) first.")
        if self._resource_id is None:
            raise ValueError("BookingBuilder: resource_id is required. Call .set_resource(uuid) first.")
        if self._slot is None:
            raise ValueError("BookingBuilder: slot is required. Call .set_slot(TimeSlot) first.")

        qr_token  = self._qr_token  or secrets.token_urlsafe(32)
        expires_at = self._expires_at or (datetime.utcnow() + timedelta(minutes=15))

        return Booking(
            id=uuid.uuid4(),
            user_id=self._user_id,
            resource_id=self._resource_id,
            slot_start=self._slot.start,
            slot_end=self._slot.end,
            state=BookingState.RESERVED,
            qr_token=qr_token,
            requires_approval=self._requires_approval,
            user_email=self._user_email,
            notes=self._notes,
            created_at=datetime.utcnow(),
            expires_at=expires_at,
        )
