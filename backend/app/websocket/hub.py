"""
WebSocketHub — F3 Real-time availability updates.

Subscribes to Redis pub/sub channel 'booking.events'.
Broadcasts to all Socket.io rooms watching a given resource.
This bridges the gap between horizontal FastAPI instances.
"""
import asyncio
import json
import logging
from datetime import datetime, timezone

import redis.asyncio as aioredis
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class WebSocketHub:
    """
    Manages WebSocket connections and routes Redis pub/sub messages to them.
    Rooms are organized by resource_id.
    """

    def __init__(self, redis_url: str):
        self._redis_url = redis_url
        self._rooms: dict[str, set[WebSocket]] = {}  # resource_id → set of WebSockets

    async def connect(self, websocket: WebSocket, resource_id: str):
        """Accept connection and add to resource room."""
        await websocket.accept()
        if resource_id not in self._rooms:
            self._rooms[resource_id] = set()
        self._rooms[resource_id].add(websocket)
        logger.debug(f"WebSocket connected to room {resource_id}. Total: {len(self._rooms[resource_id])}")

    def disconnect(self, websocket: WebSocket, resource_id: str):
        """Remove connection from resource room."""
        if resource_id in self._rooms:
            self._rooms[resource_id].discard(websocket)
            if not self._rooms[resource_id]:
                del self._rooms[resource_id]
            logger.debug(f"WebSocket disconnected from room {resource_id}")

    async def broadcast_to_room(self, resource_id: str, message: dict):
        """Send message to all websockets watching a specific resource."""
        if resource_id not in self._rooms:
            return

        message.setdefault("timestamp", datetime.now(timezone.utc).isoformat())

        dead_connections = set()
        for ws in self._rooms[resource_id]:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.debug(f"Failed to send to websocket: {e}")
                dead_connections.add(ws)
                
        # Clean up dead connections
        for dead_ws in dead_connections:
            self._rooms[resource_id].discard(dead_ws)
            
        if not self._rooms[resource_id]:
            del self._rooms[resource_id]

    async def start_redis_listener(self):
        """
        Background task: forward Redis pub/sub messages to WebSocket rooms.
        Listens to 'booking.events' channel.
        """
        try:
            r = aioredis.from_url(self._redis_url)
            pubsub = r.pubsub()
            await pubsub.subscribe("booking.events")
            
            logger.info("[WebSocketHub] Started listening to Redis 'booking.events'")

            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                    
                try:
                    data = json.loads(message["data"])
                    resource_id = data.get("data", {}).get("resource_id") or data.get("resource_id")
                    if resource_id:
                        await self.broadcast_to_room(resource_id, data)
                except Exception as e:
                    logger.error(f"[WebSocketHub] Error processing message: {e}")
        except asyncio.CancelledError:
            logger.info("[WebSocketHub] Listener task cancelled")
        except Exception as e:
            logger.error(f"[WebSocketHub] Listener task failed: {e}")


# Singleton instance, initialized with default Redis URL
# (Will be overridden with env var in main.py)
import os
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
hub = WebSocketHub(REDIS_URL)
