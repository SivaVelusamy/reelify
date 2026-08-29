"""Business logic for Module 6 (Dashboard).

Provides two read-mostly aggregations for the authenticated user:

* :func:`get_summary` - a current calendar-month usage snapshot (minutes
  processed, clips generated, an *estimated* storage footprint, plan limits)
  which is also written back to the user's current-month ``UsageRecord`` row.
* :func:`get_activity` - a merged, newest-first activity feed built from the
  user's recent source videos, clips, publish jobs and projects.

Storage estimate
----------------
There is no per-object byte-size column anywhere in the schema, so storage is
*approximated* from durations and counts::

    storage_used_bytes = round(
        total_source_duration_seconds * BYTES_PER_SOURCE_SECOND      # 500_000
        + total_clip_count            * BYTES_PER_CLIP               # 8_000_000
    )

``total_source_duration_seconds`` and ``total_clip_count`` are lifetime totals
for the user (storage does not reset every month), whereas the minutes/clips
usage figures are scoped to the current calendar month.
"""

import logging
from datetime import UTC, datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.billing import UsageRecord
from app.models.clip import Clip
from app.models.project import Project, SourceVideo, SourceVideoStatus
from app.models.publishing import PublishJob, PublishJobStatus
from app.models.user import User
from app.schemas.dashboard import ActivityItem, DashboardSummary, PaginatedActivity

logger = logging.getLogger(__name__)

# Per-plan monthly minute allowances. ``None`` (plan absent from the map) means
# "no enforced limit".
PLAN_MINUTES: dict[str, int] = {
    "free": 30,
    "starter": 300,
    "pro": 1200,
}

# Storage estimate constants (see module docstring).
BYTES_PER_SOURCE_SECOND = 500_000
BYTES_PER_CLIP = 8_000_000

# How many rows per source table to pull into the merged activity feed.
_ACTIVITY_SCAN_LIMIT = 200


def _month_period(now: datetime | None = None) -> tuple[datetime, datetime]:
    """Return ``(period_start, period_end)`` for the current calendar month (UTC)."""
    now = now or datetime.now(UTC)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


def _plan_str(user: User) -> str:
    plan = getattr(user, "plan", None)
    return getattr(plan, "value", plan) or "free"


def _upsert_usage_record(
    db: Session,
    user: User,
    period_start: datetime,
    period_end: datetime,
    minutes_processed: float,
    clips_generated: int,
    storage_bytes: int,
) -> None:
    """Create or refresh the user's UsageRecord row for the current month."""
    record = (
        db.query(UsageRecord)
        .filter(
            UsageRecord.user_id == user.id,
            UsageRecord.period_start == period_start,
        )
        .first()
    )
    if record is None:
        record = UsageRecord(
            user_id=user.id,
            period_start=period_start,
            period_end=period_end,
        )
        db.add(record)

    record.period_end = period_end
    record.minutes_processed = int(round(minutes_processed))
    record.clips_generated = int(clips_generated)
    record.storage_bytes = int(storage_bytes)
    db.commit()


def get_summary(db: Session, user: User) -> DashboardSummary:
    period_start, period_end = _month_period()

    # ``updated_at`` is set when a video transitions to ``ready``; brand-new
    # inserts leave it NULL, so fall back to ``created_at``.
    ready_at = func.coalesce(SourceVideo.updated_at, SourceVideo.created_at)

    minutes_seconds = (
        db.query(func.coalesce(func.sum(SourceVideo.duration_seconds), 0.0))
        .filter(
            SourceVideo.user_id == user.id,
            SourceVideo.status == SourceVideoStatus.ready,
            ready_at >= period_start,
            ready_at < period_end,
        )
        .scalar()
        or 0.0
    )
    minutes_processed = round(float(minutes_seconds) / 60.0, 2)

    clips_generated = (
        db.query(func.count(Clip.id))
        .filter(
            Clip.user_id == user.id,
            Clip.created_at >= period_start,
            Clip.created_at < period_end,
        )
        .scalar()
        or 0
    )

    # Lifetime totals for the storage estimate.
    total_source_seconds = (
        db.query(func.coalesce(func.sum(SourceVideo.duration_seconds), 0.0))
        .filter(SourceVideo.user_id == user.id)
        .scalar()
        or 0.0
    )
    total_clips = (
        db.query(func.count(Clip.id)).filter(Clip.user_id == user.id).scalar() or 0
    )
    storage_used_bytes = int(
        round(
            float(total_source_seconds) * BYTES_PER_SOURCE_SECOND
            + int(total_clips) * BYTES_PER_CLIP
        )
    )

    projects_count = (
        db.query(func.count(Project.id))
        .filter(Project.user_id == user.id)
        .scalar()
        or 0
    )

    videos_processing = (
        db.query(func.count(SourceVideo.id))
        .filter(
            SourceVideo.user_id == user.id,
            SourceVideo.status.notin_(
                [SourceVideoStatus.ready, SourceVideoStatus.failed]
            ),
        )
        .scalar()
        or 0
    )

    plan = _plan_str(user)
    minutes_limit = PLAN_MINUTES.get(plan)
    minutes_used_pct: float | None = None
    if minutes_limit:
        minutes_used_pct = round(minutes_processed / minutes_limit * 100.0, 2)

    _upsert_usage_record(
        db,
        user,
        period_start,
        period_end,
        minutes_processed,
        int(clips_generated),
        storage_used_bytes,
    )

    return DashboardSummary(
        period_start=period_start,
        period_end=period_end,
        minutes_processed=minutes_processed,
        clips_generated=int(clips_generated),
        storage_used_bytes=storage_used_bytes,
        plan=plan,
        minutes_limit=minutes_limit,
        minutes_used_pct=minutes_used_pct,
        projects_count=int(projects_count),
        videos_processing=int(videos_processing),
    )


