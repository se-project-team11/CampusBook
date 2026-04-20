"""
FastAPI route handlers for /api/resources and /api/checkin.

GRASP Controller pattern: thin handlers that delegate to CatalogueService
and CheckInService.
"""
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.middleware import AuthUser, get_current_user, require_roles
from app.db.base import get_db
from app.dependencies import get_redis, get_catalogue_service, get_checkin_service
from app.services.catalogue_service import CatalogueService
from app.services.checkin_service import CheckInService
from app.websocket.hub import hub

router = APIRouter(prefix="/api", tags=["resources"])


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
    return await svc.get_availability(resource_id, date)


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
            # Keep connection alive; server pushes via hub.broadcast_to_room()
            # We don't expect the client to send anything, but we must receive to detect disconnects
            await websocket.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(websocket, resource_id)
