"""Pydantic v2 schemas for Module 9 (Admin Panel).

All admin endpoints are guarded by ``require_admin`` (403 for non-admins); these
schemas describe the request/response bodies only.
"""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.user import UserPlan

_VALID_PLANS = {p.value for p in UserPlan}


def _enum_value(value: object) -> object:
    return value.value if isinstance(value, Enum) else value


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
class AdminUserRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str | None = None
    is_active: bool
    is_admin: bool
    plan: str
    created_at: datetime | None = None
    minutes_this_month: float = 0.0
    clips_count: int = 0

    @field_validator("plan", mode="before")
    @classmethod
    def _coerce_plan(cls, value: object) -> object:
        return _enum_value(value)


class AdminUserDetail(AdminUserRow):
    subscription_status: str | None = None
    projects_count: int = 0
    videos_count: int = 0

    @field_validator("subscription_status", mode="before")
    @classmethod
    def _coerce_status(cls, value: object) -> object:
        return _enum_value(value)


class AdminUserUpdate(BaseModel):
    is_active: bool | None = None
    is_admin: bool | None = None
    plan: str | None = None

    @field_validator("plan")
    @classmethod
    def _validate_plan(cls, value: str | None) -> str | None:
        if value is not None and value not in _VALID_PLANS:
            raise ValueError(
                f"plan must be one of {sorted(_VALID_PLANS)}"
            )
        return value


class PaginatedUsers(BaseModel):
    items: list[AdminUserRow]
    total: int
    page: int
    per_page: int


# ---------------------------------------------------------------------------
# Platform stats
# ---------------------------------------------------------------------------
class PlatformStats(BaseModel):
    users_total: int
    users_active: int
    users_new_30d: int
    minutes_processed_30d: float
    clips_generated_total: int
    publish_jobs_total: int
    # Placeholder MRR estimate: starter = $29.00/mo (2900c), pro = $99.00/mo
    # (9900c). Real billing amounts live in Stripe; this is a rough dashboard
    # figure derived from active-subscription counts only.
    revenue_estimate_cents: int


# ---------------------------------------------------------------------------
# Job queue health
# ---------------------------------------------------------------------------
class QueueSection(BaseModel):
    pending: int | None = None
    processing: int = 0
    failed: int = 0


class JobQueueHealth(BaseModel):
    pipeline: QueueSection = Field(default_factory=QueueSection)
    render: QueueSection = Field(default_factory=QueueSection)
    publish: QueueSection = Field(default_factory=QueueSection)
    broker_reachable: bool = False
