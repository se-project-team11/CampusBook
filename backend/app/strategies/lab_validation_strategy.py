"""
LabValidationStrategy — Validation rules for lab bookings.

Rules:
  - Maximum booking duration: 3 hours
  - External users need department approval (stubbed to False in prototype)

SOLID OCP: changing lab rules touches only this class.
"""
from uuid import UUID

from app.models.time_slot import TimeSlot
from app.models.validation_result import ValidationResult
from app.strategies.validation_strategy import ValidationStrategy


class LabValidationStrategy(ValidationStrategy):
    """
    Lab bookings: max 3 hours, external users need department approval.
    SOLID OCP: changing lab rules touches only this class.
    """

    async def validate_async(
        self, user_id: UUID, resource_id: UUID, slot: TimeSlot
    ) -> ValidationResult:
        if slot.duration_hours() > 3:
            return ValidationResult(
                ok=False, reason="Lab bookings cannot exceed 3 hours"
            )
        # In prototype: external user check = always False (simplification)
        # In production: would query user service to check department affiliation
        needs_approval = False
        return ValidationResult(ok=True, needs_approval=needs_approval)
