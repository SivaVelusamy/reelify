"""Reelify FastAPI application entrypoint."""

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.exceptions import AppException
from app.rate_limit import limiter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("reelify")

app = FastAPI(title=settings.APP_NAME, version=settings.APP_VERSION)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
# Enforce the limiter's default_limits on every route (per-route @limiter.limit
# decorators still stack on top).
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": exc.message}},
    )


@app.get("/health", tags=["meta"])
async def health() -> dict[str, str]:
    return {"status": "healthy"}


# ---------------------------------------------------------------------------
# API routers — mounted under the /api/v1 prefix. Modules are wired in as their
# BACKEND-AGENT lands them.
# ---------------------------------------------------------------------------
from app.routers import (  # noqa: F401
    admin,  # Module 9: Admin Panel
    auth,  # Module 1: Authentication
    billing,  # Module 7: Billing (Stripe)
    brand_kits,  # Module 5: Templates / Brand Kit
    clips,  # Module 3: Clips
    dashboard,  # Module 6: Dashboard
    library,  # Module 4: Library / Assets
    projects,  # Module 2: Projects / Uploads
    publishing,  # Module 8: Publishing / Distribution
)

for _router in (
    auth.router,
    projects.router,
    clips.router,
    library.router,
    brand_kits.router,
    dashboard.router,
    billing.router,
    publishing.router,
    admin.router,
):
    app.include_router(_router, prefix="/api/v1")
