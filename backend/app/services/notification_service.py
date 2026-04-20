"""
NotificationService — Observer pattern Subject + Circuit Breaker.

BookingService calls on_booking_event(event) and forgets. This service
fans out the event to all registered channels (Observers).

Architectural Tactic: Circuit Breaker
Protects the booking flow from third-party API outages (e.g., SendGrid down).
If a channel fails repeatedly, its circuit opens, and subsequent calls drop
silently until the recovery window passes. Booking NEVER fails due to notification
failure.
"""
import asyncio
import json
import logging
import time
from abc import ABC, abstractmethod

from app.models.domain_events import DomainEvent

logger = logging.getLogger(__name__)


class NotificationChannel(ABC):
    """Observer interface — each channel is a ConcreteObserver."""

    @abstractmethod
    async def send(self, event: DomainEvent, recipient: str = "") -> None:
        """Send the notification. Exceptions are caught by CircuitBreaker."""
        ...


class CircuitBreaker:
    """
    Wraps an async call. Opens after `threshold` failures in `window_seconds`.
    When open, calls are dropped (fast failure) to prevent cascading failures.
    """

    def __init__(self, threshold: int = 3, recovery_seconds: int = 30):
        self._threshold = threshold
        self._recovery = recovery_seconds
        self._failures = 0
        self._open = False
        self._open_since = 0.0

    async def call(self, coro):
        if self._open:
            if time.time() - self._open_since > self._recovery:
                # Half-open: try once. If it succeeds, close circuit.
                self._open = False
                self._failures = 0
                logger.info("Circuit breaker half-open: attempting recovery")
            else:
                logger.debug("Circuit breaker open: dropping call")
                return  # Drop call silently

        try:
            await coro
            self._failures = 0  # Reset on success
        except Exception as e:
            self._failures += 1
            logger.warning(f"Circuit breaker recorded failure ({self._failures}/{self._threshold}): {e}")
            if self._failures >= self._threshold:
                self._open = True
                self._open_since = time.time()
                logger.error("Circuit breaker TRIPPED OPEN")
            raise  # Re-raise so NotificationService can log it if needed


class EmailChannel(NotificationChannel):
    """ConcreteObserver — stub for email delivery (e.g., SendGrid)."""

    def __init__(self):
        self._breaker = CircuitBreaker()

    async def send(self, event: DomainEvent, recipient: str = "") -> None:
        async def _send():
            # In production: SMTP or REST API call here
            logger.info(f"[EMAIL] To {recipient or 'user'}: {type(event).__name__}")
        
        await self._breaker.call(_send())


class SMSChannel(NotificationChannel):
    """ConcreteObserver — stub for SMS delivery (e.g., Twilio)."""

    def __init__(self):
        self._breaker = CircuitBreaker()

    async def send(self, event: DomainEvent, recipient: str = "") -> None:
        async def _send():
            # In production: SMS API call here
            logger.info(f"[SMS] To {recipient or 'user'}: {type(event).__name__}")
        
        await self._breaker.call(_send())


class WebSocketChannel(NotificationChannel):
    """
    ConcreteObserver — publishes event to Redis pub/sub.
    The WebSocketHub listens to this channel and broadcasts to connected clients.
    """

    def __init__(self, redis):
        self._redis = redis
        # Redis publish is fast and reliable; typically no circuit breaker needed,
        # but could wrap with one if Redis is external.

    async def send(self, event: DomainEvent, recipient: str = "") -> None:
        payload = json.dumps(
            {
                "event": type(event).__name__,
                "data": event.to_dict(),
            }
        )
        # We assume the event dict has a resource_id, which the hub uses for routing
        try:
            await self._redis.publish("booking.events", payload)
        except Exception as e:
            logger.error(f"[WebSocketChannel] Failed to publish to Redis: {e}")


class NotificationService:
    """
    Observer pattern Subject.
    BookingService calls on_booking_event(); this fans out to all registered channels.
    SOLID OCP: Adding a PushNotificationChannel = zero changes to BookingService.
    """

    def __init__(self, channels: list[NotificationChannel]):
        self._channels = channels

    async def on_booking_event(self, event: DomainEvent, recipient: str = "") -> None:
        """
        Fan out event to all channels concurrently.
        Failures in one channel do not affect others, nor do they fail the caller.
        """
        tasks = [ch.send(event, recipient) for ch in self._channels]
        # return_exceptions=True prevents one channel's failure from cancelling the gather
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for r in results:
            if isinstance(r, Exception):
                logger.warning(f"[NotificationService] Channel failed: {r}")
