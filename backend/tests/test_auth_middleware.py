"""
Unit tests for JWT auth middleware.
Tests token creation, validation, RBAC enforcement, and error cases.
Uses FastAPI TestClient — no real DB or Redis needed.
"""
from __future__ import annotations

import uuid

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.auth.middleware import AuthUser, create_dev_token, get_current_user, require_roles

# ── Minimal test app — isolates middleware logic from service logic ────────────

test_app = FastAPI()


@test_app.get("/protected")
def protected_any(user: AuthUser = Depends(get_current_user)):
    return {"user_id": str(user.id), "role": user.role}


@test_app.get("/admin-only")
def admin_only(user: AuthUser = Depends(require_roles(["ROLE_DEPT_ADMIN"]))):
    return {"user_id": str(user.id), "role": user.role}


@test_app.get("/student-or-faculty")
def student_or_faculty(user: AuthUser = Depends(require_roles(["ROLE_STUDENT", "ROLE_FACULTY"]))):
    return {"user_id": str(user.id), "role": user.role}


client = TestClient(test_app)


def make_headers(role: str, user_id: uuid.UUID = None) -> dict:
    uid = user_id or uuid.uuid4()
    token = create_dev_token(uid, role, f"{role.lower()}@campus.edu")
    return {"Authorization": f"Bearer {token}"}


# ── Token Validation ──────────────────────────────────────────────────────────

class TestTokenValidation:

    def test_valid_student_token_accepted(self):
        resp = client.get("/protected", headers=make_headers("ROLE_STUDENT"))
        assert resp.status_code == 200
        assert resp.json()["role"] == "ROLE_STUDENT"

    def test_valid_faculty_token_accepted(self):
        resp = client.get("/protected", headers=make_headers("ROLE_FACULTY"))
        assert resp.status_code == 200

    def test_valid_admin_token_accepted(self):
        resp = client.get("/protected", headers=make_headers("ROLE_DEPT_ADMIN"))
        assert resp.status_code == 200

    def test_valid_facilities_token_accepted(self):
        resp = client.get("/protected", headers=make_headers("ROLE_FACILITIES"))
        assert resp.status_code == 200

    def test_missing_token_returns_403(self):
        # HTTPBearer returns 403 (not 401) when no credentials are provided
        resp = client.get("/protected")
        assert resp.status_code == 403

    def test_malformed_token_returns_401(self):
        resp = client.get("/protected", headers={"Authorization": "Bearer not.a.jwt"})
        assert resp.status_code == 401

    def test_user_id_extracted_correctly(self):
        uid = uuid.uuid4()
        resp = client.get("/protected", headers=make_headers("ROLE_STUDENT", uid))
        assert resp.json()["user_id"] == str(uid)


# ── RBAC ──────────────────────────────────────────────────────────────────────

class TestRBAC:

    def test_student_cannot_access_admin_endpoint(self):
        """
        NFR security test: ROLE_STUDENT JWT → admin endpoint → 403 Forbidden.
        BookingService is never called (dependency raises before route body).
        """
        resp = client.get("/admin-only", headers=make_headers("ROLE_STUDENT"))
        assert resp.status_code == 403
        assert "Access denied" in resp.json()["detail"]

    def test_faculty_cannot_access_admin_endpoint(self):
        resp = client.get("/admin-only", headers=make_headers("ROLE_FACULTY"))
        assert resp.status_code == 403

    def test_facilities_cannot_access_admin_endpoint(self):
        resp = client.get("/admin-only", headers=make_headers("ROLE_FACILITIES"))
        assert resp.status_code == 403

    def test_admin_can_access_admin_endpoint(self):
        resp = client.get("/admin-only", headers=make_headers("ROLE_DEPT_ADMIN"))
        assert resp.status_code == 200

    def test_student_can_access_student_or_faculty_endpoint(self):
        resp = client.get("/student-or-faculty", headers=make_headers("ROLE_STUDENT"))
        assert resp.status_code == 200

    def test_faculty_can_access_student_or_faculty_endpoint(self):
        resp = client.get("/student-or-faculty", headers=make_headers("ROLE_FACULTY"))
        assert resp.status_code == 200

    def test_admin_cannot_access_student_or_faculty_endpoint(self):
        resp = client.get("/student-or-faculty", headers=make_headers("ROLE_DEPT_ADMIN"))
        assert resp.status_code == 403

    def test_facilities_cannot_access_student_or_faculty_endpoint(self):
        resp = client.get("/student-or-faculty", headers=make_headers("ROLE_FACILITIES"))
        assert resp.status_code == 403
