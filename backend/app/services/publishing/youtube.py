"""YouTube publish adapter (YouTube Data API v3 via Google OAuth 2.0).

OAuth: https://accounts.google.com/o/oauth2/v2/auth (offline access for a
refresh token). Publish: resumable upload to
`POST https://www.googleapis.com/upload/youtube/v3/videos`. ``publish()`` is a STUB.
"""

import logging
import secrets
from urllib.parse import urlencode

import httpx

from app.config import settings
from app.services.publishing.base import use_stub_tokens

logger = logging.getLogger(__name__)

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
SCOPES = "https://www.googleapis.com/auth/youtube.upload"
_HTTP_TIMEOUT = 15.0


def redirect_uri() -> str:
    return f"{settings.OAUTH_REDIRECT_BASE_URL}/youtube"


def build_auth_url(state: str) -> str:
    params = {
        "client_id": settings.YOUTUBE_CLIENT_ID,
        "redirect_uri": redirect_uri(),
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return f"{AUTHORIZE_URL}?{urlencode(params)}"


def exchange_code(code: str) -> dict:
    if use_stub_tokens(code, settings.YOUTUBE_CLIENT_ID):
        logger.info("youtube.exchange_code: simulated / unconfigured — STUB tokens")
        return {
            "access_token": f"stub-youtube-access-{secrets.token_hex(8)}",
            "refresh_token": f"stub-youtube-refresh-{secrets.token_hex(8)}",
            "expires_in": 3600,
            "scope": SCOPES,
            "user_id": f"yt-sim-{secrets.token_hex(4)}",
        }

    with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
        resp = client.post(
            TOKEN_URL,
            data={
                "client_id": settings.YOUTUBE_CLIENT_ID,
                "client_secret": settings.YOUTUBE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri(),
            },
        )
        resp.raise_for_status()
        return resp.json()


def publish(job, clip, account_or_webhook) -> str:
    """STUB upload to YouTube.

    Real flow (resumable upload):
      1. POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable
         &part=snippet,status
         headers: Authorization: Bearer <access_token>
         json: {"snippet": {"title": job.caption_text or clip.title,
                            "description": job.caption_text},
                "status": {"privacyStatus": "private", "selfDeclaredMadeForKids": False}}
         -> 200 with `Location` header = upload session URL
      2. PUT <session URL> with the video bytes (streamed from the presigned clip URL)
         -> {"id": "<videoId>"}
    """
    fake_id = f"youtube-stub-{job.id}-{secrets.token_hex(6)}"
    logger.info(
        "youtube.publish STUB: would upload clip %s (caption=%r) -> external_post_id=%s",
        clip.id,
        (job.caption_text or "")[:60],
        fake_id,
    )
    return fake_id
