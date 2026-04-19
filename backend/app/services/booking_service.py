from __future__ import annotations

import secrets
from datetime import datetime, timedelta
from typing import List, Optional, TYPE_CHECKING
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from app.builders.booking_builder import BookingBuilder
from app.db.models import BookingRow
from app.models.booking import Booking, BookingState
from app.models.domain_events import BookingCreated, BookingCancelled
from app.models.time_slot import TimeSlot
from app.repositories.booking_repository import BookingRepository
from app.services.event_log import DomainEventLog
from app.services.state_manager import BookingStateMgr

# TYPE_CHECKING guard prevents circular imports at runtime.
# ResourceAdapter, ValidationStrategy, NotificationService are BE2's code.
# We import their ABCs only for type hints — we never instantiate them here.
if TYPE_CHECKING:
    from app.adapters.resource_adapter import ResourceAdapter
    from app.strategies.validation_strategy import ValidationStrategy
    from app.services.notification_service import NotificationService


# ── Custom exceptions ────────────────────────────────────────────────────────

class SlotUnavailableError(Exception):
    """Raised when ResourceAdapter reports slot is not available."""
    def __init__(self, resource_id: UUID, slot: TimeSlot) -> None:
        super().__init__(
            f"Slot {slot} is unavailable for resource {resource_id}"
        )


class BookingValidationError(Exception):
    """Raised when ValidationStrategy rejects the booking request."""
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class ConcurrentBookingError(Exception):
    """
    Raised when pessimistic lock detects a concurrent booking attempt
    for the same slot. Client should retry after refreshing availability.
    """
    def __init__(self) -> None:
        super().__init__(
            "A concurrent booking conflict was detected for this slot. "
            "Please refresh availability and try again."
        )


class BookingNotFoundError(Exception):
    """Raised when a booking_id does not exist in the repository."""
    def __init__(self, booking_id: UUID) -> None:
        super().__init__(f"Booking {booking_id} not found")


class BookingPermissionError(Exception):
    """Raised when a user attempts to modify another user's booking."""
    def __init__(self) -> None:
        super().__init__("You do not have permission to modify this booking")


# ── Service ──────────────────────────────────────────────────────────────────

