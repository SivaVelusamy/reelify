"""Signed, short-lived OAuth ``state`` tokens for the social-account connect flow.

The state protects the OAuth callback against CSRF and ties the returned
authorization ``code`` back to the user who started the flow. It is a signed
(HMAC-SHA256 over ``settings.SECRET_KEY``) base64url blob carrying
``{user_id, platform, ts}`` and is rejected after ``STATE_TTL_SECONDS``.

No server-side storage is required: the signature + timestamp are self-contained.
"""

import base64
import hashlib
import hmac
import json
import time

from app.config import settings
from app.exceptions import ValidationError

STATE_TTL_SECONDS = 600  # 10 minutes


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64d(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def _sign(payload: str) -> str:
    digest = hmac.new(
        settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256
    ).digest()
    return _b64e(digest)


def issue_state(user_id: int, platform: str) -> str:
    """Return a signed state token for ``user_id`` starting a connect to ``platform``."""
    body = {"user_id": int(user_id), "platform": platform, "ts": int(time.time())}
    payload = _b64e(json.dumps(body, separators=(",", ":")).encode())
    return f"{payload}.{_sign(payload)}"


def verify_state(state: str, platform: str) -> dict:
    """Validate signature, TTL and platform. Return the decoded body or raise.

    Raises :class:`ValidationError` (HTTP 400) on any tamper / expiry / mismatch.
    """
    try:
        payload, signature = state.rsplit(".", 1)
    except ValueError as exc:
        raise ValidationError("Malformed OAuth state") from exc

    expected = _sign(payload)
    if not hmac.compare_digest(signature, expected):
        raise ValidationError("OAuth state signature mismatch")

    try:
        body = json.loads(_b64d(payload))
    except (ValueError, TypeError) as exc:
        raise ValidationError("Undecodable OAuth state") from exc

    if int(time.time()) - int(body.get("ts", 0)) > STATE_TTL_SECONDS:
        raise ValidationError("OAuth state has expired; restart the connect flow")

    if body.get("platform") != platform:
        raise ValidationError("OAuth state platform mismatch")

    return body
