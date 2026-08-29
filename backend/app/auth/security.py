"""Fernet encryption helpers for OAuth tokens stored at rest.

Uses settings.OAUTH_TOKEN_ENCRYPTION_KEY (a urlsafe-base64 32-byte Fernet key).
"""

import logging

from cryptography.fernet import Fernet

from app.config import settings

logger = logging.getLogger("reelify")


def _load_fernet() -> Fernet:
    try:
        return Fernet(settings.OAUTH_TOKEN_ENCRYPTION_KEY.encode())
    except (ValueError, TypeError):
        logger.error(
            "OAUTH_TOKEN_ENCRYPTION_KEY is not a valid Fernet key; generating an "
            "ephemeral key for this process. Connected-account tokens will not "
            "survive a restart until a real key is configured."
        )
        return Fernet(Fernet.generate_key())


_fernet = _load_fernet()


def encrypt_token(plain: str) -> str:
    return _fernet.encrypt(plain.encode()).decode()


def decrypt_token(enc: str) -> str:
    return _fernet.decrypt(enc.encode()).decode()
