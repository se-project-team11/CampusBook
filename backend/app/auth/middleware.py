"""
JWT authentication and Role-Based Access Control (RBAC) middleware.

Architectural tactic: RBAC at API Gateway — role claims in JWT are validated
before any request reaches the service layer. A ROLE_STUDENT JWT hitting an
admin endpoint receives a 403 Forbidden with zero service calls made.

This satisfies the NFR security test:
  Send ROLE_STUDENT JWT → admin endpoint → Assert 403 → Assert no service log entry.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# ── Configuration ─────────────────────────────────────────────────────────────
JWT_SECRET    = os.getenv("JWT_SECRET", "campusbook-dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"

# Valid role values — must match devAccounts and JWTs
VALID_ROLES = frozenset({
    "ROLE_STUDENT",
    "ROLE_FACULTY",
    "ROLE_DEPT_ADMIN",
    "ROLE_FACILITIES",
})

bearer_scheme = HTTPBearer(auto_error=True)


# ── Auth user dataclass ────────────────────────────────────────────────────────

@dataclass(frozen=True)
class AuthUser:
    """
    Represents the authenticated caller extracted from a valid JWT.
    Injected into route handlers via Depends(get_current_user).
    Immutable — no route handler should mutate auth state.
    """
    id:    UUID
    role:  str
    email: str


# ── Dependency functions ───────────────────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AuthUser:
    """
    FastAPI dependency that validates the JWT and returns the AuthUser.
    Raises HTTP 401 for missing, expired, or malformed tokens.
    Raises HTTP 403 for unrecognised roles.

    Usage in routes:
        user: AuthUser = Depends(get_current_user)
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Extract required claims
    try:
        user_id = UUID(payload["sub"])
        role    = payload["role"]
        email   = payload.get("email", "")
    except (KeyError, ValueError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token missing required claims: {e}",
        )

    if role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Unrecognised role '{role}' in token.",
        )

    return AuthUser(id=user_id, role=role, email=email)


def require_roles(allowed_roles: List[str]):
    """
    Factory that returns a FastAPI dependency enforcing role-based access.

    RBAC at gateway: if the authenticated user's role is not in allowed_roles,
    the request is rejected with 403 before reaching BookingService.

    Usage in routes:
        user: AuthUser = Depends(require_roles(["ROLE_STUDENT", "ROLE_FACULTY"]))

    NFR security test:
        student JWT → endpoint decorated with require_roles(["ROLE_DEPT_ADMIN"])
        → 403 Forbidden, BookingService never called.
    """
    def _check_role(
        user: AuthUser = Depends(get_current_user),
    ) -> AuthUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. Your role is '{user.role}'. "
                    f"Required: one of {allowed_roles}."
                ),
            )
        return user

    return _check_role


# ── Token creation utility (used by tests and dev login endpoint) ─────────────

def create_dev_token(user_id: UUID, role: str, email: str) -> str:
    """
    Mint a JWT for development/testing purposes.
    In production, tokens are issued by the University SSO.
    No expiry set — prototype only.
    """
    payload = {
        "sub":   str(user_id),
        "role":  role,
        "email": email,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
