"""Pydantic v2 schemas for the clips module (Module 3)."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.clip import (
    AspectRatio,
    ClipExportPreset,
    ClipExportStatus,
    ClipStatus,
    ReframeMode,
)


class _StartEndValidatorMixin:
    """Shared model_validator: start_seconds must be < end_seconds when both are set."""

    @model_validator(mode="after")
    def _validate_bounds(self):
        start = getattr(self, "start_seconds", None)
        end = getattr(self, "end_seconds", None)
        if start is not None and end is not None and start >= end:
            raise ValueError("start_seconds must be less than end_seconds")
        return self


class ClipResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_video_id: int
    user_id: int
    project_id: int
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


class ClipCandidateResponse(BaseModel):
    """Ranked clip candidate — explicitly surfaces score + rank for the candidates list."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    source_video_id: int
    project_id: int
    title: str | None = None
    start_seconds: float
    end_seconds: float
    score: float | None = None
    rank: int | None = None
    status: ClipStatus
    aspect_ratio: AspectRatio


class ManualClipCreate(_StartEndValidatorMixin, BaseModel):
    start_seconds: float = Field(ge=0)
    end_seconds: float = Field(gt=0)
    title: str | None = Field(default=None, max_length=300)


class ClipUpdate(_StartEndValidatorMixin, BaseModel):
    start_seconds: float | None = Field(default=None, ge=0)
    end_seconds: float | None = Field(default=None, gt=0)
    title: str | None = Field(default=None, max_length=300)
    aspect_ratio: AspectRatio | None = None
    reframe_mode: ReframeMode | None = None
    crop_config: dict[str, Any] | None = None
    status: ClipStatus | None = None


class CaptionUpdate(BaseModel):
    segments: list[dict[str, Any]]
    style_preset_id: int | None = None
    style_overrides: dict[str, Any] | None = None


class CaptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    clip_id: int
    segments: list[dict[str, Any]] | None = None
    style_preset_id: int | None = None
    style_overrides: dict[str, Any] | None = None


class RenderResponse(BaseModel):
    """Returned by POST /clips/{id}/render — async render job handle + clip status."""

    job_id: str | None = None
    clip_id: int
    status: ClipStatus


class PreviewResponse(BaseModel):
    clip_id: int
    preview_url: str
    expires_in: int


class ExportCreate(BaseModel):
    preset: ClipExportPreset
    # Constrained so values can be safely used in storage keys / content types.
    resolution: str | None = Field(default=None, pattern=r"^\d{3,4}x\d{3,4}$")
    format: Literal["mp4", "mov", "webm"] | None = None


class ClipExportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    clip_id: int
    preset: ClipExportPreset
    resolution: str | None = None
    format: str | None = None
    storage_key: str | None = None
    status: ClipExportStatus
    created_at: datetime | None = None
    download_url: str | None = None
