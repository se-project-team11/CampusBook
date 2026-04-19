"""
Unit tests for BookingService.
All infrastructure (DB, Redis, adapters, strategies, notifications) is mocked.
InMemoryBookingRepository and InMemoryDomainEventLog are used.
No database connection required — tests run in < 1 second.
"""
from __future__ import annotations

import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.builders.booking_builder import BookingBuilder
from app.models.booking import Booking, BookingState
from app.models.domain_events import BookingCreated, BookingCancelled
from app.models.time_slot import TimeSlot
from app.models.validation_result import ValidationResult
from app.repositories.inmemory_booking_repository import InMemoryBookingRepository
from app.services.booking_service import (
    BookingService,
    BookingNotFoundError,
    BookingPermissionError,
    BookingValidationError,
    ConcurrentBookingError,
    SlotUnavailableError,
)
from app.services.event_log import InMemoryDomainEventLog
from app.services.state_manager import BookingStateMgr

# ── Test fixtures ─────────────────────────────────────────────────────────────

USER_ID     = uuid.uuid4()
RESOURCE_ID = uuid.uuid4()
SLOT = TimeSlot(
    start=datetime(2026, 4, 10, 9, 0),
    end=datetime(2026, 4, 10, 10, 0),
)


def make_mock_adapter(available: bool = True) -> AsyncMock:
    adapter = AsyncMock()
    adapter.check_availability.return_value = available
    return adapter


def make_mock_strategy(ok: bool = True, needs_approval: bool = False) -> AsyncMock:
    strategy = AsyncMock()
    strategy.validate_async.return_value = ValidationResult(
        ok=ok,
        reason="Lab bookings max 3 hours" if not ok else "",
        needs_approval=needs_approval,
    )
    return strategy


def make_mock_registry(adapter=None, strategy=None):
    """Create async registries returning the given adapter/strategy."""
    adapter_registry  = AsyncMock()
    strategy_registry = AsyncMock()
    adapter_registry.get_for_resource.return_value  = adapter  or make_mock_adapter()
    strategy_registry.get_for_resource.return_value = strategy or make_mock_strategy()
    return adapter_registry, strategy_registry


def make_service(
    available: bool = True,
    validation_ok: bool = True,
    needs_approval: bool = False,
) -> tuple[BookingService, InMemoryBookingRepository, InMemoryDomainEventLog, AsyncMock, AsyncMock]:
    """
    Factory that builds a fully wired BookingService with in-memory dependencies.
    Returns (service, repo, event_log, notif_mock, redis_mock).
    """
    adapter  = make_mock_adapter(available)
    strategy = make_mock_strategy(validation_ok, needs_approval)
    adapter_registry, strategy_registry = make_mock_registry(adapter, strategy)

    repo      = InMemoryBookingRepository()
    event_log = InMemoryDomainEventLog()
    state_mgr = BookingStateMgr()
    notif     = AsyncMock()
    redis     = AsyncMock()

    svc = BookingService(
        adapter_registry=adapter_registry,
        strategy_registry=strategy_registry,
        booking_repo=repo,
        state_mgr=state_mgr,
        event_log=event_log,
        notification_svc=notif,
        redis=redis,
    )
    return svc, repo, event_log, notif, redis


# ── Happy path tests ─────────────────────────────────────────────────────────

class TestCreateBookingSuccess:

    @pytest.mark.asyncio
    async def test_returns_confirmed_booking(self):
        svc, repo, *_ = make_service()
        booking = await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        assert booking.state == BookingState.CONFIRMED

    @pytest.mark.asyncio
    async def test_booking_persisted_in_repository(self):
        svc, repo, *_ = make_service()
        booking = await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        stored = await repo.find_by_id(booking.id)
        assert stored is not None
        assert stored.id == booking.id

    @pytest.mark.asyncio
    async def test_booking_has_qr_token(self):
        svc, repo, *_ = make_service()
        booking = await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        assert booking.qr_token is not None
        assert len(booking.qr_token) > 10

    @pytest.mark.asyncio
    async def test_booking_has_expires_at(self):
        svc, repo, *_ = make_service()
        booking = await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        assert booking.expires_at is not None

    @pytest.mark.asyncio
    async def test_booking_created_event_appended(self):
        svc, repo, event_log, *_ = make_service()
        booking = await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        assert event_log.count() == 1
        event = event_log.last()
        assert isinstance(event, BookingCreated)
        assert event.booking_id == booking.id
        assert event.user_id    == USER_ID
        assert event.resource_id == RESOURCE_ID

    @pytest.mark.asyncio
    async def test_notification_service_called(self):
        svc, repo, event_log, notif, redis = make_service()
        await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        notif.on_booking_event.assert_called_once()

    @pytest.mark.asyncio
    async def test_redis_ttl_key_written(self):
        svc, repo, event_log, notif, redis = make_service()
        booking = await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        redis.set.assert_called_once_with(
            f"booking_ttl:{booking.id}", "1", ex=900
        )

    @pytest.mark.asyncio
    async def test_repository_count_is_one_after_booking(self):
        svc, repo, *_ = make_service()
        await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        assert repo.count() == 1

    @pytest.mark.asyncio
    async def test_user_id_and_resource_id_correct_on_returned_booking(self):
        svc, repo, *_ = make_service()
        booking = await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        assert booking.user_id     == USER_ID
        assert booking.resource_id == RESOURCE_ID

    @pytest.mark.asyncio
    async def test_slot_dates_correct_on_returned_booking(self):
        svc, repo, *_ = make_service()
        booking = await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        assert booking.slot_start == SLOT.start
        assert booking.slot_end   == SLOT.end

    @pytest.mark.asyncio
    async def test_notes_passed_through(self):
        svc, repo, *_ = make_service()
        booking = await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT, notes="Study group")
        assert booking.notes == "Study group"

    @pytest.mark.asyncio
    async def test_requires_approval_from_strategy(self):
        svc, repo, *_ = make_service(needs_approval=True)
        booking = await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        assert booking.requires_approval is True


