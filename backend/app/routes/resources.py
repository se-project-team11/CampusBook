"""
FastAPI route handlers for /api/resources, /api/checkin, /api/waitlist, /api/analytics.

GRASP Controller pattern: thin handlers that delegate to CatalogueService
and CheckInService.
"""
from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.middleware import AuthUser, get_current_user, require_roles
from app.db.base import get_db
from app.db.models import WaitlistRow, BookingRow, ResourceRow
from app.dependencies import get_redis, get_catalogue_service, get_checkin_service, get_booking_service
from app.services.booking_service import BookingService
from app.services.catalogue_service import CatalogueService
from app.services.checkin_service import CheckInService
from app.websocket.hub import hub

router = APIRouter(prefix="/api", tags=["resources"])


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class WaitlistJoinRequest(BaseModel):
    resource_id: UUID
    slot_start: datetime
    slot_end: datetime


@router.get("/resources/{resource_id}", summary="Get a resource by ID")
async def get_resource(
    resource_id: UUID,
    user: AuthUser = Depends(get_current_user),
    svc: CatalogueService = Depends(get_catalogue_service),
):
    """Fetch a single resource by ID."""
    resource = await svc.get_resource_by_id(resource_id)
    if resource is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found.")
    return resource


@router.get("/resources", summary="Search resources")
async def search_resources(
    type: str = Query(None, description="Filter by resource type"),
    capacity: int = Query(None, description="Minimum capacity"),
    location: str = Query(None, description="Filter by location"),
    user: AuthUser = Depends(get_current_user),  # Must be logged in
    svc: CatalogueService = Depends(get_catalogue_service),
):
    """Search for resources with optional filters. Results are cached."""
    return await svc.search_resources(type=type, capacity=capacity, location=location)


@router.get("/resources/{resource_id}/availability", summary="Get resource availability")
async def get_availability(
    resource_id: UUID,
    date: date = Query(..., description="Date to check availability for"),
    user: AuthUser = Depends(get_current_user),
    svc: CatalogueService = Depends(get_catalogue_service),
):
    """Get the 14-hour availability grid for a specific resource and date."""
    slots = await svc.get_availability(resource_id, date)
    return {"resource_id": str(resource_id), "date": date.isoformat(), "slots": slots}


@router.post("/checkin/{qr_token}", summary="Check-in via QR code")
async def check_in(
    qr_token: str,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(require_roles(["ROLE_STUDENT", "ROLE_FACULTY"])),
    svc: CheckInService = Depends(get_checkin_service),
):
    """
    Check-in using a QR code token.
    Transitions booking state to CHECKED_IN and deletes the TTL no-show timer.
    """
    result = await svc.validate_qr(db, qr_token)
    if not result["ok"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result["reason"]
        )
    return result