def _collect_activity(db: Session, user: User) -> list[ActivityItem]:
    items: list[ActivityItem] = []

    videos = (
        db.query(SourceVideo)
        .filter(SourceVideo.user_id == user.id)
        .order_by(SourceVideo.created_at.desc())
        .limit(_ACTIVITY_SCAN_LIMIT)
        .all()
    )
    for v in videos:
        label = v.filename or v.original_url or f"Video #{v.id}"
        if v.created_at:
            items.append(
                ActivityItem(
                    id=f"video-{v.id}-uploaded",
                    type="video_uploaded",
                    title=f"Uploaded “{label}”",
                    timestamp=v.created_at,
                    meta={
                        "source_video_id": v.id,
                        "project_id": v.project_id,
                        "source_type": getattr(v.source_type, "value", None),
                    },
                )
            )
        stamp = v.updated_at or v.created_at
        if v.status == SourceVideoStatus.ready and stamp:
            items.append(
                ActivityItem(
                    id=f"video-{v.id}-ready",
                    type="video_ready",
                    title=f"“{label}” finished processing",
                    timestamp=stamp,
                    meta={
                        "source_video_id": v.id,
                        "project_id": v.project_id,
                        "duration_seconds": v.duration_seconds,
                    },
                )
            )
        elif v.status == SourceVideoStatus.failed and stamp:
            items.append(
                ActivityItem(
                    id=f"video-{v.id}-failed",
                    type="video_failed",
                    title=f"Processing failed for “{label}”",
                    timestamp=stamp,
                    meta={
                        "source_video_id": v.id,
                        "project_id": v.project_id,
                        "error": v.error_message,
                    },
                )
            )

    clips = (
        db.query(Clip)
        .filter(Clip.user_id == user.id)
        .order_by(Clip.created_at.desc())
        .limit(_ACTIVITY_SCAN_LIMIT)
        .all()
    )
    for c in clips:
        if not c.created_at:
            continue
        title = c.title or f"Clip #{c.id}"
        items.append(
            ActivityItem(
                id=f"clip-{c.id}-generated",
                type="clip_generated",
                title=f"Clip generated: “{title}”",
                timestamp=c.created_at,
                meta={
                    "clip_id": c.id,
                    "source_video_id": c.source_video_id,
                    "project_id": c.project_id,
                    "score": c.score,
                },
            )
        )

    jobs = (
        db.query(PublishJob)
        .filter(PublishJob.user_id == user.id)
        .order_by(PublishJob.created_at.desc())
        .limit(_ACTIVITY_SCAN_LIMIT)
        .all()
    )
    for j in jobs:
        dest = getattr(j.destination_type, "value", None)
        if j.status == PublishJobStatus.published and (j.published_at or j.updated_at):
            items.append(
                ActivityItem(
                    id=f"publish-{j.id}-published",
                    type="publish_published",
                    title=f"Clip published to {dest or 'destination'}",
                    timestamp=j.published_at or j.updated_at,
                    meta={
                        "publish_job_id": j.id,
                        "clip_id": j.clip_id,
                        "destination_type": dest,
                        "external_post_id": j.external_post_id,
                    },
                )
            )
        elif j.status == PublishJobStatus.failed and (j.updated_at or j.created_at):
            items.append(
                ActivityItem(
                    id=f"publish-{j.id}-failed",
                    type="publish_failed",
                    title=f"Publishing to {dest or 'destination'} failed",
                    timestamp=j.updated_at or j.created_at,
                    meta={
                        "publish_job_id": j.id,
                        "clip_id": j.clip_id,
                        "destination_type": dest,
                        "error": j.error_message,
                    },
                )
            )

    projects = (
        db.query(Project)
        .filter(Project.user_id == user.id)
        .order_by(Project.created_at.desc())
        .limit(_ACTIVITY_SCAN_LIMIT)
        .all()
    )
    for p in projects:
        if not p.created_at:
            continue
        items.append(
            ActivityItem(
                id=f"project-{p.id}-created",
                type="project_created",
                title=f"Project created: “{p.title}”",
                timestamp=p.created_at,
                meta={"project_id": p.id, "campaign": p.campaign},
            )
        )

    items.sort(key=lambda item: item.timestamp, reverse=True)
    return items


def get_activity(
    db: Session, user: User, page: int = 1, per_page: int = 20
) -> PaginatedActivity:
    page = max(page, 1)
    per_page = max(min(per_page, 100), 1)

    all_items = _collect_activity(db, user)
    total = len(all_items)
    start = (page - 1) * per_page
    window = all_items[start : start + per_page]

    return PaginatedActivity(
        items=window,
        total=total,
        page=page,
        per_page=per_page,
    )