class BookingService:
    """
    Orchestrates booking creation and cancellation — the core of Feature F1.

    PATTERNS APPLIED (all demonstrated in create_booking):
      Adapter    — availability checked via ResourceAdapter interface (BE2)
      Strategy   — validation delegated to ValidationStrategy interface (BE2)
      Builder    — Booking object constructed via BookingBuilder
      State Machine — transitions mediated by BookingStateMgr
      Repository — persistence abstracted behind BookingRepository (DIP)
      Observer   — state changes published via NotificationService (BE2)
      Domain Events — BookingCreated appended to DomainEventLog

    GRASP:
      Information Expert — Booking owns its own data; BookingService doesn't
                           reach into Booking fields to make decisions.
      Creator            — BookingService creates Booking via BookingBuilder
                           because it has all the inputs (user, resource, slot).
      Low Coupling       — depends on interfaces only; never on concrete classes.
      High Cohesion      — handles booking lifecycle only; no notification logic here.
      Protected Variation — adapters/strategies shield against API changes.
      Controller         — thin orchestrator; delegates to specialists.

    SOLID:
      SRP — only booking lifecycle; notification changes affect NotificationService only.
      OCP — new resource types require new adapter/strategy, not changes here.
      DIP — all dependencies are injected abstractions.

    ARCHITECTURAL TACTIC:
      Pessimistic Locking — SELECT … FOR UPDATE NOWAIT inside the ACID transaction
      guarantees zero double-bookings under 50 concurrent requests.
    """

    def __init__(
        self,
        adapter_registry,        # AdapterRegistry (BE2) — get_for_resource(UUID)→ResourceAdapter
        strategy_registry,       # StrategyRegistry (BE2) — get_for_resource(UUID)→ValidationStrategy
        booking_repo: BookingRepository,
        state_mgr: BookingStateMgr,
        event_log: DomainEventLog,
        notification_svc,        # NotificationService (BE2) — on_booking_event(DomainEvent)
        redis,                   # aioredis client — set(key, value, ex=seconds)
    ) -> None:
        self._adapters      = adapter_registry
        self._strategies    = strategy_registry
        self._repo          = booking_repo
        self._state_mgr     = state_mgr
        self._event_log     = event_log
        self._notif         = notification_svc
        self._redis         = redis

    # ── Public API ───────────────────────────────────────────────────────────

    async def create_booking(
        self,
        db: Optional[AsyncSession],
        user_id: UUID,
        resource_id: UUID,
        slot: TimeSlot,
        notes: str = "",
    ) -> Booking:
        """
        F1 end-to-end booking creation.

        Steps:
          1. ADAPTER    — check availability via normalised interface
          2. STRATEGY   — validate per resource type (no if-else chain)
          3. BUILDER    — construct Booking domain object
          4. LOCK+SAVE  — pessimistic lock + persist in ACID transaction
          5. STATE      — transition RESERVED → CONFIRMED
          6. EVENT      — append BookingCreated to audit log
          7. REDIS TTL  — write booking_ttl:{id} key (consumed by BE2 CheckInService)
          8. NOTIFY     — fan out to email/WebSocket channels (async, non-blocking)

        Returns the confirmed Booking on success.

        Raises:
          SlotUnavailableError    — adapter says slot is not available
          BookingValidationError  — strategy validation failed
          ConcurrentBookingError  — pessimistic lock found existing booking
        """

        # ── Step 1: ADAPTER — check availability ────────────────────────────
        # Adapter pattern: BookingService calls the normalised ResourceAdapter
        # interface; it never knows whether it's talking to a library API,
        # department portal, or sports complex system.
        adapter = await self._adapters.get_for_resource(resource_id)
        if not await adapter.check_availability(slot):
            raise SlotUnavailableError(resource_id, slot)

        # ── Step 2: STRATEGY — validate per resource type ───────────────────
        # Strategy pattern: eliminates if-else on resource.type entirely.
        # LabValidationStrategy, SportsValidationStrategy, etc. are all
        # polymorphically dispatched here — BookingService never changes
        # when a new resource type is added (OCP).
        strategy = await self._strategies.get_for_resource(resource_id)
        validation = await strategy.validate_async(user_id, resource_id, slot)
        if not validation.ok:
            raise BookingValidationError(validation.reason)

        # ── Step 3: BUILDER — construct Booking ─────────────────────────────
        # Builder pattern: avoids telescoping constructor (Primitive Obsession
        # smell). All field names are explicit; order does not matter.
        # Booking is created in RESERVED state — state machine handles all
        # transitions from here.
        booking: Booking = (
            BookingBuilder()
            .set_user(user_id)
            .set_resource(resource_id)
            .set_slot(slot)
            .set_notes(notes)
            .requires_approval(validation.needs_approval)
            .set_qr_token(secrets.token_urlsafe(32))
            .set_expires_at(datetime.utcnow() + timedelta(minutes=15))
            .build()
        )

        # ── Step 4: PESSIMISTIC LOCK + PERSIST ──────────────────────────────
        # Architectural tactic: pessimistic locking guarantees zero
        # double-bookings under concurrent load.
        #
        # Flow:
        #   BEGIN TRANSACTION
        #     SELECT … FOR UPDATE NOWAIT  ← row-level lock
        #     If existing booking found → ROLLBACK → ConcurrentBookingError
        #     INSERT new booking row
        #   COMMIT + lock released
        #
        # NOWAIT means: if another transaction holds the lock, raise immediately
        # rather than waiting. The client receives a 409 and can retry after
        # refreshing availability. This prevents deadlock and keeps latency low.
        #
        # Belt-and-suspenders: the DB schema also has an EXCLUDE constraint
        # using tstzrange overlap — this catches any edge case the lock misses.
        #
        # When db is None (unit tests), we skip the DB-level lock and rely on
        # InMemoryBookingRepository.find_active_by_slot() for conflict detection.
        if db is not None:
            try:
                async with db.begin():
                    # Acquire row-level lock on any existing booking for this slot
                    existing = await db.execute(
                        select(BookingRow)
                        .where(
                            BookingRow.resource_id == resource_id,
                            BookingRow.slot_start  == slot.start,
                            BookingRow.slot_end    == slot.end,
                            BookingRow.state.notin_(
                                [BookingState.RELEASED.value, BookingState.NO_SHOW.value]
                            ),
                        )
                        .with_for_update(nowait=True)
                    )
                    if existing.scalar_one_or_none() is not None:
                        raise ConcurrentBookingError()

                    await self._repo.save(booking, db)
                # ── COMMIT ─── lock released here
            except OperationalError:
                # SQLAlchemy raises OperationalError when NOWAIT lock cannot be acquired.
                # This means another transaction is currently inserting the same slot.
                raise ConcurrentBookingError()
        else:
            # Unit test path: use repository's conflict check instead of DB lock.
            # InMemoryBookingRepository.find_active_by_slot() returns any
            # non-terminal bookings for the same slot — if found, it's a conflict.
            existing = await self._repo.find_active_by_slot(resource_id, slot)
            if existing:
                raise ConcurrentBookingError()
            await self._repo.save(booking)

        # ── Step 5: STATE MACHINE — RESERVED → CONFIRMED ────────────────────
        # State Machine pattern: BookingStateMgr validates every transition.
        # After this call, booking.state == CONFIRMED in memory.
        # We then persist the state change to keep DB in sync.
        self._state_mgr.transition(booking, BookingState.CONFIRMED)
        await self._repo.update_state(booking.id, BookingState.CONFIRMED.value)

        # ── Step 6: DOMAIN EVENT — append to audit log ───────────────────────
        # Domain Events pattern: BookingCreated is the authoritative record
        # that a booking happened. NotificationService and analytics module
        # read from this log rather than coupling directly to BookingService.
        event = BookingCreated(
            booking_id=booking.id,
            user_id=user_id,
            resource_id=resource_id,
            slot_start=slot.start,
            slot_end=slot.end,
        )
        await self._event_log.append(event)

        # ── Step 7: Redis TTL key (consumed by BE2's CheckInService) ─────────
        # BE2's CheckInService listens to __keyevent@0__:expired events.
        # When booking_ttl:{id} expires at T+15 min, CheckInService:
        #   1. Transitions booking → NO_SHOW
        #   2. Promotes next waitlist entry
        #   3. Publishes SlotReleased to Redis pub/sub → WebSocket hub → clients
        await self._redis.set(
            f"booking_ttl:{booking.id}",
            "1",
            ex=900,  # 900 seconds = 15 minutes
        )

        # ── Step 8: OBSERVER — async notifications ───────────────────────────
        # Observer pattern: NotificationService is the Subject; email/SMS/
        # WebSocket channels are the Observers. BookingService fires and
        # forgets — notification failure MUST NOT cause booking failure
        # (circuit breaker is BE2's responsibility in NotificationService).
        await self._notif.on_booking_event(event)

        return booking

    async def cancel_booking(
        self,
        db: Optional[AsyncSession],
        booking_id: UUID,
        requesting_user_id: UUID,
    ) -> None:
        """
        Cancel a CONFIRMED booking. Only the booking owner can cancel.

        Transitions: CONFIRMED → RELEASED
        Side effects:
          - Redis TTL key deleted (prevents false no-show)
          - BookingCancelled event appended
          - Notification dispatched
        """
        booking = await self._repo.find_by_id(booking_id)
        if booking is None:
            raise BookingNotFoundError(booking_id)
        if booking.user_id != requesting_user_id:
            raise BookingPermissionError()

        # State machine validates CONFIRMED → RELEASED is allowed
        self._state_mgr.transition(booking, BookingState.RELEASED)
        await self._repo.update_state(booking_id, BookingState.RELEASED.value)

        # Delete Redis TTL key — no-show workflow must not fire after cancel
        await self._redis.delete(f"booking_ttl:{booking_id}")

        # Emit cancellation event
        cancel_event = BookingCancelled(
            booking_id=booking_id,
            user_id=requesting_user_id,
            resource_id=booking.resource_id,
        )
        await self._event_log.append(cancel_event)
        await self._notif.on_booking_event(cancel_event)

    async def get_booking(self, booking_id: UUID) -> Booking:
        """Fetch a booking by ID. Raises BookingNotFoundError if missing."""
        booking = await self._repo.find_by_id(booking_id)
        if booking is None:
            raise BookingNotFoundError(booking_id)
        return booking

    async def get_user_bookings(self, user_id: UUID) -> list[Booking]:
        """Return all bookings for a user, ordered newest first."""
        return await self._repo.find_by_user(user_id)
