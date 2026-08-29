"""Brand kit models: BrandKit, CaptionStylePreset."""
import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.base import TimestampMixin


class CaptionAnimation(enum.Enum):
    none = "none"
    pop = "pop"
    karaoke = "karaoke"
    fade = "fade"


class BrandKit(Base, TimestampMixin):
    __tablename__ = "brand_kits"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(120), nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)
    primary_color = Column(String(20), nullable=True)
    secondary_color = Column(String(20), nullable=True)
    font_family = Column(String(120), nullable=True)
    logo_storage_key = Column(String(500), nullable=True)
    watermark_position = Column(String(30), nullable=True)

    user = relationship("User", back_populates="brand_kits")
    caption_style_presets = relationship(
        "CaptionStylePreset",
        back_populates="brand_kit",
        cascade="all, delete-orphan",
    )


class CaptionStylePreset(Base):
    __tablename__ = "caption_style_presets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    brand_kit_id = Column(
        Integer,
        ForeignKey("brand_kits.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    name = Column(String(120), nullable=False)
    font_family = Column(String(120), nullable=True)
    font_size = Column(Integer, nullable=True)
    text_color = Column(String(20), nullable=True)
    highlight_color = Column(String(20), nullable=True)
    background_style = Column(String(50), nullable=True)
    animation = Column(
        SAEnum(CaptionAnimation),
        default=CaptionAnimation.none,
        nullable=False,
    )
    position = Column(String(30), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="caption_style_presets")
    brand_kit = relationship(
        "BrandKit", back_populates="caption_style_presets"
    )
    captions = relationship("Caption", back_populates="style_preset")
