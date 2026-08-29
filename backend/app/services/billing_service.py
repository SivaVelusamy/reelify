"""Module 7 — Billing (Stripe) business logic.

Stripe is *optional* in this template. When ``settings.STRIPE_SECRET_KEY`` is
unset (or still the shipped ``sk_test_placeholder`` value) every Stripe API call
is SHORT-CIRCUITED with a local simulation:

* ``create_checkout_session`` immediately creates/updates a local ``Subscription``
  row (``status="active"``, ``plan=<plan>``, ``current_period_end=now+30d``), sets
  ``user.plan`` and returns a fake ``?checkout=success`` URL.
* ``create_portal_session`` returns a fake portal URL.

This keeps the whole billing flow testable without a Stripe account or network
access. The webhook handler always verifies the Stripe signature and has no
simulation path (a webhook only ever arrives from a real Stripe integration).

Usage / limit enforcement:

* ``get_overview`` reports current-calendar-month usage vs. the plan limit.
* ``check_usage_allows_processing`` raises :class:`PaymentRequiredError` (402)
  once the caller has processed >= their plan's monthly minute allowance. This is
  the hook wired into pipeline-enqueue endpoints via
  ``app.billing_guard.require_within_usage_limit``.
"""

import logging
from datetime import UTC, datetime, timedelta

import stripe
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from app.exceptions import PaymentRequiredError, ValidationError
from app.models.billing import (
    Subscription,
    SubscriptionPlan,
    SubscriptionStatus,
    UsageRecord,
)
from app.models.clip import Clip
from app.models.project import SourceVideo, SourceVideoStatus
from app.models.user import User, UserPlan
from app.public_url import public_base_url
from app.schemas.billing import (
    BillingOverview,
    SubscriptionResponse,
    UsageResponse,
)

logger = logging.getLogger(__name__)

# Monthly processing allowance (minutes) per plan.
PLAN_MINUTES = {"free": 30, "starter": 300, "pro": 1200}

# Stripe Price ID per paid plan (from env / config).
PLAN_PRICE_ENV = {
    "starter": settings.STRIPE_PRICE_ID_STARTER,
    "pro": settings.STRIPE_PRICE_ID_PRO,
}

# In-process idempotency guard for webhook event ids (best-effort; the DB upsert
# below is itself idempotent, so a restart that loses this set is harmless).
_processed_event_ids: set[str] = set()

_STRIPE_STATUS_MAP = {
    "active": SubscriptionStatus.active,
    "trialing": SubscriptionStatus.trialing,
    "past_due": SubscriptionStatus.past_due,
    "unpaid": SubscriptionStatus.past_due,
    "canceled": SubscriptionStatus.canceled,
    "incomplete": SubscriptionStatus.incomplete,
    "incomplete_expired": SubscriptionStatus.canceled,
}


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _stripe_enabled() -> bool:
    """True when a real Stripe secret key is configured."""
    key = (settings.STRIPE_SECRET_KEY or "").strip()
    return bool(key) and "placeholder" not in key.lower()


def _price_configured(price_id: str | None) -> bool:
    return bool(price_id) and "placeholder" not in price_id.lower()


def _enum_value(value) -> str:
    return value.value if hasattr(value, "value") else str(value)


def _coerce_status(value) -> SubscriptionStatus:
    if isinstance(value, SubscriptionStatus):
        return value
    return _STRIPE_STATUS_MAP.get(str(value), SubscriptionStatus.incomplete)


def _plan_from_price(price_id: str | None) -> str | None:
    for plan, pid in PLAN_PRICE_ENV.items():
        if pid and pid == price_id:
            return plan
    return None


def _month_bounds(now: datetime | None = None) -> tuple[datetime, datetime]:
    now = now or datetime.now(UTC)
    start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return start, end


def _get_subscription(db: Session, user_id: int) -> Subscription | None:
    return (
        db.query(Subscription).filter(Subscription.user_id == user_id).first()
    )


def _ensure_subscription_row(db: Session, user: User) -> Subscription:
    sub = _get_subscription(db, user.id)
    if sub is None:
        sub = Subscription(
            user_id=user.id,
            plan=SubscriptionPlan.free,
            status=SubscriptionStatus.incomplete,
        )
        db.add(sub)
        db.commit()
        db.refresh(sub)
    return sub


def _ensure_stripe_customer(db: Session, user: User) -> Subscription:
    sub = _ensure_subscription_row(db, user)
    if sub.stripe_customer_id:
        return sub
    stripe.api_key = settings.STRIPE_SECRET_KEY
    customer = stripe.Customer.create(
        email=user.email,
        name=user.full_name or None,
        metadata={"user_id": str(user.id)},
    )
    sub.stripe_customer_id = customer["id"]
    db.commit()
    db.refresh(sub)
    return sub


