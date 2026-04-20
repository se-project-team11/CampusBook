import pytest
from datetime import datetime, timedelta
from uuid import uuid4

from app.models.time_slot import TimeSlot
from app.strategies.registry import StrategyRegistry
from app.strategies.study_validation_strategy import StudyValidationStrategy
from app.strategies.lab_validation_strategy import LabValidationStrategy
from app.strategies.sports_validation_strategy import SportsValidationStrategy
from app.strategies.seminar_validation_strategy import SeminarValidationStrategy


class MockResult:
    def __init__(self, scalar_val):
        self._scalar_val = scalar_val
    def scalar_one_or_none(self):
        return self._scalar_val

class MockSession:
    def __init__(self, return_row=None):
        self.return_row = return_row
    async def execute(self, query):
        return MockResult(self.return_row)

class MockResourceRow:
    def __init__(self, type):
        self.type = type


@pytest.mark.asyncio
async def test_strategy_registry_returns_correct_strategies():
    registry = StrategyRegistry(session=None)
    
    registry._session = MockSession(MockResourceRow(type="STUDY_ROOM"))
    assert isinstance(await registry.get_for_resource(uuid4()), StudyValidationStrategy)

    registry._session = MockSession(MockResourceRow(type="LAB"))
    assert isinstance(await registry.get_for_resource(uuid4()), LabValidationStrategy)

    registry._session = MockSession(MockResourceRow(type="SPORTS"))
    assert isinstance(await registry.get_for_resource(uuid4()), SportsValidationStrategy)

    registry._session = MockSession(MockResourceRow(type="SEMINAR"))
    assert isinstance(await registry.get_for_resource(uuid4()), SeminarValidationStrategy)


@pytest.mark.asyncio
async def test_study_validation_strategy():
    strategy = StudyValidationStrategy()
    user_id = uuid4()
    resource_id = uuid4()
    now = datetime.utcnow()
    
    # Valid: 2 hours
    slot_valid = TimeSlot(now, now + timedelta(hours=2))
    res = await strategy.validate_async(user_id, resource_id, slot_valid)
    assert res.ok is True
    assert res.needs_approval is False
    
    # Invalid: 5 hours (max 4)
    slot_invalid = TimeSlot(now, now + timedelta(hours=5))
    res = await strategy.validate_async(user_id, resource_id, slot_invalid)
    assert res.ok is False
    assert "4 hours" in res.reason


@pytest.mark.asyncio
async def test_lab_validation_strategy():
    strategy = LabValidationStrategy()
    user_id = uuid4()
    resource_id = uuid4()
    now = datetime.utcnow()
    
    # Valid: 2 hours
    slot_valid = TimeSlot(now, now + timedelta(hours=2))
    res = await strategy.validate_async(user_id, resource_id, slot_valid)
    assert res.ok is True
    
    # Invalid: 4 hours (max 3)
    slot_invalid = TimeSlot(now, now + timedelta(hours=4))
    res = await strategy.validate_async(user_id, resource_id, slot_invalid)
    assert res.ok is False
    assert "3 hours" in res.reason


@pytest.mark.asyncio
async def test_sports_validation_strategy():
    strategy = SportsValidationStrategy()
    user_id = uuid4()
    resource_id = uuid4()
    now = datetime.utcnow()
    
    # Valid: 1 hour
    slot_valid = TimeSlot(now, now + timedelta(hours=1))
    res = await strategy.validate_async(user_id, resource_id, slot_valid)
    assert res.ok is True
    
    # Invalid: 3 hours (max 2)
    slot_invalid = TimeSlot(now, now + timedelta(hours=3))
    res = await strategy.validate_async(user_id, resource_id, slot_invalid)
    assert res.ok is False
    assert "2 hours" in res.reason


@pytest.mark.asyncio
async def test_seminar_validation_strategy():
    strategy = SeminarValidationStrategy()
    user_id = uuid4()
    resource_id = uuid4()
    now = datetime.utcnow()
    
    # Valid: 6 hours
    slot_valid = TimeSlot(now, now + timedelta(hours=6))
    res = await strategy.validate_async(user_id, resource_id, slot_valid)
    assert res.ok is True
    
    # Invalid: 9 hours (max 8)
    slot_invalid = TimeSlot(now, now + timedelta(hours=9))
    res = await strategy.validate_async(user_id, resource_id, slot_invalid)
    assert res.ok is False
    assert "8 hours" in res.reason
