"""
FastAPI application entry point.
All routers are registered here. CORS and health check included.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.base import engine
from app.routes.auth import router as auth_router
from app.routes.bookings import router as bookings_router
from app.routes.auth import router as auth_router


from app.websocket.hub import hub
from app.dependencies import get_checkin_service, get_redis
import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("CampusBook API starting...")
    
    # Start BE2 background listeners
    redis = get_redis()
    checkin_svc = get_checkin_service(redis)
    
    # Fire and forget tasks
    ttl_task = asyncio.create_task(checkin_svc.start_ttl_listener())
    ws_task = asyncio.create_task(hub.start_redis_listener())
    
    yield
    
    print("CampusBook API shutting down...")
    ttl_task.cancel()
    ws_task.cancel()
    await engine.dispose()


app = FastAPI(
    title="CampusBook API",
    description=(
        "Unified Smart Campus Resource Booking Platform. "
        "Feature F1: Search & Booking with pessimistic conflict prevention."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow React dev server (FE1/FE2) and Vite dev server (FE3)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth_router)
app.include_router(bookings_router)

# Register BE2 routers
from app.routes.resources import router as resources_router
app.include_router(resources_router)


@app.get("/health", tags=["ops"])
async def health():
    """Health check endpoint — used by Docker Compose and monitoring."""
    return {"status": "ok", "service": "campusbook-api"}


@app.get("/", tags=["ops"])
async def root():
    return {
        "message": "CampusBook API",
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)