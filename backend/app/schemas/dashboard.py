"""Pydantic v2 schemas for Module 6 (Dashboard)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DashboardSummary(BaseModel):
    """Current calendar-month usage snapshot + plan limits."""

    model_config = ConfigDict(from_attributes=True)

    period_start: datetime
    period_end: datetime
    minutes_processed: float
    clips_generated: int
    storage_used_bytes: int
    plan: str
    minutes_limit: int | None = None
    minutes_used_pct: float | None = None
    projects_count: int
    videos_processing: int


class ActivityItem(BaseModel):
    """A single entry in the merged activity feed."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    title: str
    timestamp: datetime
    meta: dict = Field(default_factory=dict)


class PaginatedActivity(BaseModel):
    items: list[ActivityItem]
    total: int
    page: int
    per_page: int
