"""
FastAPI route handlers for /api/auth.

Provides a secure login endpoint to generate JWT tokens.
In development, it uses deterministic user IDs based on email and
validates against a standard dummy password.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.auth.middleware import create_dev_token, VALID_ROLES

router = APIRouter(prefix="/api/auth", tags=["auth"])

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: uuid.UUID
    role: str
    email: str

@router.post(
    "/login",
    response_model=LoginResponse,
    status_code=status.HTTP_200_OK,
    summary="User Login",
    description="Authenticates a user and returns a JWT token. In development, use password 'secret123'. Role is automatically derived from the email prefix (e.g. student@, faculty@, admin@, facilities@).",
)
async def login(req: LoginRequest):
    # For development prototype, we mock the password check.
    # In production, this would query a Users table and verify a password hash.
    if req.password != "secret123":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Use 'secret123' for development.",
        )
    
    # Derive role from email prefix for development purposes
    role = "ROLE_STUDENT"
    if req.email.startswith("faculty"):
        role = "ROLE_FACULTY"
    elif req.email.startswith("admin") or req.email.startswith("dept"):
        role = "ROLE_DEPT_ADMIN"
    elif req.email.startswith("facilities") or req.email.startswith("facility"):
        role = "ROLE_FACILITIES"
        
    if role not in VALID_ROLES:
        role = "ROLE_STUDENT" # Fallback to a safe default
        
    # Generate a deterministic UUID based on email so the user_id remains consistent
    # across logins for the same user in development, preventing orphaned records.
    user_namespace = uuid.UUID("12345678-1234-5678-1234-567812345678")
    user_id = uuid.uuid5(user_namespace, req.email)
    
    # Mint the token using the existing middleware utility
    token = create_dev_token(user_id=user_id, role=role, email=req.email)
    
    return LoginResponse(
        access_token=token,
        user_id=user_id,
        role=role,
        email=req.email,
    )
