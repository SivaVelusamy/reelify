"""Clip models: Clip, Caption, ClipExport."""
import enum

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.base import TimestampMixin


class ClipStatus(enum.Enum):
    suggested = "suggested"
    draft = "draft"
    rendered = "rendered"
    archived = "archived"


class AspectRatio(enum.Enum):
    vertical = "9:16"
    square = "1:1"
    wide = "16:9"


class ReframeMode(enum.Enum):
    auto = "auto"
    manual = "manual"


class ClipExportPreset(enum.Enum):
    tiktok = "tiktok"
    reels = "reels"
    shorts = "shorts"
    custom = "custom"


class ClipExportStatus(enum.Enum):
    queued = "queued"
    rendering = "rendering"
    ready = "ready"
    failed = "failed"


class Clip(Base, TimestampMixin):
    __tablename__ = "clips"

    id = Column(Integer, primary_key=True, index=True)
    source_video_id = Column(
        Integer,
        ForeignKey("source_videos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id = Column(
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(300), nullable=True)
    start_seconds = Column(Float, nullable=False)
    end_seconds = Column(Float, nullable=False)
    score = Column(Float, nullable=True)
    rank = Column(Integer, nullable=True)
    status = Column(SAEnum(ClipStatus), default=ClipStatus.suggested, nullable=False)
    aspect_ratio = Column(
        SAEnum(AspectRatio), default=AspectRatio.vertical, nullable=False
    )
    reframe_mode = Column(
        SAEnum(ReframeMode), default=ReframeMode.auto, nullable=False
    )
    crop_config = Column(JSONB, nullable=True)
    render_storage_key = Column(String(500), nullable=True)
    search_vector = Column(TSVECTOR, nullable=True)

    source_video = relationship("SourceVideo", back_populates="clips")
    user = relationship("User", back_populates="clips")
    project = relationship("Project", back_populates="clips")
    caption = relationship(
        "Caption",
        back_populates="clip",
        uselist=False,
        cascade="all, delete-orphan",
    )
    exports = relationship(
        "ClipExport", back_populates="clip", cascade="all, delete-orphan"
    )
    versions = relationship(
        "ClipVersion", back_populates="clip", cascade="all, delete-orphan"
    )
    tags = relationship(
        "Tag", secondary="clip_tags", back_populates="clips"
    )
    # Association-object view of the same rows as `tags`; read-only to avoid
    # write-path conflicts with the secondary relationship above.
    clip_tags = relationship(
        "ClipTag", back_populates="clip", cascade="all, delete-orphan",
        overlaps="tags,clips",
    )
    publish_jobs = relationship(
        "PublishJob", back_populates="clip", cascade="all, delete-orphan"
    )
    share_links = relationship(
        "ShareLink", back_populates="clip", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_clips_source_video_rank", "source_video_id", "rank"),
        Index("ix_clips_user_status", "user_id", "status"),
        Index(
            "ix_clips_search_vector",
            "search_vector",
            postgresql_using="gin",
        ),
    )


class Caption(Base):
    __tablename__ = "captions"

    id = Column(Integer, primary_key=True, index=True)
    clip_id = Column(
        Integer,
        ForeignKey("clips.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    segments = Column(JSONB, nullable=True)
    style_preset_id = Column(
        Integer,
        ForeignKey("caption_style_presets.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    style_overrides = Column(JSONB, nullable=True)

    clip = relationship("Clip", back_populates="caption")
    style_preset = relationship(
        "CaptionStylePreset", back_populates="captions"
    )


class ClipExport(Base):
    __tablename__ = "clip_exports"

    id = Column(Integer, primary_key=True, index=True)
    clip_id = Column(
        Integer,
        ForeignKey("clips.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    preset = Column(SAEnum(ClipExportPreset), nullable=False)
    resolution = Column(String(20), nullable=True)
    format = Column(String(20), nullable=True)
    storage_key = Column(String(500), nullable=True)
    status = Column(
        SAEnum(ClipExportStatus),
        default=ClipExportStatus.queued,
        nullable=False,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    clip = relationship("Clip", back_populates="exports")
