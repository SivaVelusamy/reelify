"""Module 9 — Admin Panel API.

Mounted under ``/api/v1`` by ``app.main``. Every route in this router requires an
authenticated, active user with ``is_admin`` — enforced once at the router level
via ``dependencies=[Depends(require_admin)]`` (non-admins get ``403``).
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin
from app.models.user import User
from app.schemas.admin import (
    AdminUserDetail,
    AdminUserUpdate,
    JobQueueHealth,
    PaginatedUsers,
    PlatformStats,
)
from app.services import admin_service

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)],
)


@router.get("/users", response_model=PaginatedUsers)
async def list_users(
    q: str | None = Query(default=None),
    plan: str | None = Query(default=None),
    status: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PaginatedUsers:
    return admin_service.list_users(
        db, q=q, plan=plan, status=status, page=page, per_page=per_page
    )


@router.get("/users/{user_id}", response_model=AdminUserDetail)
async def get_user(
    user_id: int,
    db: Session = Depends(get_db),
) -> AdminUserDetail:
    return admin_service.get_user(db, user_id)


@router.put("/users/{user_id}", response_model=AdminUserDetail)
async def update_user(
    user_id: int,
    data: AdminUserUpdate,
    db: Session = Depends(get_db),
    acting_admin: User = Depends(require_admin),
) -> AdminUserDetail:
    return admin_service.update_user(
        db, user_id, data, acting_admin_id=acting_admin.id
    )


@router.get("/stats", response_model=PlatformStats)
async def platform_stats(
    db: Session = Depends(get_db),
) -> PlatformStats:
    return admin_service.platform_stats(db)


@router.get("/jobs", response_model=JobQueueHealth)
async def job_queue_health(
    db: Session = Depends(get_db),
) -> JobQueueHealth:
    return admin_service.job_queue_health(db)
