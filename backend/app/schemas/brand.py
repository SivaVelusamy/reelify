"""Pydantic v2 schemas for Module 5 — Templates / Brand Kit."""

from datetime import datetime
from enum import Enum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ---------------------------------------------------------------------------
# Shared types
# ---------------------------------------------------------------------------
HEX_COLOR_PATTERN = r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"
HexColor = Annotated[str, Field(pattern=HEX_COLOR_PATTERN)]

WatermarkPosition = Literal[
    "top-left", "top-right", "bottom-left", "bottom-right", "center"
]
CaptionAnimationLiteral = Literal["none", "pop", "karaoke", "fade"]
CaptionPositionLiteral = Literal["top", "middle", "bottom"]
BackgroundStyleLiteral = Literal["none", "solid", "outline", "shadow"]


def _enum_value(value: object) -> object:
    """Coerce a SQLAlchemy enum member to its plain string value."""
    return value.value if isinstance(value, Enum) else value


# ---------------------------------------------------------------------------
# Brand kit
# ---------------------------------------------------------------------------
class BrandKitCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    is_default: bool = False
    primary_color: HexColor | None = None
    secondary_color: HexColor | None = None
    font_family: str | None = Field(default=None, max_length=120)
    watermark_position: WatermarkPosition | None = None


class BrandKitUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    is_default: bool | None = None
    primary_color: HexColor | None = None
    secondary_color: HexColor | None = None
    font_family: str | None = Field(default=None, max_length=120)
    watermark_position: WatermarkPosition | None = None


class BrandKitResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    name: str
    is_default: bool
    primary_color: str | None = None
    secondary_color: str | None = None
    font_family: str | None = None
    logo_storage_key: str | None = None
    logo_url: str | None = None
    watermark_position: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


# ---------------------------------------------------------------------------
# Caption style preset
# ---------------------------------------------------------------------------
class CaptionStylePresetCreate(BaseModel):
    brand_kit_id: int | None = None
    name: str = Field(min_length=1, max_length=120)
    font_family: str | None = Field(default=None, max_length=120)
    font_size: int | None = Field(default=None, ge=1, le=400)
    text_color: HexColor | None = None
    highlight_color: HexColor | None = None
    background_style: BackgroundStyleLiteral | None = None
    animation: CaptionAnimationLiteral = "none"
    position: CaptionPositionLiteral | None = None


class CaptionStylePresetUpdate(BaseModel):
    brand_kit_id: int | None = None
    name: str | None = Field(default=None, min_length=1, max_length=120)
    font_family: str | None = Field(default=None, max_length=120)
    font_size: int | None = Field(default=None, ge=1, le=400)
    text_color: HexColor | None = None
    highlight_color: HexColor | None = None
    background_style: BackgroundStyleLiteral | None = None
    animation: CaptionAnimationLiteral | None = None
    position: CaptionPositionLiteral | None = None


class CaptionStylePresetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    brand_kit_id: int | None = None
    name: str
    font_family: str | None = None
    font_size: int | None = None
    text_color: str | None = None
    highlight_color: str | None = None
    background_style: str | None = None
    animation: CaptionAnimationLiteral
    position: str | None = None
    created_at: datetime | None = None

    @field_validator("animation", mode="before")
    @classmethod
    def _coerce_animation(cls, value: object) -> object:
        return _enum_value(value)
