from __future__ import annotations

from typing import Dict, List

from app.models.booking import Booking, BookingState


class InvalidStateTransitionError(Exception):
    """
    Raised by BookingStateMgr when an illegal state transition is attempted.
    Illegal transitions are rejected at the service boundary — invalid booking
    states cannot persist to the database (Deficient Encapsulation smell avoided).
    """
    def __init__(self, from_state: BookingState, to_state: BookingState) -> None:
        super().__init__(
            f"Invalid booking state transition: {from_state.value} → {to_state.value}. "
            f"This transition is not permitted by the state machine."
        )
        self.from_state = from_state
        self.to_state   = to_state


class BookingStateMgr:
    """
    State Machine pattern — governs the full booking lifecycle.

    All transitions are mediated through transition(). Direct assignment to
    booking.state from outside this class is not the intended usage — doing so
    bypasses validation and is a Deficient Encapsulation smell.

    GRASP Protected Variation: the allowed transitions map is the single
    authoritative source for lifecycle rules. Adding a new state only requires
    updating TRANSITIONS — no other class needs to change.

    Allowed transitions:
      RESERVED   → CONFIRMED  (validation passes, QR issued)
      RESERVED   → RELEASED   (validation fails or user cancels before confirm)
      CONFIRMED  → CHECKED_IN (user scans QR within 15 min window)
      CONFIRMED  → NO_SHOW    (Redis TTL expires, triggered by CheckInService)
      CONFIRMED  → RELEASED   (user cancels confirmed booking)
      CHECKED_IN → RELEASED   (session ends / checkout)
      NO_SHOW    → RELEASED   (auto-release workflow, triggered by CheckInService)
      RELEASED   → (terminal, no further transitions)
    """

    TRANSITIONS: Dict[BookingState, List[BookingState]] = {
        BookingState.RESERVED: [
            BookingState.CONFIRMED,
            BookingState.RELEASED,
        ],
        BookingState.CONFIRMED: [
            BookingState.CHECKED_IN,
            BookingState.NO_SHOW,
            BookingState.RELEASED,
        ],
        BookingState.CHECKED_IN: [
            BookingState.RELEASED,
        ],
        BookingState.NO_SHOW: [
            BookingState.RELEASED,
        ],
        BookingState.RELEASED: [],   # Terminal state
    }

    def transition(self, booking: Booking, to_state: BookingState) -> None:
        """
        Validates and applies a state transition to the booking object in memory.
        Does NOT persist to DB — caller (BookingService or CheckInService) must
        call repository.update_state() after this succeeds.

        Raises:
            InvalidStateTransitionError: if the transition is not in TRANSITIONS.
        """
        if not self.is_valid(booking.state, to_state):
            raise InvalidStateTransitionError(booking.state, to_state)
        booking.state = to_state

    def is_valid(self, from_state: BookingState, to_state: BookingState) -> bool:
        """Returns True if the from→to transition is permitted."""
        return to_state in self.TRANSITIONS.get(from_state, [])

    def allowed_next_states(self, current_state: BookingState) -> List[BookingState]:
        """Returns list of states reachable from current_state. Empty list = terminal."""
        return self.TRANSITIONS.get(current_state, [])
