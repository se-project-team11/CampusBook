import pytest
import asyncio
import time
import json
from uuid import uuid4
from fastapi.testclient import TestClient
from fastapi.websockets import WebSocketDisconnect

from app.main import app
from app.websocket.hub import hub

# Minimal test for websocket connectivity and hub logic
# We skip full end-to-end lag testing requiring real Redis and multiple clients,
# and instead verify the hub broadcasts correctly.

@pytest.mark.asyncio
async def test_websocket_hub_broadcast():
    """Test that the hub routes messages to the correct resource room."""
    resource_id = str(uuid4())
    other_resource = str(uuid4())
    
    class MockWebSocket:
        def __init__(self):
            self.messages = []
            
        async def accept(self): pass
        
        async def send_json(self, data):
            self.messages.append(data)
            
    ws1 = MockWebSocket()
    ws2 = MockWebSocket()
    ws_other = MockWebSocket()
    
    # Connect
    await hub.connect(ws1, resource_id)
    await hub.connect(ws2, resource_id)
    await hub.connect(ws_other, other_resource)
    
    # Broadcast
    msg = {"event": "TestEvent", "data": "hello"}
    await hub.broadcast_to_room(resource_id, msg)
    
    # Verify
    assert len(ws1.messages) == 1
    assert len(ws2.messages) == 1
    assert len(ws_other.messages) == 0
    assert ws1.messages[0] == msg
    
    # Disconnect
    hub.disconnect(ws1, resource_id)
    await hub.broadcast_to_room(resource_id, {"event": "Second"})
    
    assert len(ws1.messages) == 1 # Unchanged
    assert len(ws2.messages) == 2 # Received second

# Optional: real lag test using TestClient context manager if full stack is running
# @pytest.mark.asyncio
# @pytest.mark.skip(reason="Requires running app")
# async def test_websocket_lag_under_5s(redis_client):
#     client = TestClient(app)
#     resource_id = str(uuid4())
#     
#     with client.websocket_connect(f"/api/ws/{resource_id}") as websocket:
#         t0 = time.time()
#         await redis_client.publish("booking.events", json.dumps({"resource_id": resource_id, "test": "ping"}))
#         
#         data = websocket.receive_json()
#         lag_ms = (time.time() - t0) * 1000
#         
#         assert "test" in data
#         assert lag_ms < 5000 # Target < 5s
