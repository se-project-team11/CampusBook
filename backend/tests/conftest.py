"""
Shared pytest fixtures for async DB and Redis test setup.
"""
from __future__ import annotations

import asyncio
import os
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

import pytest
import pytest_asyncio

from app.db.base import Base
from app.models.booking import Booking, BookingState
from app.models.time_slot import TimeSlot
from app.repositories.inmemory_booking_repository import InMemoryBookingRepository
from app.services.booking_service import BookingService
from app.services.event_log import DomainEventLog
from app.services.state_manager import BookingStateMgr


# ── Event loop ────────────────────────────────────────────────────────────────

@pytest.fixture(scope="session")
def event_loop():
    """Single event loop for the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


# ── In-memory fakes ───────────────────────────────────────────────────────────

@pytest.fixture
def booking_repo() -> InMemoryBookingRepository:
    return InMemoryBookingRepository()


@pytest.fixture
def state_mgr() -> BookingStateMgr:
    return BookingStateMgr()


@pytest.fixture
def mock_redis() -> AsyncMock:
    redis = AsyncMock()
    redis.set = AsyncMock(return_value=True)
    redis.get = AsyncMock(return_value=None)
    redis.delete = AsyncMock(return_value=1)
    redis.publish = AsyncMock(return_value=1)
    return redis


@pytest.fixture
def mock_event_log() -> AsyncMock:
    log = AsyncMock(spec=DomainEventLog)
    log.append = AsyncMock()
    return log


@pytest.fixture
def mock_adapter_registry() -> AsyncMock:
    adapter = AsyncMock()
    adapter.check_availability = AsyncMock(return_value=True)
    registry = AsyncMock()
    registry.get_for_resource = AsyncMock(return_value=adapter)
    return registry


@pytest.fixture
def mock_strategy_registry() -> AsyncMock:
    from app.models.validation_result import ValidationResult
    result = ValidationResult(ok=True, reason="", needs_approval=False)
    strategy = AsyncMock()
    strategy.validate_async = AsyncMock(return_value=result)
    registry = AsyncMock()
    registry.get_for_resource = AsyncMock(return_value=strategy)
    return registry


@pytest.fixture
def mock_notification_svc() -> AsyncMock:
    svc = AsyncMock()
    svc.on_booking_event = AsyncMock()
    return svc


@pytest.fixture
def booking_service(
    booking_repo,
    state_mgr,
    mock_event_log,
    mock_adapter_registry,
    mock_strategy_registry,
    mock_notification_svc,
    mock_redis,
) -> BookingService:
    return BookingService(
        adapter_registry=mock_adapter_registry,
        strategy_registry=mock_strategy_registry,
        booking_repo=booking_repo,
        state_mgr=state_mgr,
        event_log=mock_event_log,
        notification_svc=mock_notification_svc,
        redis=mock_redis,
    )


# ── Domain helpers ────────────────────────────────────────────────────────────

@pytest.fixture
def sample_user_id():
    return uuid4()


@pytest.fixture
def sample_resource_id():
    return uuid4()


@pytest.fixture
def sample_slot():
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    return TimeSlot(start=now + timedelta(hours=2), end=now + timedelta(hours=3))
