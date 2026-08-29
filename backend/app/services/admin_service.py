"""Business logic for Module 9 (Admin Panel).

Read-side aggregates over the whole platform (no per-user ownership scoping —
callers are already gated by ``require_admin``) plus a small set of user
mutation helpers.

Aggregations use grouped subqueries joined onto the user query so listing N
users still issues a constant number of SQL statements (no N+1).
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.exceptions import NotFoundError, ValidationError
from app.models.billing import Subscription, SubscriptionPlan, SubscriptionStatus, UsageRecord
from app.models.clip import Clip, ClipExport, ClipExportStatus
from app.models.project import Project, SourceVideo, SourceVideoStatus
from app.models.publishing import PublishJob, PublishJobStatus
from app.models.user import User, UserPlan
from app.schemas.admin import (
    AdminUserDetail,
    AdminUserRow,
    AdminUserUpdate,
    JobQueueHealth,
    PaginatedUsers,
    PlatformStats,
    QueueSection,
)

logger = logging.getLogger(__name__)

# Placeholder monthly prices used for the dashboard revenue estimate only.
# Authoritative amounts are held by Stripe.
_PLAN_PRICE_CENTS = {
    SubscriptionPlan.starter: 2900,  # $29.00 / month
    SubscriptionPlan.pro: 9900,  # $99.00 / month
}

_PIPELINE_PROCESSING = (
    SourceVideoStatus.transcribing,
    SourceVideoStatus.analyzing,
    SourceVideoStatus.clipping,
)


def _month_start(now: datetime | None = None) -> datetime:
    now = now or datetime.now(UTC)
    return now.replace(
        day=1, hour=0, minute=0, second=0, microsecond=0, tzinfo=UTC
    )


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
def _minutes_subquery(db: Session, since: datetime):
    return (
        db.query(
            UsageRecord.user_id.label("user_id"),
            func.coalesce(func.sum(UsageRecord.minutes_processed), 0).label(
                "minutes"
            ),
        )
        .filter(UsageRecord.period_start >= since)
        .group_by(UsageRecord.user_id)
        .subquery()
    )


def _clips_subquery(db: Session):
    return (
        db.query(
            Clip.user_id.label("user_id"),
            func.count(Clip.id).label("clips"),
        )
        .group_by(Clip.user_id)
        .subquery()
    )


def list_users(
    db: Session,
    *,
    q: str | None = None,
    plan: str | None = None,
    status: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> PaginatedUsers:
    """Search / filter / paginate users, annotated with this-month minutes and
    total clip count.
    """
    page = max(page, 1)
    per_page = min(max(per_page, 1), 100)

    minutes_sq = _minutes_subquery(db, _month_start())
    clips_sq = _clips_subquery(db)

    query = (
        db.query(
            User,
            func.coalesce(minutes_sq.c.minutes, 0).label("minutes"),
            func.coalesce(clips_sq.c.clips, 0).label("clips"),
        )
        .outerjoin(minutes_sq, minutes_sq.c.user_id == User.id)
        .outerjoin(clips_sq, clips_sq.c.user_id == User.id)
    )

    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            func.lower(User.email).ilike(func.lower(like))
            | func.lower(func.coalesce(User.full_name, "")).ilike(func.lower(like))
        )
    if plan:
        try:
            query = query.filter(User.plan == UserPlan(plan))
        except ValueError as exc:
            raise ValidationError(f"Unknown plan filter: {plan}") from exc
    if status == "active":
        query = query.filter(User.is_active.is_(True))
    elif status == "inactive":
        query = query.filter(User.is_active.is_(False))
    elif status:
        raise ValidationError("status must be 'active' or 'inactive'")

    total = query.order_by(None).count()

    rows = (
        query.order_by(User.created_at.desc().nullslast(), User.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    items = [
        AdminUserRow(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_active=user.is_active,
            is_admin=user.is_admin,
            plan=user.plan,
            created_at=user.created_at,
            minutes_this_month=float(minutes or 0),
            clips_count=int(clips or 0),
        )
        for user, minutes, clips in rows
    ]

    return PaginatedUsers(
        items=items, total=total, page=page, per_page=per_page
    )


def _get_user_or_404(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise NotFoundError("User")
    return user


def _user_detail(db: Session, user: User) -> AdminUserDetail:
    minutes = (
        db.query(func.coalesce(func.sum(UsageRecord.minutes_processed), 0))
        .filter(
            UsageRecord.user_id == user.id,
            UsageRecord.period_start >= _month_start(),
        )
        .scalar()
        or 0
    )
    clips_count = (
        db.query(func.count(Clip.id)).filter(Clip.user_id == user.id).scalar()
        or 0
    )
    projects_count = (
        db.query(func.count(Project.id))
        .filter(Project.user_id == user.id)
        .scalar()
        or 0
    )
    videos_count = (
        db.query(func.count(SourceVideo.id))
        .filter(SourceVideo.user_id == user.id)
        .scalar()
        or 0
    )
    subscription = (
        db.query(Subscription).filter(Subscription.user_id == user.id).first()
    )

    return AdminUserDetail(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        is_admin=user.is_admin,
        plan=user.plan,
        created_at=user.created_at,
        minutes_this_month=float(minutes),
        clips_count=int(clips_count),
        subscription_status=(
            subscription.status if subscription is not None else None
        ),
        projects_count=int(projects_count),
        videos_count=int(videos_count),
    )


def get_user(db: Session, user_id: int) -> AdminUserDetail:
    return _user_detail(db, _get_user_or_404(db, user_id))


def update_user(
    db: Session,
    user_id: int,
    data: AdminUserUpdate,
    *,
    acting_admin_id: int,
) -> AdminUserDetail:
    user = _get_user_or_404(db, user_id)

    if data.is_admin is not None:
        if (
            data.is_admin is False
            and user.id == acting_admin_id
        ):
            raise ValidationError("An admin cannot remove their own admin role")
        user.is_admin = data.is_admin

    if data.is_active is not None:
        user.is_active = data.is_active

    if data.plan is not None:
        user.plan = UserPlan(data.plan)

    db.commit()
    db.refresh(user)
    logger.info(
        "admin %s updated user %s: %s",
        acting_admin_id,
        user_id,
        data.model_dump(exclude_none=True),
    )
    return _user_detail(db, user)


# ---------------------------------------------------------------------------
# Platform stats
# ---------------------------------------------------------------------------
def platform_stats(db: Session) -> PlatformStats:
    cutoff = datetime.now(UTC) - timedelta(days=30)

    users_total = db.query(func.count(User.id)).scalar() or 0
    users_active = (
        db.query(func.count(User.id)).filter(User.is_active.is_(True)).scalar()
        or 0
    )
    users_new_30d = (
        db.query(func.count(User.id))
        .filter(User.created_at >= cutoff)
        .scalar()
        or 0
    )
    minutes_30d = (
        db.query(func.coalesce(func.sum(UsageRecord.minutes_processed), 0))
        .filter(UsageRecord.period_end >= cutoff)
        .scalar()
        or 0
    )
    clips_total = db.query(func.count(Clip.id)).scalar() or 0
    publish_jobs_total = db.query(func.count(PublishJob.id)).scalar() or 0

    plan_counts = dict(
        db.query(Subscription.plan, func.count(Subscription.id))
        .filter(Subscription.status == SubscriptionStatus.active)
        .group_by(Subscription.plan)
        .all()
    )
    revenue_estimate_cents = sum(
        plan_counts.get(plan, 0) * price
        for plan, price in _PLAN_PRICE_CENTS.items()
    )

    return PlatformStats(
        users_total=users_total,
        users_active=users_active,
        users_new_30d=users_new_30d,
        minutes_processed_30d=float(minutes_30d),
        clips_generated_total=clips_total,
        publish_jobs_total=publish_jobs_total,
        revenue_estimate_cents=int(revenue_estimate_cents),
    )


# ---------------------------------------------------------------------------
# Job queue health
# ---------------------------------------------------------------------------
def _count_by(db: Session, column, values) -> int:
    return (
        db.query(func.count()).filter(column.in_(tuple(values))).scalar() or 0
    )


def _broker_reachable() -> bool:
    try:
        from app.workers import celery

        conn = celery.connection()
        try:
            conn.ensure_connection(max_retries=1, timeout=1)
        finally:
            conn.release()
        return True
    except Exception as exc:  # noqa: BLE001 - any failure means "not reachable"
        logger.debug("celery broker unreachable: %s", exc)
        return False


def job_queue_health(db: Session) -> JobQueueHealth:
    pipeline = QueueSection(
        pending=_count_by(
            db, SourceVideo.status, (SourceVideoStatus.queued,)
        ),
        processing=_count_by(
            db, SourceVideo.status, _PIPELINE_PROCESSING
        ),
        failed=_count_by(
            db, SourceVideo.status, (SourceVideoStatus.failed,)
        ),
    )

    # Render health is tracked on ``clip_exports`` (the actual render job rows);
    # ``clips.status`` has no failure state.
    render = QueueSection(
        pending=_count_by(
            db, ClipExport.status, (ClipExportStatus.queued,)
        ),
        processing=_count_by(
            db, ClipExport.status, (ClipExportStatus.rendering,)
        ),
        failed=_count_by(
            db, ClipExport.status, (ClipExportStatus.failed,)
        ),
    )

    publish = QueueSection(
        pending=_count_by(
            db, PublishJob.status, (PublishJobStatus.scheduled,)
        ),
        processing=_count_by(
            db, PublishJob.status, (PublishJobStatus.publishing,)
        ),
        failed=_count_by(
            db, PublishJob.status, (PublishJobStatus.failed,)
        ),
    )

    return JobQueueHealth(
        pipeline=pipeline,
        render=render,
        publish=publish,
        broker_reachable=_broker_reachable(),
    )
