"""
CheckInService — F2 QR Code Check-In & Redis TTL Auto-Release.

Handles two main flows:
1. Active: User scans QR code at venue -> validate -> mark CHECKED_IN.
2. Passive: Redis TTL expires (no show) -> mark NO_SHOW -> promote waitlist (clear waitlist after).
"""
import asyncio
import json
import logging
import secrets
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import BookingRow, WaitlistRow
from app.models.booking import BookingState
from app.services.catalogue_service import CatalogueService

logger = logging.getLogger(__name__)


class CheckInService:
    """
    F2: QR Code Check-In + Redis TTL Auto-Release.
    Listens to Redis keyspace events for booking_ttl:* expiry.
    """

    def __init__(self, redis, session_factory, notification_svc, catalogue_svc):
        self._redis = redis
        self._sessions = session_factory  # Factory needed because listener runs in background
        self._notif = notification_svc
        self._catalogue = catalogue_svc

    async def validate_qr(self, db: AsyncSession, qr_token: str) -> dict:
        """Called when user scans their QR code at the venue."""
        result = await db.execute(
            select(BookingRow).where(
                BookingRow.qr_token == qr_token,
                BookingRow.state == BookingState.CONFIRMED.value,
            )
        )
        booking = result.scalar_one_or_none()
        if not booking:
            return {"ok": False, "reason": "Invalid or already used QR code"}

        # State transition: CONFIRMED → CHECKED_IN
        await db.execute(
            update(BookingRow)
            .where(BookingRow.id == booking.id)
            .values(state=BookingState.CHECKED_IN.value)
        )
        await db.commit()

        # Delete Redis TTL key (prevents false no-show)
        await self._redis.delete(f"booking_ttl:{booking.id}")

        # Publish event for WebSocket hub
        await self._redis.publish(
            "booking.events",
            json.dumps(
                {
                    "event": "CheckInCompleted",
                    "booking_id": str(booking.id),
                    "resource_id": str(booking.resource_id),
                    "slot_start": booking.slot_start.isoformat(),
                }
            ),
        )

        return {
            "ok": True,
            "booking_id": str(booking.id),
            "resource_id": str(booking.resource_id),
        }

    async def start_ttl_listener(self):
        """
        Redis keyspace event listener — runs as a background asyncio task.
        When booking_ttl:{id} expires, triggers no-show workflow.
        Redis must be configured with: notify-keyspace-events KEA
        """
        pubsub = self._redis.pubsub()
        await pubsub.psubscribe("__keyevent@0__:expired")
        
        logger.info("[CheckInService] Started Redis TTL listener for booking_ttl:*")

        async for message in pubsub.listen():
            if message["type"] != "pmessage":
                continue
            
            key = message["data"]
            if isinstance(key, bytes):
                key = key.decode()
                
            if not key.startswith("booking_ttl:"):
                continue

            booking_id_str = key.split("booking_ttl:")[1]
            # Fire and forget no-show handler to avoid blocking the listener loop
            asyncio.create_task(self._handle_no_show(booking_id_str))

    async def _handle_no_show(self, booking_id_str: str):
        """Transitions booking to RELEASED, promotes first waitlist entry, clears waitlist."""
        try:
            booking_id = UUID(booking_id_str)

            async with self._sessions() as db:
                async with db.begin():
                    result = await db.execute(
                        select(BookingRow).where(
                            BookingRow.id == booking_id,
                            BookingRow.state == BookingState.CONFIRMED.value,
                        )
                    )
                    booking = result.scalar_one_or_none()
                    if not booking:
                        return

                    await db.execute(
                        update(BookingRow)
                        .where(BookingRow.id == booking_id)
                        .values(state=BookingState.RELEASED.value)
                    )

                    wl_result = await db.execute(
                        select(WaitlistRow).where(
                            WaitlistRow.resource_id == booking.resource_id,
                            WaitlistRow.slot_start == booking.slot_start,
                        )
                        .order_by(WaitlistRow.position)
                        .limit(1)
                    )
                    next_entry = wl_result.scalar_one_or_none()

                    promoted_user_id = None
                    new_booking_id = None

                    if next_entry:
                        from uuid import uuid4
                        new_booking = BookingRow(
                            id=uuid4(),
                            user_id=next_entry.user_id,
                            resource_id=booking.resource_id,
                            slot_start=booking.slot_start,
                            slot_end=booking.slot_end,
                            state=BookingState.CONFIRMED.value,
                            qr_token=secrets.token_urlsafe(32),
                        )
                        db.add(new_booking)
                        new_booking_id = str(new_booking.id)

                        await db.execute(
                            delete(WaitlistRow).where(
                                WaitlistRow.resource_id == booking.resource_id,
                                WaitlistRow.slot_start == booking.slot_start,
                            )
                        )

                        promoted_user_id = str(next_entry.user_id)

                        await self._redis.set(f"booking_ttl:{new_booking_id}", "1", ex=600)

                        slot_date = booking.slot_start.replace(tzinfo=timezone.utc).date()
                        await self._catalogue.invalidate_cache(booking.resource_id, slot_date)

                await self._redis.publish(
                    "booking.events",
                    json.dumps(
                        {
                            "event": "SlotReleased",
                            "resource_id": str(booking.resource_id),
                            "slot_start": booking.slot_start.isoformat(),
                            "promoted_user_id": promoted_user_id,
                            "new_booking_id": new_booking_id,
                        }
                    ),
                )

                logger.info(f"[CheckInService] No-show handled for booking {booking_id_str}")
        except Exception as e:
            logger.error(f"[CheckInService] Error handling no-show for {booking_id_str}: {e}")
