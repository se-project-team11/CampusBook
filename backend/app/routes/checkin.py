"""
QR-code check-in endpoint.
POST /api/checkin/{qr_token}  → transitions CONFIRMED → CHECKED_IN
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.middleware import get_current_user
from app.db.base import get_db
from app.db.models import BookingRow

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/checkin", tags=["checkin"])


@router.post("/{qr_token}", summary="Check-in via QR code")
async def checkin(
    qr_token: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    try:
        result = await db.execute(
            select(BookingRow).where(BookingRow.qr_token == qr_token)
        )
        booking = result.scalar_one_or_none()
        if not booking:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="QR token not found.")

        if booking.state != "CONFIRMED":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot check in — booking is in state '{booking.state}'.",
            )

        booking.state = "CHECKED_IN"
        await db.commit()

        return {"message": "Check-in successful.", "booking_id": str(booking.id), "state": "CHECKED_IN"}
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        await db.rollback()
        logger.error(f"Database error in checkin: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Check-in failed due to database error.")
    except Exception as e:
        await db.rollback()
        logger.error(f"Unexpected error in checkin: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Check-in failed.")