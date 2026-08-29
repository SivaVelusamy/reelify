"""Media delivery: stream storage objects through the backend so browser URLs
are always same-origin (no S3 subdomain / DNS / proxy setup required).

A media URL is ``<public base>/api/v1/media/<token>`` where the token is an
HMAC-signed, time-limited reference to a storage key.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time

from app.config import settings

_TOKEN_TTL = 12 * 3600  # 12h — long enough for a viewing session


def _b64e(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _b64d(txt: str) -> bytes:
    return base64.urlsafe_b64decode(txt + "=" * (-len(txt) % 4))


def _sign(payload: bytes) -> str:
    sig = hmac.new(settings.SECRET_KEY.encode(), payload, hashlib.sha256).digest()
    return _b64e(sig)


def sign_media_key(key: str, ttl: int = _TOKEN_TTL) -> str:
    body = json.dumps({"k": key, "exp": int(time.time()) + ttl}).encode()
    return f"{_b64e(body)}.{_sign(body)}"


def verify_media_token(token: str) -> str:
    try:
        body_b64, sig = token.split(".", 1)
        body = _b64d(body_b64)
        data = json.loads(body)
    except Exception:  # noqa: BLE001 - any parse failure is just an invalid token
        raise ValueError("Malformed media token") from None
    if not hmac.compare_digest(sig, _sign(body)):
        raise ValueError("Bad media token signature")
    if int(data.get("exp", 0)) < time.time():
        raise ValueError("Media token expired")
    return str(data["k"])
