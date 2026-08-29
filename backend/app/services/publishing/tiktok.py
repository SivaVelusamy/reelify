"""TikTok publish adapter.

OAuth: TikTok Login Kit v2 (https://developers.tiktok.com/doc/login-kit-web).
Publish: Content Posting API (`/v2/post/publish/video/init/` then a PUT upload,
then polling `/v2/post/publish/status/fetch/`). The ``publish()`` call here is a
STUB — it logs the intended request and returns a fake id.
"""

import logging
import secrets
from urllib.parse import urlencode

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/"
TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
SCOPES = "user.info.basic,video.upload,video.publish"
_HTTP_TIMEOUT = 15.0


def redirect_uri() -> str:
    return f"{settings.OAUTH_REDIRECT_BASE_URL}/tiktok"


def build_auth_url(state: str) -> str:
    """Full TikTok authorization URL the user is redirected to."""
    params = {
        "client_key": settings.TIKTOK_CLIENT_KEY,
        "response_type": "code",
        "scope": SCOPES,
        "redirect_uri": redirect_uri(),
        "state": state,
    }
    return f"{AUTHORIZE_URL}?{urlencode(params)}"


def exchange_code(code: str) -> dict:
    """Exchange an authorization ``code`` for tokens.

    Returns a dict with at least ``access_token`` / ``refresh_token`` /
    ``expires_in``. Without configured credentials (template default) this
    returns deterministic stub tokens so the connect flow is testable.
    """
    if not settings.TIKTOK_CLIENT_KEY:
        logger.info("tiktok.exchange_code: no TIKTOK_CLIENT_KEY — returning STUB tokens")
        return {
            "access_token": f"stub-tiktok-access-{secrets.token_hex(8)}",
            "refresh_token": f"stub-tiktok-refresh-{secrets.token_hex(8)}",
            "expires_in": 86400,
            "open_id": f"stub-open-id-{secrets.token_hex(4)}",
            "scope": SCOPES,
        }

    with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
        resp = client.post(
            TOKEN_URL,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "client_key": settings.TIKTOK_CLIENT_KEY,
                "client_secret": settings.TIKTOK_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri(),
            },
        )
        resp.raise_for_status()
        return resp.json()


def publish(job, clip, account_or_webhook) -> str:
    """STUB upload to TikTok.

    Real flow:
      1. POST https://open.tiktokapis.com/v2/post/publish/video/init/
         headers: Authorization: Bearer <access_token>
         json: {"post_info": {"title": job.caption_text, "privacy_level": "SELF_ONLY"},
                "source_info": {"source": "PULL_FROM_URL",
                                "video_url": <presigned clip url>}}
      2. Poll https://open.tiktokapis.com/v2/post/publish/status/fetch/ until PUBLISH_COMPLETE.
    """
    fake_id = f"tiktok-stub-{job.id}-{secrets.token_hex(6)}"
    logger.info(
        "tiktok.publish STUB: would upload clip %s (caption=%r) -> external_post_id=%s",
        clip.id,
        (job.caption_text or "")[:60],
        fake_id,
    )
    return fake_id
