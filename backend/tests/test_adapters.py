import pytest
from uuid import uuid4

from app.adapters.registry import AdapterRegistry
from app.adapters.study_room_adapter import StudyRoomAdapter
from app.adapters.lab_adapter import LabAdapter
from app.adapters.sports_adapter import SportsAdapter


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
    def __init__(self, id, name, type, capacity=10, location="Loc", amenities=None):
        self.id = id
        self.name = name
        self.type = type
        self.capacity = capacity
        self.location = location
        self.amenities = amenities or []


@pytest.mark.asyncio
async def test_adapter_registry_returns_correct_adapters():
    """Test that the factory returns the correct adapter type for each resource type."""
    registry = AdapterRegistry(session=None)
    
    # Test STUDY_ROOM
    session_study = MockSession(MockResourceRow(id=uuid4(), name="Study", type="STUDY_ROOM"))
    registry._session = session_study
    adapter = await registry.get_for_resource(uuid4())
    assert isinstance(adapter, StudyRoomAdapter)

    # Test LAB
    session_lab = MockSession(MockResourceRow(id=uuid4(), name="Lab", type="LAB"))
    registry._session = session_lab
    adapter = await registry.get_for_resource(uuid4())
    assert isinstance(adapter, LabAdapter)

    # Test SPORTS
    session_sports = MockSession(MockResourceRow(id=uuid4(), name="Sports", type="SPORTS"))
    registry._session = session_sports
    adapter = await registry.get_for_resource(uuid4())
    assert isinstance(adapter, SportsAdapter)
    
    # Test SEMINAR uses StudyRoomAdapter
    session_seminar = MockSession(MockResourceRow(id=uuid4(), name="Seminar", type="SEMINAR"))
    registry._session = session_seminar
    adapter = await registry.get_for_resource(uuid4())
    assert isinstance(adapter, StudyRoomAdapter)


@pytest.mark.asyncio
async def test_adapter_registry_raises_for_unknown_resource():
    session = MockSession(return_row=None)
    registry = AdapterRegistry(session)
    
    with pytest.raises(ValueError, match="Resource .* not found"):
        await registry.get_for_resource(uuid4())


@pytest.mark.asyncio
async def test_adapter_registry_raises_for_unknown_type():
    session = MockSession(MockResourceRow(id=uuid4(), name="Unknown", type="UNKNOWN_TYPE"))
    registry = AdapterRegistry(session)
    
    with pytest.raises(ValueError, match="No adapter registered for resource type 'UNKNOWN_TYPE'"):
        await registry.get_for_resource(uuid4())


@pytest.mark.asyncio
async def test_adapter_get_details():
    res_id = uuid4()
    session = MockSession(MockResourceRow(
        id=res_id, name="Test Room", type="STUDY_ROOM", capacity=5, location="North", amenities=["WiFi"]
    ))
    adapter = StudyRoomAdapter(session)
    
    dto = await adapter.get_details(res_id)
    assert dto.id == res_id
    assert dto.name == "Test Room"
    assert dto.capacity == 5
    assert dto.location == "North"
    assert "WiFi" in dto.amenities
