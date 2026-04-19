"""
SportsValidationStrategy — Validation rules for sports court bookings.

Rules:
  - Maximum booking duration: 2 hours
  - Walk-in friendly, no approval needed

SOLID OCP: changing sports rules touches only this class.
"""
from uuid import UUID

from app.models.time_slot import TimeSlot
from app.models.validation_result import ValidationResult
from app.strategies.validation_strategy import ValidationStrategy


class SportsValidationStrategy(ValidationStrategy):
    """Sports courts: walk-in, max 2 hours, no approval needed."""

    async def validate_async(
        self, user_id: UUID, resource_id: UUID, slot: TimeSlot
    ) -> ValidationResult:
        if slot.duration_hours() > 2:
            return ValidationResult(
                ok=False, reason="Sports court bookings cannot exceed 2 hours"
            )
        return ValidationResult(ok=True, needs_approval=False)
