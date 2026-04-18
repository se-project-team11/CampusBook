"""
Unit tests for BookingBuilder.
No database, no async, no external dependencies — pure domain logic.
"""
import uuid
from datetime import datetime, timedelta

import pytest

from app.builders.booking_builder import BookingBuilder
from app.models.booking import BookingState
from app.models.time_slot import TimeSlot

SLOT = TimeSlot(
    start=datetime(2026, 4, 10, 9, 0),
    end=datetime(2026, 4, 10, 10, 0),
)
USER_ID     = uuid.uuid4()
RESOURCE_ID = uuid.uuid4()


class TestBookingBuilderHappyPath:

    def test_builds_booking_with_all_mandatory_fields(self):
        booking = (
            BookingBuilder()
            .set_user(USER_ID)
            .set_resource(RESOURCE_ID)
            .set_slot(SLOT)
            .build()
        )
        assert booking.user_id     == USER_ID
        assert booking.resource_id == RESOURCE_ID
        assert booking.slot_start  == SLOT.start
        assert booking.slot_end    == SLOT.end

    def test_new_booking_state_is_always_reserved(self):
        booking = (
            BookingBuilder()
            .set_user(USER_ID)
            .set_resource(RESOURCE_ID)
            .set_slot(SLOT)
            .build()
        )
        assert booking.state == BookingState.RESERVED

    def test_auto_generates_qr_token(self):
        booking = (
            BookingBuilder()
            .set_user(USER_ID)
            .set_resource(RESOURCE_ID)
            .set_slot(SLOT)
            .build()
        )
        assert booking.qr_token is not None
        assert len(booking.qr_token) > 10

    def test_auto_generates_expires_at_15_minutes_from_now(self):
        before = datetime.utcnow()
        booking = (
            BookingBuilder()
            .set_user(USER_ID)
            .set_resource(RESOURCE_ID)
            .set_slot(SLOT)
            .build()
        )
        after = datetime.utcnow()
        expected_min = before + timedelta(minutes=14, seconds=59)
        expected_max = after  + timedelta(minutes=15, seconds=1)
        assert expected_min <= booking.expires_at <= expected_max

    def test_auto_generates_unique_id(self):
        b1 = BookingBuilder().set_user(USER_ID).set_resource(RESOURCE_ID).set_slot(SLOT).build()
        b2 = BookingBuilder().set_user(USER_ID).set_resource(RESOURCE_ID).set_slot(SLOT).build()
        assert b1.id != b2.id

    def test_auto_generates_unique_qr_tokens(self):
        b1 = BookingBuilder().set_user(USER_ID).set_resource(RESOURCE_ID).set_slot(SLOT).build()
        b2 = BookingBuilder().set_user(USER_ID).set_resource(RESOURCE_ID).set_slot(SLOT).build()
        assert b1.qr_token != b2.qr_token

    def test_optional_notes_default_empty_string(self):
        booking = (
            BookingBuilder()
            .set_user(USER_ID)
            .set_resource(RESOURCE_ID)
            .set_slot(SLOT)
            .build()
        )
        assert booking.notes == ""

    def test_set_notes(self):
        booking = (
            BookingBuilder()
            .set_user(USER_ID)
            .set_resource(RESOURCE_ID)
            .set_slot(SLOT)
            .set_notes("Study group for OS exam")
            .build()
        )
        assert booking.notes == "Study group for OS exam"

    def test_requires_approval_default_false(self):
        booking = (
            BookingBuilder()
            .set_user(USER_ID)
            .set_resource(RESOURCE_ID)
            .set_slot(SLOT)
            .build()
        )
        assert booking.requires_approval is False

    def test_set_requires_approval_true(self):
        booking = (
            BookingBuilder()
            .set_user(USER_ID)
            .set_resource(RESOURCE_ID)
            .set_slot(SLOT)
            .requires_approval(True)
            .build()
        )
        assert booking.requires_approval is True

    def test_override_qr_token(self):
        booking = (
            BookingBuilder()
            .set_user(USER_ID)
            .set_resource(RESOURCE_ID)
            .set_slot(SLOT)
            .set_qr_token("deterministic-token-for-test")
            .build()
        )
        assert booking.qr_token == "deterministic-token-for-test"

    def test_override_expires_at(self):
        custom_expiry = datetime(2026, 4, 10, 9, 30)
        booking = (
            BookingBuilder()
            .set_user(USER_ID)
            .set_resource(RESOURCE_ID)
            .set_slot(SLOT)
            .set_expires_at(custom_expiry)
            .build()
        )
        assert booking.expires_at == custom_expiry

    def test_created_at_is_set(self):
        before = datetime.utcnow()
        booking = (
            BookingBuilder()
            .set_user(USER_ID)
            .set_resource(RESOURCE_ID)
            .set_slot(SLOT)
            .build()
        )
        after = datetime.utcnow()
        assert before <= booking.created_at <= after

    def test_builder_is_reusable_for_different_users(self):
        """Builder instance should not carry state between builds (each .build() call is independent)."""
        user1 = uuid.uuid4()
        user2 = uuid.uuid4()
        b1 = BookingBuilder().set_user(user1).set_resource(RESOURCE_ID).set_slot(SLOT).build()
        b2 = BookingBuilder().set_user(user2).set_resource(RESOURCE_ID).set_slot(SLOT).build()
        assert b1.user_id == user1
        assert b2.user_id == user2


class TestBookingBuilderValidation:

    def test_missing_user_id_raises_value_error(self):
        with pytest.raises(ValueError, match="user_id"):
            BookingBuilder().set_resource(RESOURCE_ID).set_slot(SLOT).build()

    def test_missing_resource_id_raises_value_error(self):
        with pytest.raises(ValueError, match="resource_id"):
            BookingBuilder().set_user(USER_ID).set_slot(SLOT).build()

    def test_missing_slot_raises_value_error(self):
        with pytest.raises(ValueError, match="slot"):
            BookingBuilder().set_user(USER_ID).set_resource(RESOURCE_ID).build()

    def test_time_slot_rejects_end_before_start(self):
        with pytest.raises(ValueError):
            TimeSlot(
                start=datetime(2026, 4, 10, 10, 0),
                end=datetime(2026, 4, 10, 9, 0),  # end before start
            )

    def test_time_slot_rejects_equal_start_end(self):
        with pytest.raises(ValueError):
            TimeSlot(
                start=datetime(2026, 4, 10, 9, 0),
                end=datetime(2026, 4, 10, 9, 0),  # zero duration
            )
