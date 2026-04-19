"""
ValidationStrategy — Strategy pattern interface.

Context: BookingService.
BookingService delegates all resource-type-specific validation logic to the
appropriate strategy. No if-else chain on resource.type anywhere in BookingService.

Pattern: Strategy (GoF) — each resource type's booking rules are fully
         encapsulated in a concrete strategy class.
SOLID:   OCP — changing lab rules (e.g., max hours) touches only
         LabValidationStrategy; BookingService never changes.
         SRP — validation logic is separated from booking orchestration.
"""
from abc import ABC, abstractmethod
from uuid import UUID

from app.models.time_slot import TimeSlot
from app.models.validation_result import ValidationResult


class ValidationStrategy(ABC):
    """
    Strategy pattern — Context: BookingService.
    No if-else on resource type anywhere in BookingService.
    Each resource type's rules are fully encapsulated here.
    """

    @abstractmethod
    async def validate_async(
        self, user_id: UUID, resource_id: UUID, slot: TimeSlot
    ) -> ValidationResult:
        """
        Validate a booking request against resource-type-specific rules.

        Returns:
            ValidationResult with ok=True if booking is allowed.
            If ok=False, reason contains a human-readable rejection message.
            If needs_approval=True, booking enters RESERVED state pending admin action.
        """
        ...
