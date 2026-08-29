"""Instagram publish adapter (Instagram Graph API / Facebook Login).

OAuth: https://api.instagram.com/oauth/authorize (Instagram Basic Display /
Business login via Facebook). Publish: the two-step Content Publishing API
(`POST /{ig-user-id}/media` to create a container, then
`POST /{ig-user-id}/media_publish`). ``publish()`` is a STUB.
"""

import logging
import secrets
from urllib.parse import urlencode

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

AUTHORIZE_URL = "https://api.instagram.com/oauth/authorize"
TOKEN_URL = "https://api.instagram.com/oauth/access_token"
SCOPES = "instagram_business_basic,instagram_business_content_publish"
_HTTP_TIMEOUT = 15.0


def redirect_uri() -> str:
    return f"{settings.OAUTH_REDIRECT_BASE_URL}/instagram"


def build_auth_url(state: str) -> str:
    params = {
        "client_id": settings.INSTAGRAM_CLIENT_ID,
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "scope": SCOPES,
        "state": state,
    }
    return f"{AUTHORIZE_URL}?{urlencode(params)}"


def exchange_code(code: str) -> dict:
    if not settings.INSTAGRAM_CLIENT_ID:
        logger.info(
            "instagram.exchange_code: no INSTAGRAM_CLIENT_ID — returning STUB tokens"
        )
        return {
            "access_token": f"stub-instagram-access-{secrets.token_hex(8)}",
            "refresh_token": None,
            "expires_in": 5184000,  # 60d long-lived token
            "user_id": f"stub-ig-user-{secrets.token_hex(4)}",
        }

    with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
        resp = client.post(
            TOKEN_URL,
            data={
                "client_id": settings.INSTAGRAM_CLIENT_ID,
                "client_secret": settings.INSTAGRAM_CLIENT_SECRET,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri(),
                "code": code,
            },
        )
        resp.raise_for_status()
        return resp.json()


def publish(job, clip, account_or_webhook) -> str:
    """STUB upload to Instagram.

    Real flow:
      1. POST https://graph.instagram.com/v21.0/{ig_user_id}/media
         params: {"media_type": "REELS", "video_url": <presigned clip url>,
                  "caption": job.caption_text, "access_token": <token>}
         -> {"id": "<creation_id>"}
      2. Poll GET /{creation_id}?fields=status_code until FINISHED.
      3. POST https://graph.instagram.com/v21.0/{ig_user_id}/media_publish
         params: {"creation_id": "<creation_id>", "access_token": <token>}
         -> {"id": "<media_id>"}
    """
    fake_id = f"instagram-stub-{job.id}-{secrets.token_hex(6)}"
    logger.info(
        "instagram.publish STUB: would upload clip %s (caption=%r) -> external_post_id=%s",
        clip.id,
        (job.caption_text or "")[:60],
        fake_id,
    )
    return fake_id
