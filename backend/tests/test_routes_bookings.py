"""
HTTP-level tests for /api/bookings routes.
Uses FastAPI TestClient with a fully mocked BookingService.
No database connection required.

These tests verify:
- Correct HTTP status codes for all outcomes
- Correct JSON response shapes
- RBAC enforcement at the route level
- Error mapping (SlotUnavailableError → 409, etc.)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.auth.middleware import create_dev_token
from app.dependencies import get_booking_service
from app.main import app
from app.models.booking import Booking, BookingState
from app.models.time_slot import TimeSlot
from app.services.booking_service import (
    BookingNotFoundError,
    BookingPermissionError,
    BookingValidationError,
    ConcurrentBookingError,
    SlotUnavailableError,
)

# ── Test constants ─────────────────────────────────────────────────────────────

USER_ID     = uuid.uuid4()
RESOURCE_ID = uuid.uuid4()
BOOKING_ID  = uuid.uuid4()
QR_TOKEN    = "test-qr-token-abcdef123"
EXPIRES_AT  = datetime.utcnow() + timedelta(minutes=15)
SLOT_START  = datetime(2026, 4, 10, 9, 0)
SLOT_END    = datetime(2026, 4, 10, 10, 0)


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_confirmed_booking(user_id: uuid.UUID = None) -> Booking:
    return Booking(
        id=BOOKING_ID,
        user_id=user_id or USER_ID,
        resource_id=RESOURCE_ID,
        slot_start=SLOT_START,
        slot_end=SLOT_END,
        state=BookingState.CONFIRMED,
        qr_token=QR_TOKEN,
        expires_at=EXPIRES_AT,
        notes="Test booking",
    )


def make_mock_service(booking: Booking = None) -> AsyncMock:
    svc = AsyncMock()
    svc.create_booking.return_value    = booking or make_confirmed_booking()
    svc.get_booking.return_value       = booking or make_confirmed_booking()
    svc.get_user_bookings.return_value = [booking or make_confirmed_booking()]
    svc.cancel_booking.return_value    = None
    return svc


def make_headers(role: str, user_id: uuid.UUID = None) -> dict:
    uid   = user_id or USER_ID
    token = create_dev_token(uid, role, "user@campus.edu")
    return {"Authorization": f"Bearer {token}"}


def make_request_body(
    resource_id: uuid.UUID = None,
    slot_start: str = "2026-04-10T09:00:00",
    slot_end: str = "2026-04-10T10:00:00",
    notes: str = "",
) -> dict:
    return {
        "resource_id": str(resource_id or RESOURCE_ID),
        "slot_start":  slot_start,
        "slot_end":    slot_end,
        "notes":       notes,
    }


# ── POST /api/bookings/ ───────────────────────────────────────────────────────

class TestCreateBookingRoute:

    def test_create_booking_returns_201(self):
        mock_svc = make_mock_service()
        app.dependency_overrides[get_booking_service] = lambda: mock_svc
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.post(
            "/api/bookings/",
            json=make_request_body(),
            headers=make_headers("ROLE_STUDENT"),
        )
        assert resp.status_code == 201
        app.dependency_overrides.clear()

    def test_create_booking_response_contains_qr_token(self):
        mock_svc = make_mock_service()
        app.dependency_overrides[get_booking_service] = lambda: mock_svc
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.post(
            "/api/bookings/",
            json=make_request_body(),
            headers=make_headers("ROLE_STUDENT"),
        )
        assert resp.json()["qr_token"] == QR_TOKEN
        app.dependency_overrides.clear()

    def test_create_booking_response_state_confirmed(self):
        mock_svc = make_mock_service()
        app.dependency_overrides[get_booking_service] = lambda: mock_svc
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.post(
            "/api/bookings/",
            json=make_request_body(),
            headers=make_headers("ROLE_STUDENT"),
        )
        assert resp.json()["state"] == "CONFIRMED"
        app.dependency_overrides.clear()

    def test_faculty_can_create_booking(self):
        mock_svc = make_mock_service()
        app.dependency_overrides[get_booking_service] = lambda: mock_svc
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.post(
            "/api/bookings/",
            json=make_request_body(),
            headers=make_headers("ROLE_FACULTY"),
        )
        assert resp.status_code == 201
        app.dependency_overrides.clear()

    def test_facilities_cannot_create_booking(self):
        """RBAC: facilities staff cannot book resources."""
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post(
            "/api/bookings/",
            json=make_request_body(),
            headers=make_headers("ROLE_FACILITIES"),
        )
        assert resp.status_code == 403

    def test_admin_cannot_create_booking(self):
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post(
            "/api/bookings/",
            json=make_request_body(),
            headers=make_headers("ROLE_DEPT_ADMIN"),
        )
        assert resp.status_code == 403

    def test_slot_unavailable_returns_409(self):
        mock_svc = make_mock_service()
        mock_svc.create_booking.side_effect = SlotUnavailableError(
            RESOURCE_ID, TimeSlot(SLOT_START, SLOT_END)
        )
        app.dependency_overrides[get_booking_service] = lambda: mock_svc
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.post(
            "/api/bookings/",
            json=make_request_body(),
            headers=make_headers("ROLE_STUDENT"),
        )
        assert resp.status_code == 409
        app.dependency_overrides.clear()

    def test_concurrent_booking_returns_409(self):
        mock_svc = make_mock_service()
        mock_svc.create_booking.side_effect = ConcurrentBookingError()
        app.dependency_overrides[get_booking_service] = lambda: mock_svc
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.post(
            "/api/bookings/",
            json=make_request_body(),
            headers=make_headers("ROLE_STUDENT"),
        )
        assert resp.status_code == 409
        app.dependency_overrides.clear()

    def test_validation_failure_returns_422(self):
        mock_svc = make_mock_service()
        mock_svc.create_booking.side_effect = BookingValidationError("Lab bookings max 3 hours")
        app.dependency_overrides[get_booking_service] = lambda: mock_svc
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.post(
            "/api/bookings/",
            json=make_request_body(),
            headers=make_headers("ROLE_STUDENT"),
        )
        assert resp.status_code == 422
        assert "max 3 hours" in resp.json()["detail"]
        app.dependency_overrides.clear()

    def test_end_before_start_returns_422(self):
        """Pydantic validator rejects slot_end before slot_start before service is called."""
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post(
            "/api/bookings/",
            json=make_request_body(
                slot_start="2026-04-10T10:00:00",
                slot_end="2026-04-10T09:00:00",
            ),
            headers=make_headers("ROLE_STUDENT"),
        )
        assert resp.status_code == 422

    def test_unauthenticated_returns_403(self):
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/bookings/", json=make_request_body())
        assert resp.status_code == 403


# ── GET /api/bookings/{id} ────────────────────────────────────────────────────

class TestGetBookingRoute:

    def test_owner_can_get_own_booking(self):
        mock_svc = make_mock_service(make_confirmed_booking(USER_ID))
        app.dependency_overrides[get_booking_service] = lambda: mock_svc
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.get(
            f"/api/bookings/{BOOKING_ID}",
            headers=make_headers("ROLE_STUDENT", USER_ID),
        )
        assert resp.status_code == 200
        app.dependency_overrides.clear()

    def test_student_cannot_get_other_users_booking(self):
        other_user_booking = make_confirmed_booking(user_id=uuid.uuid4())
        mock_svc = make_mock_service(other_user_booking)
        app.dependency_overrides[get_booking_service] = lambda: mock_svc
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.get(
            f"/api/bookings/{BOOKING_ID}",
            headers=make_headers("ROLE_STUDENT", USER_ID),  # different user
        )
        assert resp.status_code == 403
        app.dependency_overrides.clear()

    def test_admin_can_get_any_booking(self):
        other_user_booking = make_confirmed_booking(user_id=uuid.uuid4())
        mock_svc = make_mock_service(other_user_booking)
        app.dependency_overrides[get_booking_service] = lambda: mock_svc
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.get(
            f"/api/bookings/{BOOKING_ID}",
            headers=make_headers("ROLE_DEPT_ADMIN"),
        )
        assert resp.status_code == 200
        app.dependency_overrides.clear()

    def test_not_found_returns_404(self):
        mock_svc = make_mock_service()
        mock_svc.get_booking.side_effect = BookingNotFoundError(BOOKING_ID)
        app.dependency_overrides[get_booking_service] = lambda: mock_svc
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.get(
            f"/api/bookings/{BOOKING_ID}",
            headers=make_headers("ROLE_STUDENT", USER_ID),
        )
        assert resp.status_code == 404
        app.dependency_overrides.clear()


# ── DELETE /api/bookings/{id} ─────────────────────────────────────────────────

class TestCancelBookingRoute:

    def test_cancel_own_booking_returns_204(self):
        mock_svc = make_mock_service()
        app.dependency_overrides[get_booking_service] = lambda: mock_svc
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.delete(
            f"/api/bookings/{BOOKING_ID}",
            headers=make_headers("ROLE_STUDENT", USER_ID),
        )
        assert resp.status_code == 204
        app.dependency_overrides.clear()

    def test_cancel_other_users_booking_returns_403(self):
        mock_svc = make_mock_service()
        mock_svc.cancel_booking.side_effect = BookingPermissionError()
        app.dependency_overrides[get_booking_service] = lambda: mock_svc
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.delete(
            f"/api/bookings/{BOOKING_ID}",
            headers=make_headers("ROLE_STUDENT"),
        )
        assert resp.status_code == 403
        app.dependency_overrides.clear()

    def test_cancel_nonexistent_booking_returns_404(self):
        mock_svc = make_mock_service()
        mock_svc.cancel_booking.side_effect = BookingNotFoundError(BOOKING_ID)
        app.dependency_overrides[get_booking_service] = lambda: mock_svc
        client = TestClient(app, raise_server_exceptions=False)

        resp = client.delete(
            f"/api/bookings/{BOOKING_ID}",
            headers=make_headers("ROLE_STUDENT"),
        )
        assert resp.status_code == 404
        app.dependency_overrides.clear()

    def test_facilities_cannot_cancel_booking(self):
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.delete(
            f"/api/bookings/{BOOKING_ID}",
            headers=make_headers("ROLE_FACILITIES"),
        )
        assert resp.status_code == 403
