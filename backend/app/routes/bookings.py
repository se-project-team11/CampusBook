"""
FastAPI route handlers for /api/bookings.

GRASP Controller pattern: each handler is intentionally thin.
It does ONLY:
  1. Validate HTTP request shape (Pydantic)
  2. Enforce RBAC (require_roles dependency)
  3. Delegate to BookingService
  4. Map domain object to HTTP response

No business logic, no DB queries, no Redis calls here.
All of that belongs in BookingService.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID
from datetime import date as date_cls

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.middleware import AuthUser, get_current_user, require_roles
from app.db.base import get_db
from app.dependencies import get_booking_service, get_catalogue_service
from app.models.time_slot import TimeSlot
from app.services.booking_service import (
    BookingNotFoundError,
    BookingPermissionError,
    BookingService,
    BookingValidationError,
    ConcurrentBookingError,
    SlotUnavailableError,
)
from app.services.catalogue_service import CatalogueService

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


# ── Request / Response schemas ────────────────────────────────────────────────

class CreateBookingRequest(BaseModel):
    resource_id: UUID
    slot_start:  datetime
    slot_end:    datetime
    notes:       str = ""

    @field_validator("slot_start", "slot_end", mode="before")
    @classmethod
    def ensure_utc(cls, v):
        if isinstance(v, str):
            dt = datetime.fromisoformat(v)
        elif isinstance(v, datetime):
            dt = v
        else:
            return v
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt

    @field_validator("slot_end")
    @classmethod
    def end_must_be_after_start(cls, v, info):
        if "slot_start" in info.data and v <= info.data["slot_start"]:
            raise ValueError("slot_end must be after slot_start")
        return v


class BookingResponse(BaseModel):
    booking_id:        UUID
    resource_id:       UUID
    state:             str
    qr_token:          str
    expires_at:        datetime
    slot_start:        datetime
    slot_end:          datetime
    notes:             str
    requires_approval: bool = False

    model_config = {"from_attributes": True}


class UserBookingsResponse(BaseModel):
    bookings: list[BookingResponse]


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post(
    "/",
    response_model=BookingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a booking",
    description=(
        "Books a resource slot. Uses pessimistic locking to guarantee zero "
        "double-bookings. Returns QR code token and check-in deadline (15 min)."
    ),
)
async def create_booking(
    req:  CreateBookingRequest,
    db:   AsyncSession   = Depends(get_db),
    user: AuthUser       = Depends(require_roles(["ROLE_STUDENT", "ROLE_FACULTY"])),
    svc:  BookingService = Depends(get_booking_service),
    catalogue: CatalogueService = Depends(get_catalogue_service),
):
    """
    RBAC: ROLE_STUDENT and ROLE_FACULTY only.
    ROLE_DEPT_ADMIN and ROLE_FACILITIES cannot create bookings via this endpoint.

    Role-based resource type restrictions:
      - STUDENT: can only book STUDY_ROOM, LAB, SPORTS
      - FACULTY: can only book SEMINAR, LAB
    """
    resource = await catalogue.get_resource_by_id(req.resource_id)
    if not resource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found",
        )

    resource_type = resource.get("type", "")
    if user.role == "ROLE_STUDENT":
        allowed_types = {"STUDY_ROOM", "LAB", "SPORTS"}
    elif user.role == "ROLE_FACULTY":
        allowed_types = {"SEMINAR", "LAB"}
    else:
        allowed_types = set()

    if resource_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Role {user.role} cannot book resource type {resource_type}. Allowed types: {', '.join(allowed_types)}",
        )

    try:
        slot = TimeSlot(start=req.slot_start, end=req.slot_end)
        booking = await svc.create_booking(
            db=db,
            user_id=user.id,
            resource_id=req.resource_id,
            slot=slot,
            notes=req.notes,
            user_email=user.email,
        )
        
        booking_date = booking.slot_start.date() if booking.slot_start.tzinfo else booking.slot_start.replace(tzinfo=timezone.utc).date()
        await catalogue.invalidate_cache(booking.resource_id, booking_date)
        
        return BookingResponse(
            booking_id=booking.id,
            resource_id=booking.resource_id,
            state=booking.state.value,
            qr_token=booking.qr_token,
            expires_at=booking.expires_at,
            slot_start=booking.slot_start,
            slot_end=booking.slot_end,
            notes=booking.notes,
            requires_approval=booking.requires_approval,
        )
    except SlotUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The selected slot is no longer available. Please refresh and try another time.",
        )
    except BookingValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except ConcurrentBookingError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A concurrent booking conflict was detected. Please refresh and try again.",
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.get(
    "/user/me",
    response_model=UserBookingsResponse,
    summary="Get my bookings",
)
async def get_my_bookings(
    user: AuthUser       = Depends(require_roles(["ROLE_STUDENT", "ROLE_FACULTY"])),
    svc:  BookingService = Depends(get_booking_service),
):
    """Returns all bookings for the authenticated user, ordered newest first."""
    bookings = await svc.get_user_bookings(user.id)
    return UserBookingsResponse(
        bookings=[
            BookingResponse(
                booking_id=b.id,
                resource_id=b.resource_id,
                state=b.state.value,
                qr_token=b.qr_token or "",
                expires_at=b.expires_at or datetime.utcnow(),
                slot_start=b.slot_start,
                slot_end=b.slot_end,
                notes=b.notes,
                requires_approval=b.requires_approval,
            )
            for b in bookings
        ]
    )


# IMPORTANT: /pending-approval must be registered BEFORE /{booking_id} so
# FastAPI doesn't try to parse the literal string as a UUID first.
@router.get(
    "/pending-approval",
    response_model=UserBookingsResponse,
    summary="List bookings pending dept-admin approval",
)
async def list_pending_approvals(
    user: AuthUser       = Depends(require_roles(["ROLE_DEPT_ADMIN"])),
    svc:  BookingService = Depends(get_booking_service),
):
    """Returns all RESERVED bookings that require approval. ROLE_DEPT_ADMIN only."""
    bookings = await svc.get_pending_approvals()
    return UserBookingsResponse(
        bookings=[
            BookingResponse(
                booking_id=b.id,
                resource_id=b.resource_id,
                state=b.state.value,
                qr_token=b.qr_token or "",
                expires_at=b.expires_at or datetime.utcnow(),
                slot_start=b.slot_start,
                slot_end=b.slot_end,
                notes=b.notes,
                requires_approval=b.requires_approval,
            )
            for b in bookings
        ]
    )


@router.get(
    "/{booking_id}",
    response_model=BookingResponse,
    summary="Get a booking by ID",
)
async def get_booking(
    booking_id: UUID,
    user: AuthUser       = Depends(get_current_user),
    svc:  BookingService = Depends(get_booking_service),
):
    """
    All authenticated roles can call this endpoint.
    Students and faculty can only view their own bookings.
    Dept admins and facilities staff can view any booking.
    """
    try:
        booking = await svc.get_booking(booking_id)
        # RBAC: students/faculty can only see their own bookings
        if user.role in ("ROLE_STUDENT", "ROLE_FACULTY"):
            if booking.user_id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only view your own bookings.",
                )
        return BookingResponse(
            booking_id=booking.id,
            resource_id=booking.resource_id,
            state=booking.state.value,
            qr_token=booking.qr_token or "",
            expires_at=booking.expires_at or datetime.utcnow(),
            slot_start=booking.slot_start,
            slot_end=booking.slot_end,
            notes=booking.notes,
            requires_approval=booking.requires_approval,
        )
    except BookingNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking {booking_id} not found.",
        )


@router.patch(
    "/{booking_id}/approve",
    response_model=BookingResponse,
    summary="Approve a pending booking",
)
async def approve_booking(
    booking_id: UUID,
    user: AuthUser       = Depends(require_roles(["ROLE_DEPT_ADMIN"])),
    svc:  BookingService = Depends(get_booking_service),
):
    """Transitions a RESERVED booking to CONFIRMED. ROLE_DEPT_ADMIN only."""
    try:
        booking = await svc.approve_booking(booking_id)
        return BookingResponse(
            booking_id=booking.id,
            resource_id=booking.resource_id,
            state=booking.state.value,
            qr_token=booking.qr_token or "",
            expires_at=booking.expires_at or datetime.utcnow(),
            slot_start=booking.slot_start,
            slot_end=booking.slot_end,
            notes=booking.notes,
            requires_approval=booking.requires_approval,
        )
    except BookingNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Booking {booking_id} not found.")


@router.patch(
    "/{booking_id}/reject",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Reject a pending booking",
)
async def reject_booking(
    booking_id: UUID,
    user: AuthUser       = Depends(require_roles(["ROLE_DEPT_ADMIN"])),
    svc:  BookingService = Depends(get_booking_service),
):
    """Transitions a RESERVED booking to RELEASED. ROLE_DEPT_ADMIN only."""
    try:
        await svc.reject_booking(booking_id)
    except BookingNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Booking {booking_id} not found.")


@router.delete(
    "/{booking_id}/admin-cancel",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Admin cancel a booking",
)
async def admin_cancel_booking(
    booking_id: UUID,
    user: AuthUser       = Depends(require_roles(["ROLE_DEPT_ADMIN"])),
    svc:  BookingService = Depends(get_booking_service),
):
    """
    Cancels any booking regardless of owner. ROLE_DEPT_ADMIN only.
    Can cancel RESERVED or CONFIRMED bookings.
    """
    try:
        await svc.admin_cancel_booking(booking_id, user.id)
    except BookingNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Booking {booking_id} not found.")


@router.delete(
    "/{booking_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel a booking",
)
async def cancel_booking(
    booking_id: UUID,
    db:   AsyncSession   = Depends(get_db),
    user: AuthUser       = Depends(require_roles(["ROLE_STUDENT", "ROLE_FACULTY"])),
    svc:  BookingService = Depends(get_booking_service),
    catalogue: CatalogueService = Depends(get_catalogue_service),
):
    """
    Cancels a CONFIRMED booking. Only the booking owner can cancel.
    Side effects: Redis TTL key deleted, cancellation event emitted.
    """
    try:
        booking = await svc.cancel_booking(
            db=db,
            booking_id=booking_id,
            requesting_user_id=user.id,
        )
        if booking:
            booking_date = booking.slot_start.date() if booking.slot_start.tzinfo else booking.slot_start.replace(tzinfo=timezone.utc).date()
            await catalogue.invalidate_cache(booking.resource_id, booking_date)
    except BookingNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking {booking_id} not found.",
        )
    except BookingPermissionError:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only cancel your own bookings.",
        )
