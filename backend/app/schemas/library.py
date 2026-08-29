"""Pydantic v2 schemas for Module 4 (Library / Assets)."""

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.clip import AspectRatio, ClipStatus, ReframeMode


def _enum_value(value: object) -> object:
    return value.value if isinstance(value, Enum) else value


# ---------------------------------------------------------------------------
# Clip listing / filtering
# ---------------------------------------------------------------------------
class LibraryClipQuery(BaseModel):
    """Query-string filter model for ``GET /library/clips``."""

    project_id: int | None = None
    tag_id: int | None = None
    campaign: str | None = None
    status: ClipStatus | None = None
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=20, ge=1, le=100)


class TagResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    color: str | None = None


class LibraryClipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_video_id: int
    user_id: int
    project_id: int
    project_title: str | None = None
    title: str | None = None
    start_seconds: float
    end_seconds: float
    score: float | None = None
    rank: int | None = None
    status: ClipStatus
    aspect_ratio: AspectRatio
    reframe_mode: ReframeMode
    crop_config: dict[str, Any] | None = None
    render_storage_key: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    tags: list[TagResponse] = Field(default_factory=list)

    @field_validator("status", "aspect_ratio", "reframe_mode", mode="before")
    @classmethod
    def _coerce_enum(cls, value: object) -> object:
        return _enum_value(value)


class PaginatedClips(BaseModel):
    items: list[LibraryClipResponse]
    total: int
    page: int
    per_page: int
    pages: int


# ---------------------------------------------------------------------------
# Full-text search
# ---------------------------------------------------------------------------
class SearchHit(BaseModel):
    clip_id: int
    title: str | None = None
    snippet: str
    matched_in: Literal["transcript", "title"]
    rank: float


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------
class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    color: str | None = Field(default=None, max_length=20)


class ClipTagsUpdate(BaseModel):
    """Attach (default) or detach a set of tag ids on a clip."""

    tag_ids: list[int] = Field(min_length=1)
    detach: bool = False


# ---------------------------------------------------------------------------
# Version history
# ---------------------------------------------------------------------------
class ClipVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    clip_id: int
    version_number: int
    snapshot: dict[str, Any] | None = None
    render_storage_key: str | None = None
    created_at: datetime | None = None
    created_by: int | None = None


# ---------------------------------------------------------------------------
# Download bundles
# ---------------------------------------------------------------------------
class BundleCreate(BaseModel):
    clip_ids: list[int] = Field(min_length=1)


class BundleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    clip_ids: list[int] = Field(default_factory=list)
    status: str
    storage_key: str | None = None
    download_url: str | None = None
    created_at: datetime | None = None

    @field_validator("status", mode="before")
    @classmethod
    def _coerce_status(cls, value: object) -> object:
        return _enum_value(value)

    @field_validator("clip_ids", mode="before")
    @classmethod
    def _default_clip_ids(cls, value: object) -> object:
        return value or []
