"""
StrategyRegistry — Factory that maps resource type → ValidationStrategy.

SOLID OCP: Adding a new resource type requires only:
  1. Create NewTypeValidationStrategy(ValidationStrategy)
  2. Register "NEW_TYPE": NewTypeValidationStrategy() here
  BookingService never changes.

GRASP Protected Variation: BookingService is shielded from knowing which
strategy handles which resource type. The registry is the single point of
variation.
"""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ResourceRow
from app.strategies.validation_strategy import ValidationStrategy
from app.strategies.study_validation_strategy import StudyValidationStrategy
from app.strategies.lab_validation_strategy import LabValidationStrategy
from app.strategies.sports_validation_strategy import SportsValidationStrategy
from app.strategies.seminar_validation_strategy import SeminarValidationStrategy


class StrategyRegistry:
    """
    Factory that returns the appropriate ValidationStrategy for a resource's type.
    SOLID OCP: adding a new resource type = add new strategy + register here.
    BookingService never changes.
    """

    def __init__(self, session: AsyncSession):
        self._session = session
        self._strategies: dict[str, ValidationStrategy] = {
            "STUDY_ROOM": StudyValidationStrategy(),
            "LAB":        LabValidationStrategy(),
            "SPORTS":     SportsValidationStrategy(),
            "SEMINAR":    SeminarValidationStrategy(),
        }

    async def get_for_resource(self, resource_id: UUID) -> ValidationStrategy:
        """
        Look up the resource's type in the database, then return the
        matching strategy instance.

        Raises:
            ValueError: if resource_id doesn't exist or type is unknown.
        """
        result = await self._session.execute(
            select(ResourceRow).where(ResourceRow.id == resource_id)
        )
        row = result.scalar_one_or_none()
        if not row:
            raise ValueError(f"Resource {resource_id} not found")
        strategy = self._strategies.get(row.type)
        if not strategy:
            raise ValueError(
                f"No validation strategy registered for resource type '{row.type}'"
            )
        return strategy
