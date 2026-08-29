"""Pydantic v2 schemas for Module 8 (Publishing / Distribution).

Token material (access/refresh tokens) is never exposed through any response
schema in this module.
"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.models.publishing import (
    PublishDestinationType,
    PublishJobStatus,
    SocialAccountStatus,
    SocialPlatform,
)
from app.public_url import public_base_url


class SocialAccountResponse(BaseModel):
    """A connected destination. Deliberately omits every *_token_encrypted field."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    platform: SocialPlatform
    external_account_id: str | None = None
    display_name: str | None = None
    status: SocialAccountStatus
    token_expires_at: datetime | None = None
    created_at: datetime | None = None


class ConnectStartResponse(BaseModel):
    """Returned by POST /social-accounts/connect/{platform}."""

    auth_url: str
    state: str


class PublishRequest(BaseModel):
    """Body of POST /clips/{id}/publish.

    ``scheduled_at`` null (or in the past) => publish immediately.
    ``slack_webhook_url`` is required for destination_type slack/teams and is
    stored encrypted on a SocialAccount row; it is never returned.
    """

    destination_type: PublishDestinationType
    social_account_id: int | None = None
    slack_webhook_url: str | None = None
    caption_text: str | None = Field(default=None, max_length=5000)
    scheduled_at: datetime | None = None


class PublishJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    clip_id: int
    user_id: int
    social_account_id: int | None = None
    destination_type: PublishDestinationType
    caption_text: str | None = None
    scheduled_at: datetime | None = None
    published_at: datetime | None = None
    status: PublishJobStatus
    external_post_id: str | None = None
    error_message: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @computed_field  # type: ignore[prop-decorator]
    @property
    def share_url(self) -> str | None:
        """Public URL for a completed `link` job (external_post_id is the slug)."""
        if (
            self.destination_type == PublishDestinationType.link
            and self.external_post_id
        ):
            return f"{public_base_url()}/s/{self.external_post_id}"
        return None


class PublishJobUpdate(BaseModel):
    """Reschedule / edit a job that is still draft or scheduled."""

    scheduled_at: datetime | None = None
    caption_text: str | None = Field(default=None, max_length=5000)


class CalendarEntry(BaseModel):
    """One chip on the publish calendar."""

    id: int
    clip_id: int
    title: str | None = None
    platform: str
    scheduled_at: datetime | None = None
    status: PublishJobStatus


class ShareLinkCreate(BaseModel):
    expires_at: datetime | None = None


class ShareLinkResponse(BaseModel):
    url: str
    slug: str
    is_active: bool
    expires_at: datetime | None = None
    view_count: int


class PublicClipResponse(BaseModel):
    """Unauthenticated payload for GET /s/{slug}."""

    title: str | None = None
    video_url: str
    duration: float
