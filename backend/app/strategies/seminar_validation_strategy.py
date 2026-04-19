"""
SeminarValidationStrategy — Validation rules for seminar hall bookings.

Rules:
  - Maximum booking duration: 8 hours
  - Faculty only (in production; stubbed in prototype)

SOLID OCP: changing seminar rules touches only this class.
"""
from uuid import UUID

from app.models.time_slot import TimeSlot
from app.models.validation_result import ValidationResult
from app.strategies.validation_strategy import ValidationStrategy


class SeminarValidationStrategy(ValidationStrategy):
    """Seminar halls: max 8 hours, faculty only."""

    async def validate_async(
        self, user_id: UUID, resource_id: UUID, slot: TimeSlot
    ) -> ValidationResult:
        if slot.duration_hours() > 8:
            return ValidationResult(
                ok=False, reason="Seminar hall bookings cannot exceed 8 hours"
            )
        # In prototype: faculty check is stubbed (no approval needed)
        # In production: would verify user role is ROLE_FACULTY
        return ValidationResult(ok=True, needs_approval=False)
