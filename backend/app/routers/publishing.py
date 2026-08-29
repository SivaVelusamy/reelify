"""Module 8 — Publishing / Distribution API.

Mounted under ``/api/v1`` by ``app.main``. Every route requires an authenticated
active user except ``GET /s/{slug}`` (public share view) and
``GET /social-accounts/callback/{platform}`` (the OAuth provider redirects the
browser here with a signed ``state`` that carries the user identity).
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.publishing import PublishJobStatus
from app.models.user import User
from app.schemas.publishing import (
    CalendarEntry,
    ConnectStartResponse,
    PublicClipResponse,
    PublishJobResponse,
    PublishJobUpdate,
    PublishRequest,
    ShareLinkCreate,
    ShareLinkResponse,
    SocialAccountResponse,
)
from app.services import publishing_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["publishing"])


# --------------------------------------------------------------------------- #
# social accounts
# --------------------------------------------------------------------------- #
@router.get("/social-accounts", response_model=list[SocialAccountResponse])
async def list_social_accounts(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> list[SocialAccountResponse]:
    return publishing_service.list_accounts(db, user)


@router.post("/social-accounts/connect/{platform}", response_model=ConnectStartResponse)
async def connect_social_account(
    platform: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> ConnectStartResponse:
    return publishing_service.connect_start(db, user, platform)


@router.get("/social-accounts/callback/{platform}")
def social_account_callback(
    platform: str,
    code: str = Query(...),
    state: str = Query(...),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    # Sync def: the OAuth code-for-token exchange uses a blocking httpx.Client,
    # so FastAPI runs this in the threadpool instead of on the event loop.
    # A bad/tampered state raises ValidationError (-> 422); a downstream provider
    # failure sends the user back to the UI with an error flag.
    body = publishing_service.verify_connect_state(platform, state)
    try:
        publishing_service.complete_oauth_callback(db, platform, code, body)
    except Exception as exc:  # noqa: BLE001 - always return the user to the UI
        logger.warning("social callback failed for %s: %s", platform, exc)
        return RedirectResponse(
            url=f"{settings.FRONTEND_URL}/settings/connections?connect_error={platform}",
            status_code=status.HTTP_302_FOUND,
        )
    sim = "" if publishing_service.social_platform_configured(platform) else "&simulated=1"
    return RedirectResponse(
        url=f"{settings.FRONTEND_URL}/settings/connections?connected={platform}{sim}",
        status_code=status.HTTP_302_FOUND,
    )


@router.delete("/social-accounts/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect_social_account(
    account_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> None:
    publishing_service.disconnect(db, user, account_id)


# --------------------------------------------------------------------------- #
# publish jobs
# --------------------------------------------------------------------------- #
@router.post(
    "/clips/{clip_id}/publish",
    response_model=PublishJobResponse,
    status_code=status.HTTP_201_CREATED,
)
async def publish_clip(
    clip_id: int,
    payload: PublishRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> PublishJobResponse:
    return publishing_service.publish_or_schedule(db, user, clip_id, payload)


@router.get("/publish-jobs", response_model=list[PublishJobResponse])
async def list_publish_jobs(
    job_status: PublishJobStatus | None = Query(default=None, alias="status"),
    date_from: datetime | None = Query(default=None, alias="from"),
    date_to: datetime | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> list[PublishJobResponse]:
    return publishing_service.list_jobs(db, user, job_status, date_from, date_to)


@router.put("/publish-jobs/{job_id}", response_model=PublishJobResponse)
async def update_publish_job(
    job_id: int,
    payload: PublishJobUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> PublishJobResponse:
    return publishing_service.update_job(db, user, job_id, payload)


@router.delete("/publish-jobs/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_publish_job(
    job_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> None:
    publishing_service.cancel_job(db, user, job_id)


@router.get("/publish/calendar", response_model=list[CalendarEntry])
async def publish_calendar(
    date_from: datetime = Query(..., alias="from"),
    date_to: datetime = Query(..., alias="to"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> list[CalendarEntry]:
    return publishing_service.calendar(db, user, date_from, date_to)


# --------------------------------------------------------------------------- #
# share links
# --------------------------------------------------------------------------- #
@router.post(
    "/clips/{clip_id}/share-link",
    response_model=ShareLinkResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_share_link(
    clip_id: int,
    payload: ShareLinkCreate | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> ShareLinkResponse:
    expires_at = payload.expires_at if payload is not None else None
    return publishing_service.create_share_link(db, user, clip_id, expires_at)


@router.get("/s/{slug}", response_model=PublicClipResponse)
async def public_clip_view(
    slug: str,
    db: Session = Depends(get_db),
) -> PublicClipResponse:
    return publishing_service.get_public_clip(db, slug)
