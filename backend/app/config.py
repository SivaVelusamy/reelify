"""Application settings.

Full Settings class covering every variable in the PRP ENVIRONMENT VARIABLES block.
Every field has a safe default so the app imports without a .env file.
"""

import logging

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App
    APP_NAME: str = "Reelify"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/reelify"

    # Auth
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Redis / workers
    REDIS_URL: str = "redis://localhost:6379/0"

    # Object storage (S3-compatible)
    STORAGE_ENDPOINT: str = "http://localhost:9000"
    # Endpoint the *browser* must use to fetch presigned URLs. In Docker the
    # backend talks to "http://storage:9000" internally, but a download link
    # handed to the browser has to resolve from the host. Leave empty to reuse
    # STORAGE_ENDPOINT (correct for real S3 or a non-Docker MinIO).
    STORAGE_PUBLIC_ENDPOINT: str = ""
    STORAGE_BUCKET: str = "reelify-media"
    STORAGE_ACCESS_KEY: str = "minioadmin"
    STORAGE_SECRET_KEY: str = "minioadmin"
    STORAGE_REGION: str = "us-east-1"
    SIGNED_URL_TTL_SECONDS: int = 3600

    # Transcription
    TRANSCRIPTION_API_KEY: str = ""

    # Stripe
    STRIPE_SECRET_KEY: str = "sk_test_placeholder"
    STRIPE_WEBHOOK_SECRET: str = "whsec_placeholder"
    STRIPE_PRICE_ID_STARTER: str = "price_starter_placeholder"
    STRIPE_PRICE_ID_PRO: str = "price_pro_placeholder"

    # Email
    EMAIL_API_KEY: str = ""
    EMAIL_FROM: str = "notifications@reelify.app"

    # Social publishing OAuth
    TIKTOK_CLIENT_KEY: str = ""
    TIKTOK_CLIENT_SECRET: str = ""
    INSTAGRAM_CLIENT_ID: str = ""
    INSTAGRAM_CLIENT_SECRET: str = ""
    YOUTUBE_CLIENT_ID: str = ""
    YOUTUBE_CLIENT_SECRET: str = ""
    OAUTH_TOKEN_ENCRYPTION_KEY: str = "Gq3wmnLKWSalxoCL7KFcpg2KWx-ViZPoL_mfCLH84Kc="
    OAUTH_REDIRECT_BASE_URL: str = "http://localhost:8000/api/v1/social-accounts/callback"

    # Google OAuth (login)
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Frontend / CORS
    FRONTEND_URL: str = "http://localhost:3000"
    VITE_API_URL: str = "http://localhost:8000"
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )


# Values shipped in this file that must never reach production unchanged.
_INSECURE_DEFAULTS = {
    "SECRET_KEY": "your-secret-key-change-in-production",
    "OAUTH_TOKEN_ENCRYPTION_KEY": "Gq3wmnLKWSalxoCL7KFcpg2KWx-ViZPoL_mfCLH84Kc=",
}


def _check_production_secrets(s: "Settings") -> None:
    """Warn loudly (error-level when DEBUG is off) about template secrets in use."""
    offenders = [
        name for name, default in _INSECURE_DEFAULTS.items() if getattr(s, name) == default
    ]
    if not offenders:
        return
    log = logging.getLogger("reelify")
    msg = (
        "Insecure default value(s) still in use for %s. "
        "Set real values via environment before deploying."
    )
    if s.DEBUG:
        log.warning(msg, ", ".join(offenders))
    else:
        log.error(msg, ", ".join(offenders))


settings = Settings()
_check_production_secrets(settings)
