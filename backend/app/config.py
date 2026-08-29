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
    # Provider: "auto" (OpenAI if a key is set, else local Whisper, else stub) |
    # "openai" | "whisper" (local faster-whisper) | "stub".
    TRANSCRIPTION_PROVIDER: str = "auto"
    TRANSCRIPTION_API_KEY: str = ""  # OpenAI (or compatible) API key
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_TRANSCRIBE_MODEL: str = "whisper-1"
    # Local faster-whisper settings (used by the "whisper" / "auto" providers).
    # "tiny" is the scaffold default — fast on CPU; bump to base/small/medium
    # for better accuracy if the worker has the CPU/RAM headroom.
    WHISPER_MODEL: str = "tiny"  # tiny | base | small | medium | large-v3
    WHISPER_DEVICE: str = "cpu"
    WHISPER_COMPUTE_TYPE: str = "int8"

    # YouTube ingest — downloader.
    # cobalt (https://cobalt.tools) is tried first when COBALT_API_URL is set;
    # yt-dlp is the fallback (and the only path when it's empty).
    COBALT_API_URL: str = ""  # e.g. http://cobalt:9000
    COBALT_API_KEY: str = ""  # only if the instance requires Api-Key auth
    COBALT_VIDEO_QUALITY: str = "1080"  # 144 .. "max"

    # yt-dlp fallback. Netscape-format cookies.txt from a logged-in browser
    # session lets it fetch age-restricted / bot-flagged videos.
    YT_DLP_COOKIES_FILE: str = ""
    YT_DLP_MAX_HEIGHT: int = 1080
    # yt-dlp's JS-challenge solver — fetches code at runtime, so opt-in
    # (e.g. "ejs:github").
    YT_DLP_REMOTE_COMPONENTS: str = ""

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
    # Canonical public origin of the deployed app, e.g. https://reelify.example.com.
    # Set this on a real deployment — share links, OAuth redirects and Stripe
    # return URLs are built from it. Empty -> derive from the request (behind a
    # trusted proxy) or fall back to FRONTEND_URL.
    PUBLIC_BASE_URL: str = ""
    # Trust X-Forwarded-Proto / X-Forwarded-Host from the reverse proxy.
    TRUST_PROXY_HEADERS: bool = True
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
