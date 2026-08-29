"""Module 6 — Dashboard API: usage summary + paginated activity feed.

Mounted under ``/api/v1`` by ``app.main``. Both routes require an authenticated
active user.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.dashboard import DashboardSummary, PaginatedActivity
from app.services import dashboard_service

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> DashboardSummary:
    return dashboard_service.get_summary(db, user)


@router.get("/dashboard/activity", response_model=PaginatedActivity)
async def get_dashboard_activity(
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> PaginatedActivity:
    return dashboard_service.get_activity(db, user, page=page, per_page=per_page)