@router.websocket("/ws/{resource_id}")
async def websocket_endpoint(websocket: WebSocket, resource_id: str):
    """
    WebSocket endpoint for real-time availability updates for a specific resource.
    """
    await hub.connect(websocket, resource_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(websocket, resource_id)


# ── Waitlist ─────────────────────────────────────────────────────────────────

@router.post("/waitlist", status_code=status.HTTP_201_CREATED, summary="Join the waitlist for a slot")
async def join_waitlist(
    req: WaitlistJoinRequest,
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(require_roles(["ROLE_STUDENT", "ROLE_FACULTY"])),
):
    """Add the authenticated user to the waitlist for a specific slot."""
    result = await db.execute(
        select(func.count()).select_from(WaitlistRow).where(
            WaitlistRow.resource_id == req.resource_id,
            WaitlistRow.slot_start == req.slot_start,
        )
    )
    position = (result.scalar() or 0) + 1

    entry = WaitlistRow(
        id=uuid4(),
        resource_id=req.resource_id,
        slot_start=req.slot_start,
        slot_end=req.slot_end,
        user_id=user.id,
        position=position,
    )
    db.add(entry)
    await db.flush()
    await db.commit()
    return {
        "waitlist_id": str(entry.id),
        "resource_id": str(entry.resource_id),
        "slot_start": entry.slot_start.isoformat(),
        "slot_end": entry.slot_end.isoformat(),
        "position": entry.position,
    }


@router.get("/waitlist/me", summary="Get my waitlist entries")
async def get_my_waitlist(
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(require_roles(["ROLE_STUDENT", "ROLE_FACULTY"])),
):
    """Returns all waitlist entries for the authenticated user."""
    result = await db.execute(
        select(WaitlistRow)
        .where(WaitlistRow.user_id == user.id)
        .order_by(WaitlistRow.joined_at.desc())
    )
    rows = result.scalars().all()
    return {
        "entries": [
            {
                "waitlist_id": str(r.id),
                "resource_id": str(r.resource_id),
                "slot_start": r.slot_start.isoformat(),
                "slot_end": r.slot_end.isoformat(),
                "position": r.position,
            }
            for r in rows
        ]
    }


# ── Admin ────────────────────────────────────────────────────────────────────

@router.get("/admin/room-overview", summary="Room overview for admin")
async def get_room_overview(
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(require_roles(["ROLE_DEPT_ADMIN"])),
    svc: BookingService = Depends(get_booking_service),
):
    """
    Returns all CONFIRMED and CHECKED_IN bookings with resource info and booker email.
    ROLE_DEPT_ADMIN only.
    """
    bookings = await svc.get_active_bookings()

    resources_result = await db.execute(select(ResourceRow))
    resource_map: dict = {
        str(r.id): {"name": r.name, "location": r.location, "type": r.type}
        for r in resources_result.scalars().all()
    }

    return {
        "bookings": [
            {
                "booking_id":   str(b.id),
                "resource_id":  str(b.resource_id),
                "resource_name": resource_map.get(str(b.resource_id), {}).get("name", str(b.resource_id)[:8]),
                "resource_location": resource_map.get(str(b.resource_id), {}).get("location", ""),
                "resource_type": resource_map.get(str(b.resource_id), {}).get("type", ""),
                "slot_start":   b.slot_start.isoformat(),
                "slot_end":     b.slot_end.isoformat(),
                "state":        b.state.value,
                "user_email":   b.user_email or "unknown",
            }
            for b in bookings
        ]
    }


# ── Analytics ────────────────────────────────────────────────────────────────

@router.get("/analytics/utilization", summary="Resource utilization stats")
async def get_utilization(
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(require_roles(["ROLE_FACILITIES", "ROLE_DEPT_ADMIN"])),
):
    """
    Returns booking counts and no-show rates per resource for the last 7 days.
    ROLE_FACILITIES and ROLE_DEPT_ADMIN only.
    """
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=7)

    bookings_result = await db.execute(
        select(
            BookingRow.resource_id,
            BookingRow.state,
            func.count().label("count"),
        )
        .where(BookingRow.slot_start >= cutoff)
        .group_by(BookingRow.resource_id, BookingRow.state)
    )
    rows = bookings_result.all()

    resources_result = await db.execute(select(ResourceRow.id, ResourceRow.name))
    resource_names = {str(r.id): r.name for r in resources_result.all()}

    stats: dict = {}
    for row in rows:
        rid = str(row.resource_id)
        if rid not in stats:
            stats[rid] = {
                "resource_id": rid,
                "resource_name": resource_names.get(rid, rid),
                "total": 0,
                "no_show": 0,
                "confirmed": 0,
                "checked_in": 0,
            }
        stats[rid]["total"] += row.count
        if row.state == "NO_SHOW":
            stats[rid]["no_show"] += row.count
        elif row.state == "CONFIRMED":
            stats[rid]["confirmed"] += row.count
        elif row.state == "CHECKED_IN":
            stats[rid]["checked_in"] += row.count

    for v in stats.values():
        v["no_show_rate"] = round(v["no_show"] / v["total"] * 100, 1) if v["total"] > 0 else 0.0

    return {"resources": list(stats.values())}


@router.get("/analytics/heatmap", summary="Booking density heatmap (7d)")
async def get_heatmap(
    db: AsyncSession = Depends(get_db),
    user: AuthUser = Depends(require_roles(["ROLE_FACILITIES", "ROLE_DEPT_ADMIN"])),
):
    """
    Returns a 7×14 grid of booking counts (Mon–Sun × 08:00–21:00 UTC).
    cells[day][hour_index] where day 0=Mon and hour_index 0=08:00.
    ROLE_FACILITIES and ROLE_DEPT_ADMIN only.
    """
    from sqlalchemy import text as sa_text

    # EXTRACT(dow) returns 0=Sun … 6=Sat; remap to 0=Mon … 6=Sun
    result = await db.execute(
        sa_text("""
            SELECT
                MOD(EXTRACT(dow FROM slot_start AT TIME ZONE 'UTC')::int + 6, 7) AS day_idx,
                EXTRACT(hour FROM slot_start AT TIME ZONE 'UTC')::int            AS hour_num,
                COUNT(*)                                                          AS cnt
            FROM bookings
            WHERE state NOT IN ('RELEASED')
            GROUP BY day_idx, hour_num
        """),
    )
    rows = result.all()

    # 7 days × 14 hours (08–21), default 0
    cells = [[0] * 14 for _ in range(7)]
    for row in rows:
        day = int(row.day_idx)
        hour = int(row.hour_num)
        if 0 <= day <= 6 and 8 <= hour <= 21:
            cells[day][hour - 8] = int(row.cnt)

    peak = max((cells[d][h] for d in range(7) for h in range(14)), default=1)
    return {"cells": cells, "peak": peak}
