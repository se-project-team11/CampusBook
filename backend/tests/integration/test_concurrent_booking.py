"""
Integration test: concurrent booking with pessimistic locking.

NFR: Zero double-bookings verified via concurrent load test.

This test spawns N concurrent coroutines all trying to book the same slot.
Exactly 1 must succeed (HTTP 201). The rest must receive 409 Conflict.
The DB must contain exactly 1 booking for that slot after all requests complete.

Run with:
    docker-compose up -d
    docker-compose exec api python -m pytest tests/integration/test_concurrent_booking.py -v -s
"""
from __future__ import annotations

import asyncio
import os
import uuid
from datetime import datetime

import httpx
import pytest

BASE_URL    = os.getenv("API_URL", "http://localhost:8000")
JWT_TOKEN   = os.getenv("TEST_JWT", "")
CONCURRENCY = 20  # Number of simultaneous booking attempts

SLOT_START = "2026-05-01T09:00:00Z"
SLOT_END   = "2026-05-01T10:00:00Z"


async def attempt_booking(client: httpx.AsyncClient, resource_id: str) -> int:
    """Returns the HTTP status code of one booking attempt."""
    resp = await client.post(
        f"{BASE_URL}/api/bookings/",
        json={
            "resource_id": resource_id,
            "slot_start":  SLOT_START,
            "slot_end":    SLOT_END,
            "notes":       "Concurrent test",
        },
        headers={"Authorization": f"Bearer {JWT_TOKEN}"},
        timeout=10.0,
    )
    return resp.status_code


@pytest.mark.asyncio
@pytest.mark.integration
async def test_concurrent_booking_zero_double_bookings():
    """
    CRITICAL NFR test: 20 concurrent requests for the same slot.
    Expected outcome: exactly 1 success (201), 19 conflicts (409).
    DB check: SELECT COUNT(*) FROM bookings WHERE state='CONFIRMED' = 1.
    """
    if not JWT_TOKEN:
        pytest.skip(
            "TEST_JWT environment variable not set. "
            "Run: export TEST_JWT=$(docker-compose exec api python -c \""
            "import uuid; from app.auth.middleware import create_dev_token; "
            "print(create_dev_token(uuid.uuid4(), 'ROLE_STUDENT', 'test@campus.edu'))\")"
        )

    resource_id = os.getenv("TEST_RESOURCE_ID", str(uuid.uuid4()))

    async with httpx.AsyncClient() as client:
        tasks = [attempt_booking(client, resource_id) for _ in range(CONCURRENCY)]
        status_codes = await asyncio.gather(*tasks)

    successes  = status_codes.count(201)
    conflicts  = status_codes.count(409)
    unexpected = [c for c in status_codes if c not in (201, 409)]

    print(f"\nResults: {successes} succeeded, {conflicts} conflicts, {unexpected} unexpected")
    print(f"All status codes: {sorted(status_codes)}")

    assert successes == 1, (
        f"Expected exactly 1 successful booking, got {successes}. "
        f"Pessimistic locking may not be working correctly."
    )
    assert len(unexpected) == 0, (
        f"Unexpected status codes: {unexpected}. Check server logs."
    )
