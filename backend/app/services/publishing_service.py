"""Business logic for Module 8 (Publishing / Distribution).

Ownership rule: every function except :func:`get_public_clip` is scoped to the
calling user; a row owned by someone else is treated as missing
(``NotFoundError``). :func:`get_public_clip` is the only unauthenticated path and
is guarded by an unguessable slug + ``is_active`` + expiry.
"""

import logging
import secrets
from datetime import UTC, datetime, timedelta
from urllib.parse import urlparse

from sqlalchemy.orm import Session, selectinload

from app.auth.security import decrypt_token, encrypt_token
from app.config import settings
from app.exceptions import NotFoundError, ValidationError
from app.models.clip import Clip
from app.models.publishing import (
    PublishDestinationType,
    PublishJob,
    PublishJobStatus,
    ShareLink,
    SocialAccount,
    SocialAccountStatus,
    SocialPlatform,
)
from app.models.user import User
from app.schemas.publishing import (
    CalendarEntry,
    ConnectStartResponse,
    PublicClipResponse,
    PublishJobUpdate,
    PublishRequest,
    ShareLinkResponse,
)
from app.services.oauth_state import issue_state, verify_state
from app.services.publishing import SOCIAL_ADAPTERS
from app.workers.publishing import run_publish_job

logger = logging.getLogger(__name__)

SOCIAL_PLATFORMS = {"tiktok", "instagram", "youtube"}
_SOCIAL_PLATFORM_ENUMS = {
    SocialPlatform.tiktok,
    SocialPlatform.instagram,
    SocialPlatform.youtube,
}
_EDITABLE_JOB_STATUSES = {PublishJobStatus.draft, PublishJobStatus.scheduled}
SLUG_BYTES = 9  # secrets.token_urlsafe(9) -> 12-char unguessable slug


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #
def _as_aware_utc(value: datetime) -> datetime:
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value.astimezone(UTC)


def _get_owned_clip(db: Session, user: User, clip_id: int) -> Clip:
    clip = (
        db.query(Clip)
        .filter(Clip.id == clip_id, Clip.user_id == user.id)
        .first()
    )
    if clip is None:
        raise NotFoundError("Clip")
    return clip


def _get_owned_job(db: Session, user: User, job_id: int) -> PublishJob:
    job = (
        db.query(PublishJob)
        .filter(PublishJob.id == job_id, PublishJob.user_id == user.id)
        .first()
    )
    if job is None:
        raise NotFoundError("Publish job")
    return job


def _get_owned_account(db: Session, user: User, account_id: int) -> SocialAccount:
    account = (
        db.query(SocialAccount)
        .filter(SocialAccount.id == account_id, SocialAccount.user_id == user.id)
        .first()
    )
    if account is None:
        raise NotFoundError("Social account")
    return account


def _new_unique_slug(db: Session) -> str:
    for _ in range(5):
        candidate = secrets.token_urlsafe(SLUG_BYTES)
        if not db.query(ShareLink.id).filter(ShareLink.slug == candidate).first():
            return candidate
    raise RuntimeError("Could not allocate a unique share-link slug")


def _share_link_response(link: ShareLink) -> ShareLinkResponse:
    return ShareLinkResponse(
        url=f"{settings.FRONTEND_URL}/s/{link.slug}",
        slug=link.slug,
        is_active=link.is_active,
        expires_at=link.expires_at,
        view_count=link.view_count or 0,
    )


_WEBHOOK_HOST_SUFFIXES: dict[str, tuple[str, ...]] = {
    "slack": ("hooks.slack.com",),
    "teams": (".webhook.office.com", ".office.com", "outlook.office.com"),
}


def _validate_webhook_url(platform: SocialPlatform, webhook_url: str) -> None:
    """Reject anything that is not a real Slack/Teams incoming-webhook host (SSRF guard)."""
    parsed = urlparse(webhook_url)
    if parsed.scheme != "https" or not parsed.hostname:
        raise ValidationError("Webhook URL must be a valid https URL")
    host = parsed.hostname.lower()
    allowed = _WEBHOOK_HOST_SUFFIXES.get(platform.value, ())
    if not any(host == s or host.endswith(s) for s in allowed):
        raise ValidationError(
            f"Webhook host {host!r} is not an accepted {platform.value} webhook endpoint"
        )


