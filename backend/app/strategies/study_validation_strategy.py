"""
StudyValidationStrategy — Validation rules for study room bookings.

Rules:
  - Maximum booking duration: 4 hours
  - No department approval required

SOLID OCP: changing study room rules touches only this class.
"""
from uuid import UUID

from app.models.time_slot import TimeSlot
from app.models.validation_result import ValidationResult
from app.strategies.validation_strategy import ValidationStrategy


class StudyValidationStrategy(ValidationStrategy):
    """Study rooms: max 4 hours, no approval."""

    async def validate_async(
        self, user_id: UUID, resource_id: UUID, slot: TimeSlot
    ) -> ValidationResult:
        if slot.duration_hours() > 4:
            return ValidationResult(
                ok=False, reason="Study room bookings cannot exceed 4 hours"
            )
        return ValidationResult(ok=True, needs_approval=False)