# --------------------------------------------------------------------------- #
# usage
# --------------------------------------------------------------------------- #
def current_month_usage(db: Session, user: User) -> dict:
    """Current calendar-month usage for ``user``.

    * minutes  = sum of ``SourceVideo.duration_seconds`` / 60 for videos that
      reached the ``ready`` state this month.
    * clips    = count of ``Clip`` rows created this month.
    * storage  = sum of ``UsageRecord.storage_bytes`` overlapping this month.
    """
    start, end = _month_bounds()

    seconds = (
        db.query(func.coalesce(func.sum(SourceVideo.duration_seconds), 0.0))
        .filter(
            SourceVideo.user_id == user.id,
            SourceVideo.status == SourceVideoStatus.ready,
            SourceVideo.created_at >= start,
            SourceVideo.created_at < end,
        )
        .scalar()
    ) or 0.0
    minutes = int(float(seconds) // 60)

    clips = (
        db.query(func.count(Clip.id))
        .filter(
            Clip.user_id == user.id,
            Clip.created_at >= start,
            Clip.created_at < end,
        )
        .scalar()
    ) or 0

    storage = (
        db.query(func.coalesce(func.sum(UsageRecord.storage_bytes), 0))
        .filter(
            UsageRecord.user_id == user.id,
            UsageRecord.period_end >= start,
            UsageRecord.period_start < end,
        )
        .scalar()
    ) or 0

    return {
        "minutes_processed": minutes,
        "clips_generated": int(clips),
        "storage_bytes": int(storage),
    }


def get_overview(db: Session, user: User) -> BillingOverview:
    sub = _get_subscription(db, user.id)
    usage = current_month_usage(db, user)

    plan_str = _enum_value(user.plan)
    limit = PLAN_MINUTES.get(plan_str, PLAN_MINUTES["free"])

    usage_resp = UsageResponse(
        minutes_processed=usage["minutes_processed"],
        clips_generated=usage["clips_generated"],
        storage_bytes=usage["storage_bytes"],
        minutes_limit=limit,
        over_limit=usage["minutes_processed"] >= limit,
    )

    sub_resp: SubscriptionResponse | None = None
    if sub is not None:
        sub_resp = SubscriptionResponse(
            plan=_enum_value(sub.plan),
            status=_enum_value(sub.status),
            current_period_end=sub.current_period_end,
            cancel_at_period_end=(sub.status == SubscriptionStatus.canceled)
            or None,
        )

    return BillingOverview(subscription=sub_resp, usage=usage_resp)


def check_usage_allows_processing(db: Session, user: User) -> None:
    """Raise :class:`PaymentRequiredError` (402) when the caller has exhausted
    their plan's monthly processing allowance."""
    plan_str = _enum_value(user.plan)
    limit = PLAN_MINUTES.get(plan_str, PLAN_MINUTES["free"])
    minutes = current_month_usage(db, user)["minutes_processed"]
    if minutes >= limit:
        raise PaymentRequiredError(
            f"Monthly processing limit reached for the {plan_str} plan "
            f"({minutes}/{limit} minutes this month). Upgrade your plan to "
            f"process more video."
        )


# --------------------------------------------------------------------------- #
# checkout / portal
# --------------------------------------------------------------------------- #
def create_checkout_session(db: Session, user: User, plan: str) -> str:
    if plan not in PLAN_PRICE_ENV:
        raise ValidationError(f"Unknown plan: {plan!r}")

    if not _stripe_enabled():
        # SHORT-CIRCUIT — no Stripe key configured (template default).
        sub = _ensure_subscription_row(db, user)
        sub.plan = SubscriptionPlan(plan)
        sub.status = SubscriptionStatus.active
        sub.current_period_end = datetime.now(UTC) + timedelta(days=30)
        user.plan = UserPlan(plan)
        db.commit()
        logger.info(
            "Stripe disabled — simulated checkout for user %s -> %s plan",
            user.id,
            plan,
        )
        return (
            f"{public_base_url()}/billing?checkout=success&simulated=1"
        )

    price_id = PLAN_PRICE_ENV[plan]
    if not _price_configured(price_id):
        raise ValidationError(
            f"No Stripe price id configured for the {plan!r} plan"
        )

    sub = _ensure_stripe_customer(db, user)
    stripe.api_key = settings.STRIPE_SECRET_KEY
    session = stripe.checkout.Session.create(
        mode="subscription",
        customer=sub.stripe_customer_id,
        line_items=[{"price": price_id, "quantity": 1}],
        success_url=f"{public_base_url()}/billing?checkout=success",
        cancel_url=f"{public_base_url()}/billing?checkout=cancelled",
        metadata={"user_id": str(user.id), "plan": plan},
        subscription_data={
            "metadata": {"user_id": str(user.id), "plan": plan}
        },
    )
    return session["url"]


def create_portal_session(db: Session, user: User) -> str:
    if not _stripe_enabled():
        # SHORT-CIRCUIT — no Stripe key configured (template default).
        return f"{public_base_url()}/billing?portal=simulated"

    sub = _get_subscription(db, user.id)
    if sub is None or not sub.stripe_customer_id:
        raise ValidationError(
            "No Stripe customer exists for this account yet"
        )
    stripe.api_key = settings.STRIPE_SECRET_KEY
    session = stripe.billing_portal.Session.create(
        customer=sub.stripe_customer_id,
        return_url=f"{public_base_url()}/billing",
    )
    return session["url"]


# --------------------------------------------------------------------------- #
# webhook
# --------------------------------------------------------------------------- #
def _sync_subscription(
    db: Session,
    *,
    user_id: int,
    plan: str | None,
    status: object | None,
    current_period_end: datetime | None,
    stripe_customer_id: str | None = None,
    stripe_subscription_id: str | None = None,
) -> None:
    sub = _get_subscription(db, user_id)
    if sub is None:
        sub = Subscription(user_id=user_id, plan=SubscriptionPlan.free)
        db.add(sub)

    if plan is not None:
        sub.plan = SubscriptionPlan(plan)
    if status is not None:
        sub.status = _coerce_status(status)
    if current_period_end is not None:
        sub.current_period_end = current_period_end
    if stripe_customer_id:
        sub.stripe_customer_id = stripe_customer_id
    if stripe_subscription_id:
        sub.stripe_subscription_id = stripe_subscription_id

    if plan is not None:
        user = db.query(User).filter(User.id == user_id).first()
        if user is not None:
            user.plan = UserPlan(plan)

    db.commit()


def _resolve_user_id(
    db: Session, metadata: dict | None, customer_id: str | None
) -> int | None:
    metadata = metadata or {}
    if metadata.get("user_id") is not None:
        try:
            return int(metadata["user_id"])
        except (TypeError, ValueError):
            pass
    if customer_id:
        row = (
            db.query(Subscription)
            .filter(Subscription.stripe_customer_id == customer_id)
            .first()
        )
        if row is not None:
            return row.user_id
    return None


def _handle_checkout_completed(db: Session, obj: dict) -> None:
    customer_id = obj.get("customer")
    user_id = _resolve_user_id(db, obj.get("metadata"), customer_id)
    if user_id is None:
        logger.warning("checkout.session.completed without a resolvable user")
        return
    plan = (obj.get("metadata") or {}).get("plan")
    _sync_subscription(
        db,
        user_id=user_id,
        plan=plan,
        status="active",
        current_period_end=None,
        stripe_customer_id=customer_id,
        stripe_subscription_id=obj.get("subscription"),
    )


def _handle_subscription_event(db: Session, event_type: str, obj: dict) -> None:
    customer_id = obj.get("customer")
    user_id = _resolve_user_id(db, obj.get("metadata"), customer_id)
    if user_id is None:
        logger.warning("%s without a resolvable user", event_type)
        return

    cpe = obj.get("current_period_end")
    cpe_dt = (
        datetime.fromtimestamp(cpe, tz=UTC) if cpe else None
    )

    if event_type == "customer.subscription.deleted":
        _sync_subscription(
            db,
            user_id=user_id,
            plan="free",
            status="canceled",
            current_period_end=cpe_dt,
            stripe_customer_id=customer_id,
            stripe_subscription_id=obj.get("id"),
        )
        return

    plan = (obj.get("metadata") or {}).get("plan")
    if plan is None:
        try:
            price_id = obj["items"]["data"][0]["price"]["id"]
        except (KeyError, IndexError, TypeError):
            price_id = None
        plan = _plan_from_price(price_id)

    _sync_subscription(
        db,
        user_id=user_id,
        plan=plan,
        status=obj.get("status"),
        current_period_end=cpe_dt,
        stripe_customer_id=customer_id,
        stripe_subscription_id=obj.get("id"),
    )


def handle_webhook(db: Session, payload: bytes, sig_header: str) -> dict:
    """Verify the Stripe signature and apply the event.

    Raises :class:`ValidationError` (422) when signature verification fails.
    Idempotent by Stripe event id.
    """
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except Exception as exc:  # ValueError, SignatureVerificationError, ...
        logger.warning("Stripe webhook signature verification failed: %s", exc)
        raise ValidationError(
            "Stripe webhook signature verification failed"
        ) from exc

    event_id = event.get("id")
    if event_id and event_id in _processed_event_ids:
        logger.info("Ignoring duplicate Stripe event %s", event_id)
        return {"received": True, "duplicate": True}

    event_type = event.get("type")
    obj = event["data"]["object"]

    if event_type == "checkout.session.completed":
        _handle_checkout_completed(db, obj)
    elif event_type in (
        "customer.subscription.updated",
        "customer.subscription.deleted",
    ):
        _handle_subscription_event(db, event_type, obj)
    else:
        logger.info("Ignoring unhandled Stripe event type %s", event_type)

    if event_id:
        _processed_event_ids.add(event_id)
    return {"received": True}