def _upsert_webhook_account(
    db: Session, user: User, platform: SocialPlatform, webhook_url: str
) -> SocialAccount:
    """Store a Slack/Teams incoming-webhook URL encrypted on a SocialAccount row.

    Reuses an existing row for the same user+platform whose decrypted webhook
    matches, otherwise creates one.
    """
    _validate_webhook_url(platform, webhook_url)

    for account in (
        db.query(SocialAccount)
        .filter(SocialAccount.user_id == user.id, SocialAccount.platform == platform)
        .all()
    ):
        try:
            if account.access_token_encrypted and (
                decrypt_token(account.access_token_encrypted) == webhook_url
            ):
                account.status = SocialAccountStatus.connected
                db.add(account)
                db.commit()
                db.refresh(account)
                return account
        except Exception:  # noqa: BLE001 - a bad ciphertext just means "no match"
            continue

    account = SocialAccount(
        user_id=user.id,
        platform=platform,
        display_name=f"{platform.value.title()} webhook",
        access_token_encrypted=encrypt_token(webhook_url),
        status=SocialAccountStatus.connected,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


# --------------------------------------------------------------------------- #
# OAuth connect
# --------------------------------------------------------------------------- #
def connect_start(db: Session, user: User, platform: str) -> ConnectStartResponse:
    if platform not in SOCIAL_PLATFORMS:
        raise ValidationError(f"Unsupported OAuth platform: {platform}")
    adapter = SOCIAL_ADAPTERS[platform]
    state = issue_state(user.id, platform)
    return ConnectStartResponse(auth_url=adapter.build_auth_url(state), state=state)


def oauth_callback(db: Session, platform: str, code: str, state: str) -> SocialAccount:
    if platform not in SOCIAL_PLATFORMS:
        raise ValidationError(f"Unsupported OAuth platform: {platform}")

    body = verify_state(state, platform)
    user_id = int(body["user_id"])
    adapter = SOCIAL_ADAPTERS[platform]

    tokens = adapter.exchange_code(code)
    access_token = tokens.get("access_token")
    if not access_token:
        raise ValidationError("OAuth provider did not return an access token")

    refresh_token = tokens.get("refresh_token")
    expires_in = tokens.get("expires_in")
    expires_at = (
        datetime.now(UTC) + timedelta(seconds=int(expires_in)) if expires_in else None
    )
    external_id = tokens.get("open_id") or tokens.get("user_id")
    platform_enum = SocialPlatform(platform)

    account = (
        db.query(SocialAccount)
        .filter(
            SocialAccount.user_id == user_id,
            SocialAccount.platform == platform_enum,
        )
        .first()
    )
    if account is None:
        account = SocialAccount(user_id=user_id, platform=platform_enum)

    account.access_token_encrypted = encrypt_token(access_token)
    account.refresh_token_encrypted = (
        encrypt_token(refresh_token) if refresh_token else None
    )
    account.token_expires_at = expires_at
    account.external_account_id = str(external_id) if external_id else None
    account.display_name = account.display_name or f"{platform.title()} account"
    account.status = SocialAccountStatus.connected

    db.add(account)
    db.commit()
    db.refresh(account)
    logger.info(
        "oauth_callback: connected %s account %s for user %s",
        platform,
        account.id,
        user_id,
    )
    return account


def list_accounts(db: Session, user: User) -> list[SocialAccount]:
    return (
        db.query(SocialAccount)
        .filter(SocialAccount.user_id == user.id)
        .order_by(SocialAccount.created_at.desc())
        .all()
    )


def disconnect(db: Session, user: User, account_id: int) -> None:
    account = _get_owned_account(db, user, account_id)
    db.delete(account)
    db.commit()
    logger.info("disconnect: removed social account %s for user %s", account_id, user.id)


# --------------------------------------------------------------------------- #
# publish / schedule
# --------------------------------------------------------------------------- #
def publish_or_schedule(
    db: Session, user: User, clip_id: int, req: PublishRequest
) -> PublishJob:
    # The clip does not need to be rendered yet — run_publish_job renders it
    # (or re-renders a stale placeholder) as the first step.
    clip = _get_owned_clip(db, user, clip_id)

    dest = req.destination_type
    social_account_id: int | None = None

    if dest == PublishDestinationType.social:
        if not req.social_account_id:
            raise ValidationError("social destination requires social_account_id")
        account = _get_owned_account(db, user, req.social_account_id)
        if account.platform not in _SOCIAL_PLATFORM_ENUMS:
            raise ValidationError("social_account_id does not point to a social media account")
        if account.status != SocialAccountStatus.connected:
            raise ValidationError("The selected social account is not connected")
        social_account_id = account.id

    elif dest in (PublishDestinationType.slack, PublishDestinationType.teams):
        if not req.slack_webhook_url:
            raise ValidationError(f"{dest.value} destination requires slack_webhook_url")
        platform_enum = (
            SocialPlatform.slack
            if dest == PublishDestinationType.slack
            else SocialPlatform.teams
        )
        account = _upsert_webhook_account(db, user, platform_enum, req.slack_webhook_url)
        social_account_id = account.id

    # PublishDestinationType.link needs no account.

    now = datetime.now(UTC)
    scheduled_at = req.scheduled_at
    is_future = scheduled_at is not None and _as_aware_utc(scheduled_at) > now

    job = PublishJob(
        clip_id=clip.id,
        user_id=user.id,
        social_account_id=social_account_id,
        destination_type=dest,
        caption_text=req.caption_text,
        scheduled_at=scheduled_at,
        status=PublishJobStatus.scheduled if is_future else PublishJobStatus.publishing,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    if not is_future:
        try:
            run_publish_job.delay(job.id)
            logger.info(
                "publish_or_schedule: enqueued run_publish_job for job %s", job.id
            )
        except Exception as exc:  # pragma: no cover - broker/environment dependent
            logger.warning(
                "publish_or_schedule: could not enqueue job %s: %s", job.id, exc
            )
    else:
        logger.info("publish_or_schedule: scheduled job %s for %s", job.id, scheduled_at)

    return job


def list_jobs(
    db: Session,
    user: User,
    status: PublishJobStatus | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[PublishJob]:
    query = (
        db.query(PublishJob)
        .options(
            selectinload(PublishJob.social_account),
            selectinload(PublishJob.clip),
        )
        .filter(PublishJob.user_id == user.id)
    )
    if status is not None:
        query = query.filter(PublishJob.status == status)
    if date_from is not None:
        query = query.filter(PublishJob.scheduled_at >= date_from)
    if date_to is not None:
        query = query.filter(PublishJob.scheduled_at <= date_to)
    return query.order_by(PublishJob.created_at.desc()).all()


def update_job(
    db: Session, user: User, job_id: int, payload: PublishJobUpdate
) -> PublishJob:
    job = _get_owned_job(db, user, job_id)
    if job.status not in _EDITABLE_JOB_STATUSES:
        raise ValidationError("Only draft or scheduled jobs can be rescheduled or edited")

    data = payload.model_dump(exclude_unset=True)
    if "caption_text" in data:
        job.caption_text = data["caption_text"]
    if "scheduled_at" in data:
        job.scheduled_at = data["scheduled_at"]
        if data["scheduled_at"] is not None:
            job.status = PublishJobStatus.scheduled

    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def cancel_job(db: Session, user: User, job_id: int) -> None:
    job = _get_owned_job(db, user, job_id)
    if job.status not in _EDITABLE_JOB_STATUSES:
        raise ValidationError("Only draft or scheduled jobs can be cancelled")
    db.delete(job)
    db.commit()
    logger.info("cancel_job: cancelled publish job %s for user %s", job_id, user.id)


def calendar(
    db: Session, user: User, date_from: datetime, date_to: datetime
) -> list[CalendarEntry]:
    jobs = (
        db.query(PublishJob)
        .options(
            selectinload(PublishJob.social_account),
            selectinload(PublishJob.clip),
        )
        .filter(
            PublishJob.user_id == user.id,
            PublishJob.scheduled_at.isnot(None),
            PublishJob.scheduled_at >= date_from,
            PublishJob.scheduled_at <= date_to,
        )
        .order_by(PublishJob.scheduled_at.asc())
        .all()
    )

    entries: list[CalendarEntry] = []
    for job in jobs:
        platform = job.destination_type.value
        if job.social_account is not None and job.social_account.platform is not None:
            platform = job.social_account.platform.value
        entries.append(
            CalendarEntry(
                id=job.id,
                clip_id=job.clip_id,
                title=job.clip.title if job.clip is not None else None,
                platform=platform,
                scheduled_at=job.scheduled_at,
                status=job.status,
            )
        )
    return entries


# --------------------------------------------------------------------------- #
# share links
# --------------------------------------------------------------------------- #
def create_share_link(
    db: Session, user: User, clip_id: int, expires_at: datetime | None = None
) -> ShareLinkResponse:
    clip = _get_owned_clip(db, user, clip_id)

    link = ShareLink(
        clip_id=clip.id,
        user_id=user.id,
        slug=_new_unique_slug(db),
        is_active=True,
        expires_at=expires_at,
    )
    db.add(link)
    db.commit()
    db.refresh(link)

    # Ensure the clip has a rendered video so /s/<slug> works shortly.
    if not clip.render_storage_key:
        _enqueue_render(clip.id)

    logger.info("create_share_link: %s for clip %s", link.slug, clip.id)
    return _share_link_response(link)


def _enqueue_render(clip_id: int) -> None:
    try:
        from app.workers.render import render_clip

        render_clip.delay(clip_id)
    except Exception as exc:  # pragma: no cover - broker/environment dependent
        logger.warning("create_share_link: could not enqueue render %s: %s", clip_id, exc)


def get_public_clip(db: Session, slug: str) -> PublicClipResponse:
    """Unauthenticated. Validates active + not expired, bumps view_count."""
    link = db.query(ShareLink).filter(ShareLink.slug == slug).first()
    if link is None or not link.is_active:
        raise NotFoundError("Shared clip")
    if link.expires_at is not None and _as_aware_utc(link.expires_at) < datetime.now(UTC):
        raise NotFoundError("Shared clip")

    clip = db.query(Clip).filter(Clip.id == link.clip_id).first()
    if clip is None or not clip.render_storage_key:
        raise NotFoundError("Shared clip")

    db.query(ShareLink).filter(ShareLink.id == link.id).update(
        {ShareLink.view_count: ShareLink.view_count + 1}
    )
    db.commit()

    from app.storage import generate_presigned_url

    return PublicClipResponse(
        title=clip.title,
        video_url=generate_presigned_url(clip.render_storage_key),
        duration=max(clip.end_seconds - clip.start_seconds, 0.0),
    )
