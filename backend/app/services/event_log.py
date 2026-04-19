from __future__ import annotations

from abc import ABC, abstractmethod

from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import DomainEventRow
from app.models.domain_events import DomainEvent


class DomainEventLog(ABC):
    """
    Abstract domain event log — allows InMemoryDomainEventLog in unit tests
    and PostgresDomainEventLog in production.

    Domain Events pattern: all booking state changes are recorded to an
    append-only log. This enables:
    - Full audit trail (who booked what and when)
    - Event replay for debugging / analytics
    - Decoupled notification pipeline (NotificationService reads events)
    """

    @abstractmethod
    async def append(self, event: DomainEvent) -> None:
        """Persist the event. Must not raise on success."""
        ...


class PostgresDomainEventLog(DomainEventLog):
    """Production: writes to domain_events table. Session managed by caller."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def append(self, event: DomainEvent) -> None:
        stmt = insert(DomainEventRow).values(
            event_type=type(event).__name__,
            payload=event.to_dict(),
        )
        await self._session.execute(stmt)
        await self._session.commit()


class InMemoryDomainEventLog(DomainEventLog):
    """
    Test double — stores events in a list.
    Use .events property to assert which events were emitted.
    """

    def __init__(self) -> None:
        self.events: list[DomainEvent] = []

    async def append(self, event: DomainEvent) -> None:
        self.events.append(event)

    def count(self) -> int:
        return len(self.events)

    def last(self) -> DomainEvent:
        return self.events[-1]

    def of_type(self, event_cls) -> list:
        return [e for e in self.events if isinstance(e, event_cls)]
