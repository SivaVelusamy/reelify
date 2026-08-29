"""Pydantic v2 schemas for the Projects / Uploads module."""

from datetime import datetime
from enum import Enum

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


def _enum_value(value: object) -> object:
    """Coerce a SQLAlchemy enum member to its plain string value."""
    return value.value if isinstance(value, Enum) else value


# ---------------------------------------------------------------------------
# Project
# ---------------------------------------------------------------------------
class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    campaign: str | None = Field(default=None, max_length=120)


class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    campaign: str | None = Field(default=None, max_length=120)


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    title: str
    description: str | None = None
    campaign: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ---------------------------------------------------------------------------
# Source video
# ---------------------------------------------------------------------------
class SourceVideoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: int
    user_id: int
    source_type: str
    original_url: str | None = None
    storage_key: str | None = None
    filename: str | None = None
    duration_seconds: float | None = None
    language: str | None = None
    status: str
    error_message: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    @field_validator("source_type", "status", mode="before")
    @classmethod
    def _coerce_enum(cls, value: object) -> object:
        return _enum_value(value)


class SourceVideoStatusResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: str
    error_message: str | None = None
    progress: int = 0

    @field_validator("status", mode="before")
    @classmethod
    def _coerce_enum(cls, value: object) -> object:
        return _enum_value(value)


class TranscriptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    language: str | None = None
    full_text: str | None = None
    segments: list[dict] = Field(default_factory=list)

    @field_validator("segments", mode="before")
    @classmethod
    def _default_segments(cls, value: object) -> object:
        return value or []


# ---------------------------------------------------------------------------
# Ingestion requests / batch
# ---------------------------------------------------------------------------
class YouTubeImportRequest(BaseModel):
    url: HttpUrl


class BatchUploadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    project_id: int
    status: str
    total_items: int
    completed_items: int
    created_at: datetime | None = None

    @field_validator("status", mode="before")
    @classmethod
    def _coerce_enum(cls, value: object) -> object:
        return _enum_value(value)
