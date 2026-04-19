"""
Unit tests for InMemoryBookingRepository.
Verifies the test double behaves correctly before trusting it in service tests.
"""
import uuid
from datetime import datetime

import pytest

from app.models.booking import Booking, BookingState
from app.models.time_slot import TimeSlot
from app.repositories.inmemory_booking_repository import InMemoryBookingRepository


def make_booking(
    user_id: uuid.UUID = None,
    resource_id: uuid.UUID = None,
    slot: TimeSlot = None,
    state: BookingState = BookingState.CONFIRMED,
) -> Booking:
    return Booking(
        id=uuid.uuid4(),
        user_id=user_id or uuid.uuid4(),
        resource_id=resource_id or uuid.uuid4(),
        slot_start=(slot or TimeSlot(datetime(2026, 4, 10, 9, 0), datetime(2026, 4, 10, 10, 0))).start,
        slot_end=(slot or TimeSlot(datetime(2026, 4, 10, 9, 0), datetime(2026, 4, 10, 10, 0))).end,
        state=state,
        qr_token="test-token",
    )


class TestInMemoryBookingRepository:

    @pytest.mark.asyncio
    async def test_save_and_find_by_id(self):
        repo = InMemoryBookingRepository()
        b = make_booking()
        await repo.save(b)
        found = await repo.find_by_id(b.id)
        assert found is not None
        assert found.id == b.id

    @pytest.mark.asyncio
    async def test_find_by_id_returns_none_for_missing(self):
        repo = InMemoryBookingRepository()
        result = await repo.find_by_id(uuid.uuid4())
        assert result is None

    @pytest.mark.asyncio
    async def test_find_active_by_slot_returns_confirmed(self):
        repo = InMemoryBookingRepository()
        rid = uuid.uuid4()
        slot = TimeSlot(datetime(2026, 4, 10, 9, 0), datetime(2026, 4, 10, 10, 0))
        b = make_booking(resource_id=rid, slot=slot, state=BookingState.CONFIRMED)
        await repo.save(b)
        found = await repo.find_active_by_slot(rid, slot)
        assert len(found) == 1

    @pytest.mark.asyncio
    async def test_find_active_by_slot_excludes_released(self):
        repo = InMemoryBookingRepository()
        rid = uuid.uuid4()
        slot = TimeSlot(datetime(2026, 4, 10, 9, 0), datetime(2026, 4, 10, 10, 0))
        b = make_booking(resource_id=rid, slot=slot, state=BookingState.RELEASED)
        await repo.save(b)
        found = await repo.find_active_by_slot(rid, slot)
        assert len(found) == 0

    @pytest.mark.asyncio
    async def test_find_active_by_slot_excludes_no_show(self):
        repo = InMemoryBookingRepository()
        rid = uuid.uuid4()
        slot = TimeSlot(datetime(2026, 4, 10, 9, 0), datetime(2026, 4, 10, 10, 0))
        b = make_booking(resource_id=rid, slot=slot, state=BookingState.NO_SHOW)
        await repo.save(b)
        found = await repo.find_active_by_slot(rid, slot)
        assert len(found) == 0

    @pytest.mark.asyncio
    async def test_update_state(self):
        repo = InMemoryBookingRepository()
        b = make_booking(state=BookingState.CONFIRMED)
        await repo.save(b)
        await repo.update_state(b.id, BookingState.RELEASED.value)
        found = await repo.find_by_id(b.id)
        assert found.state == BookingState.RELEASED

    @pytest.mark.asyncio
    async def test_find_by_user_returns_all_user_bookings(self):
        repo = InMemoryBookingRepository()
        uid = uuid.uuid4()
        b1 = make_booking(user_id=uid)
        b2 = make_booking(user_id=uid)
        b3 = make_booking()  # different user
        await repo.save(b1)
        await repo.save(b2)
        await repo.save(b3)
        found = await repo.find_by_user(uid)
        assert len(found) == 2

    @pytest.mark.asyncio
    async def test_count_helper(self):
        repo = InMemoryBookingRepository()
        assert repo.count() == 0
        await repo.save(make_booking())
        assert repo.count() == 1

    @pytest.mark.asyncio
    async def test_clear_helper(self):
        repo = InMemoryBookingRepository()
        await repo.save(make_booking())
        repo.clear()
        assert repo.count() == 0