# ── Error path tests ─────────────────────────────────────────────────────────

class TestCreateBookingErrors:

    @pytest.mark.asyncio
    async def test_slot_unavailable_raises(self):
        svc, *_ = make_service(available=False)
        with pytest.raises(SlotUnavailableError):
            await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)

    @pytest.mark.asyncio
    async def test_validation_failure_raises(self):
        svc, *_ = make_service(validation_ok=False)
        with pytest.raises(BookingValidationError) as exc_info:
            await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        assert "max 3 hours" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_slot_unavailable_does_not_persist_booking(self):
        svc, repo, *_ = make_service(available=False)
        try:
            await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        except SlotUnavailableError:
            pass
        assert repo.count() == 0

    @pytest.mark.asyncio
    async def test_validation_failure_does_not_persist_booking(self):
        svc, repo, *_ = make_service(validation_ok=False)
        try:
            await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        except BookingValidationError:
            pass
        assert repo.count() == 0

    @pytest.mark.asyncio
    async def test_slot_unavailable_does_not_emit_event(self):
        svc, repo, event_log, *_ = make_service(available=False)
        try:
            await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        except SlotUnavailableError:
            pass
        assert event_log.count() == 0

    @pytest.mark.asyncio
    async def test_slot_unavailable_does_not_write_redis_key(self):
        svc, repo, event_log, notif, redis = make_service(available=False)
        try:
            await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        except SlotUnavailableError:
            pass
        redis.set.assert_not_called()

    @pytest.mark.asyncio
    async def test_notification_failure_does_not_fail_booking(self):
        svc, repo, event_log, notif, redis = make_service()
        notif.on_booking_event.side_effect = Exception("Notification Service Down")
        # Should not raise
        booking = await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        assert booking.state == BookingState.CONFIRMED


# ── Cancel booking tests ─────────────────────────────────────────────────────

class TestCancelBooking:

    @pytest.mark.asyncio
    async def test_cancel_confirmed_booking_succeeds(self):
        svc, repo, *_ = make_service()
        booking = await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        await svc.cancel_booking(None, booking.id, USER_ID)
        stored = await repo.find_by_id(booking.id)
        assert stored.state == BookingState.RELEASED

    @pytest.mark.asyncio
    async def test_cancel_emits_cancellation_event(self):
        svc, repo, event_log, *_ = make_service()
        booking = await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        await svc.cancel_booking(None, booking.id, USER_ID)
        cancel_events = event_log.of_type(BookingCancelled)
        assert len(cancel_events) == 1

    @pytest.mark.asyncio
    async def test_cancel_deletes_redis_ttl_key(self):
        svc, repo, event_log, notif, redis = make_service()
        booking = await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        await svc.cancel_booking(None, booking.id, USER_ID)
        redis.delete.assert_called_once_with(f"booking_ttl:{booking.id}")

    @pytest.mark.asyncio
    async def test_cancel_nonexistent_booking_raises(self):
        svc, *_ = make_service()
        with pytest.raises(BookingNotFoundError):
            await svc.cancel_booking(None, uuid.uuid4(), USER_ID)

    @pytest.mark.asyncio
    async def test_cancel_another_users_booking_raises(self):
        svc, repo, *_ = make_service()
        booking = await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        other_user = uuid.uuid4()
        with pytest.raises(BookingPermissionError):
            await svc.cancel_booking(None, booking.id, other_user)

    @pytest.mark.asyncio
    async def test_cancel_notification_failure_does_not_fail_cancellation(self):
        svc, repo, event_log, notif, redis = make_service()
        booking = await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        notif.on_booking_event.side_effect = Exception("Notification Service Down")
        # Should not raise
        await svc.cancel_booking(None, booking.id, USER_ID)
        stored = await repo.find_by_id(booking.id)
        assert stored.state == BookingState.RELEASED


# ── Get booking tests ─────────────────────────────────────────────────────────

class TestGetBooking:

    @pytest.mark.asyncio
    async def test_get_existing_booking(self):
        svc, repo, *_ = make_service()
        created = await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        fetched = await svc.get_booking(created.id)
        assert fetched.id == created.id

    @pytest.mark.asyncio
    async def test_get_nonexistent_booking_raises(self):
        svc, *_ = make_service()
        with pytest.raises(BookingNotFoundError):
            await svc.get_booking(uuid.uuid4())

    @pytest.mark.asyncio
    async def test_get_user_bookings_returns_all(self):
        svc, *_ = make_service()
        await svc.create_booking(None, USER_ID, RESOURCE_ID, SLOT)
        slot2 = TimeSlot(datetime(2026, 4, 10, 11, 0), datetime(2026, 4, 10, 12, 0))
        await svc.create_booking(None, USER_ID, RESOURCE_ID, slot2)
        bookings = await svc.get_user_bookings(USER_ID)
        assert len(bookings) == 2
