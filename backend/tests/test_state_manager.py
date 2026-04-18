"""
Unit tests for BookingStateMgr.
Exhaustively tests all valid transitions and all expected invalid transitions.
No database, no async, no external dependencies.
"""
import uuid
from datetime import datetime

import pytest

from app.models.booking import Booking, BookingState
from app.models.time_slot import TimeSlot
from app.services.state_manager import BookingStateMgr, InvalidStateTransitionError


def make_booking(state: BookingState = BookingState.RESERVED) -> Booking:
    return Booking(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        resource_id=uuid.uuid4(),
        slot_start=datetime(2026, 4, 10, 9, 0),
        slot_end=datetime(2026, 4, 10, 10, 0),
        state=state,
    )


class TestValidTransitions:
    """All transitions that MUST succeed."""

    def test_reserved_to_confirmed(self):
        mgr = BookingStateMgr()
        b = make_booking(BookingState.RESERVED)
        mgr.transition(b, BookingState.CONFIRMED)
        assert b.state == BookingState.CONFIRMED

    def test_reserved_to_released(self):
        """Validation failure or cancel before confirm."""
        mgr = BookingStateMgr()
        b = make_booking(BookingState.RESERVED)
        mgr.transition(b, BookingState.RELEASED)
        assert b.state == BookingState.RELEASED

    def test_confirmed_to_checked_in(self):
        mgr = BookingStateMgr()
        b = make_booking(BookingState.CONFIRMED)
        mgr.transition(b, BookingState.CHECKED_IN)
        assert b.state == BookingState.CHECKED_IN

    def test_confirmed_to_no_show(self):
        """Redis TTL expiry path."""
        mgr = BookingStateMgr()
        b = make_booking(BookingState.CONFIRMED)
        mgr.transition(b, BookingState.NO_SHOW)
        assert b.state == BookingState.NO_SHOW

    def test_confirmed_to_released(self):
        """User cancels a confirmed booking."""
        mgr = BookingStateMgr()
        b = make_booking(BookingState.CONFIRMED)
        mgr.transition(b, BookingState.RELEASED)
        assert b.state == BookingState.RELEASED

    def test_checked_in_to_released(self):
        mgr = BookingStateMgr()
        b = make_booking(BookingState.CHECKED_IN)
        mgr.transition(b, BookingState.RELEASED)
        assert b.state == BookingState.RELEASED

    def test_no_show_to_released(self):
        mgr = BookingStateMgr()
        b = make_booking(BookingState.NO_SHOW)
        mgr.transition(b, BookingState.RELEASED)
        assert b.state == BookingState.RELEASED

    def test_full_happy_path_reserved_confirmed_checked_in_released(self):
        mgr = BookingStateMgr()
        b = make_booking()
        mgr.transition(b, BookingState.CONFIRMED)
        mgr.transition(b, BookingState.CHECKED_IN)
        mgr.transition(b, BookingState.RELEASED)
        assert b.state == BookingState.RELEASED

    def test_full_no_show_path_reserved_confirmed_no_show_released(self):
        mgr = BookingStateMgr()
        b = make_booking()
        mgr.transition(b, BookingState.CONFIRMED)
        mgr.transition(b, BookingState.NO_SHOW)
        mgr.transition(b, BookingState.RELEASED)
        assert b.state == BookingState.RELEASED


class TestInvalidTransitions:
    """All transitions that MUST raise InvalidStateTransitionError."""

    @pytest.mark.parametrize("from_state,to_state", [
        # From RESERVED — cannot skip to later states
        (BookingState.RESERVED,   BookingState.CHECKED_IN),
        (BookingState.RESERVED,   BookingState.NO_SHOW),
        # From CONFIRMED — cannot go back
        (BookingState.CONFIRMED,  BookingState.RESERVED),
        # From CHECKED_IN — cannot go back or sideways
        (BookingState.CHECKED_IN, BookingState.RESERVED),
        (BookingState.CHECKED_IN, BookingState.CONFIRMED),
        (BookingState.CHECKED_IN, BookingState.NO_SHOW),
        # From NO_SHOW — cannot go anywhere except RELEASED
        (BookingState.NO_SHOW,    BookingState.RESERVED),
        (BookingState.NO_SHOW,    BookingState.CONFIRMED),
        (BookingState.NO_SHOW,    BookingState.CHECKED_IN),
        # From RELEASED — terminal, no transitions
        (BookingState.RELEASED,   BookingState.RESERVED),
        (BookingState.RELEASED,   BookingState.CONFIRMED),
        (BookingState.RELEASED,   BookingState.CHECKED_IN),
        (BookingState.RELEASED,   BookingState.NO_SHOW),
    ])
    def test_invalid_transition_raises(self, from_state, to_state):
        mgr = BookingStateMgr()
        b = make_booking(from_state)
        with pytest.raises(InvalidStateTransitionError) as exc_info:
            mgr.transition(b, to_state)
        assert from_state.value in str(exc_info.value)
        assert to_state.value in str(exc_info.value)


class TestIsValid:

    def test_is_valid_returns_true_for_allowed_transition(self):
        mgr = BookingStateMgr()
        assert mgr.is_valid(BookingState.RESERVED, BookingState.CONFIRMED) is True

    def test_is_valid_returns_false_for_disallowed_transition(self):
        mgr = BookingStateMgr()
        assert mgr.is_valid(BookingState.RELEASED, BookingState.CONFIRMED) is False

    def test_allowed_next_states_reserved(self):
        mgr = BookingStateMgr()
        allowed = mgr.allowed_next_states(BookingState.RESERVED)
        assert BookingState.CONFIRMED in allowed
        assert BookingState.RELEASED in allowed

    def test_allowed_next_states_released_is_empty(self):
        mgr = BookingStateMgr()
        assert mgr.allowed_next_states(BookingState.RELEASED) == []
