"""
Dependency Injection wiring for FastAPI.
All services are constructed here and injected via Depends().

This file is the Composition Root — the only place where concrete
implementations are wired to abstractions. BookingService itself
never imports PostgresBookingRepository, StudyRoomAdapter, etc.
"""
from __future__ import annotations

import os
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.services.checkin_service import CheckInService
    from app.services.catalogue_service import CatalogueService

import redis.asyncio as aioredis
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import get_db
from app.repositories.postgres_booking_repository import PostgresBookingRepository
from app.services.booking_service import BookingService
from app.services.state_manager import BookingStateMgr
from app.services.event_log import PostgresDomainEventLog

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# Shared singleton instances
_redis_client = None
_state_mgr    = BookingStateMgr()


def get_redis():
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)
    return _redis_client


def get_booking_service(
    db:    AsyncSession = Depends(get_db),
    redis                = Depends(get_redis),
) -> BookingService:
    """
    FastAPI dependency that constructs a BookingService with all real implementations.

     registries (AdapterRegistry, StrategyRegistry, NotificationService) are
    imported here — this is the only file that crosses the BE1/ boundary.
    Once  delivers their modules, uncomment the real imports below.
    """
    repo      = PostgresBookingRepository(db)
    event_log = PostgresDomainEventLog(db)

    from app.adapters.registry import AdapterRegistry
    from app.strategies.registry import StrategyRegistry
    from app.services.notification_service import NotificationService, EmailChannel, SMSChannel, WebSocketChannel
    
    adapter_registry   = AdapterRegistry(db)
    strategy_registry  = StrategyRegistry(db)
    notification_svc   = NotificationService([
        EmailChannel(), 
        SMSChannel(), 
        WebSocketChannel(redis)
    ])

    return BookingService(
        adapter_registry=adapter_registry,
        strategy_registry=strategy_registry,
        booking_repo=repo,
        state_mgr=_state_mgr,
        event_log=event_log,
        notification_svc=notification_svc,
        redis=redis,
    )

def get_checkin_service(
    redis=Depends(get_redis),
) -> CheckInService:
    from app.services.checkin_service import CheckInService
    from app.services.notification_service import NotificationService, EmailChannel, SMSChannel, WebSocketChannel
    from app.db.base import AsyncSessionLocal
    
    notification_svc = NotificationService([
        EmailChannel(), 
        SMSChannel(), 
        WebSocketChannel(redis)
    ])
    from app.services.catalogue_service import CatalogueService
    catalogue_svc = CatalogueService(session=AsyncSessionLocal(), redis=redis)
    return CheckInService(
        redis=redis,
        session_factory=AsyncSessionLocal,
        notification_svc=notification_svc,
        catalogue_svc=catalogue_svc
    )

def get_catalogue_service(
    db: AsyncSession = Depends(get_db),
    redis=Depends(get_redis),
) -> CatalogueService:
    from app.services.catalogue_service import CatalogueService
    return CatalogueService(session=db, redis=redis)
