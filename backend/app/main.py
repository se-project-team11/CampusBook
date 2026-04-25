"""
FastAPI application entry point.
All routers are registered here. CORS, exception handling, and logging configured.
"""
from __future__ import annotations

import logging
import sys
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncio

from app.db.base import engine
from app.exceptions import AppError
from app.routes.auth import router as auth_router
from app.routes.bookings import router as bookings_router
from app.routes.checkin import router as checkin_router
from app.routes.resources import router as resources_router

from app.websocket.hub import hub
from app.dependencies import get_checkin_service, get_redis


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("CampusBook API starting...")

    redis = get_redis()
    checkin_svc = get_checkin_service(redis)

    ttl_task = asyncio.create_task(checkin_svc.start_ttl_listener())
    ws_task = asyncio.create_task(hub.start_redis_listener())

    yield

    logger.info("CampusBook API shutting down...")
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start_time = time.time()
    request.state.request_id = request_id

    logger.info(f"[{request_id}] {request.method} {request.url.path}")

    try:
        response = await call_next(request)
        duration = time.time() - start_time
        logger.info(f"[{request_id}] Completed in {duration:.3f}s - {response.status_code}")
        response.headers["X-Request-ID"] = request_id
        return response
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"[{request_id}] Failed after {duration:.3f}s: {str(e)}", exc_info=True)
        raise


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    error_code = getattr(exc, 'code', 'INTERNAL_ERROR')
    error_message = getattr(exc, 'message', str(exc)) if not isinstance(exc, (ConnectionError, OSError, IOError)) else "An unexpected error occurred. Please try again later."

    if isinstance(exc, AppError):
        logger.warning(f"[{request_id}] Application error ({error_code}): {error_message}")
    else:
        logger.error(
            f"[{request_id}] Unhandled exception: {type(exc).__name__}: {str(exc)}",
            exc_info=True,
        )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error": {
                "code": error_code,
                "message": error_message,
                "details": str(exc) if isinstance(exc, AppError) else None,
            },
            "request_id": request_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.warning(f"[{request_id}] HTTP {exc.status_code}: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": exc.detail,
            },
            "request_id": request_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


app.include_router(auth_router)
app.include_router(bookings_router)
app.include_router(resources_router)


@app.get("/health", tags=["ops"])
async def health():
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