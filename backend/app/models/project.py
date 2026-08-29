"""Project / upload models: Project, SourceVideo, Transcript, BatchUpload."""
import enum

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.base import TimestampMixin


class SourceType(enum.Enum):
    upload = "upload"
    youtube_url = "youtube_url"


class SourceVideoStatus(enum.Enum):
    queued = "queued"
    transcribing = "transcribing"
    analyzing = "analyzing"
    clipping = "clipping"
    ready = "ready"
    failed = "failed"


class BatchUploadStatus(enum.Enum):
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    campaign = Column(String(120), nullable=True)

    user = relationship("User", back_populates="projects")
    source_videos = relationship(
        "SourceVideo", back_populates="project", cascade="all, delete-orphan"
    )
    batch_uploads = relationship(
        "BatchUpload", back_populates="project", cascade="all, delete-orphan"
    )
    clips = relationship(
        "Clip", back_populates="project", cascade="all, delete-orphan"
    )


class SourceVideo(Base, TimestampMixin):
    __tablename__ = "source_videos"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    source_type = Column(SAEnum(SourceType), nullable=False)
    original_url = Column(String(1000), nullable=True)
    storage_key = Column(String(500), nullable=True)
    filename = Column(String(500), nullable=True)
    duration_seconds = Column(Float, nullable=True)
    language = Column(String(20), nullable=True)
    status = Column(
        SAEnum(SourceVideoStatus),
        default=SourceVideoStatus.queued,
        nullable=False,
    )
    error_message = Column(Text, nullable=True)

    project = relationship("Project", back_populates="source_videos")
    user = relationship("User", back_populates="source_videos")
    transcript = relationship(
        "Transcript",
        back_populates="source_video",
        uselist=False,
        cascade="all, delete-orphan",
    )
    clips = relationship(
        "Clip", back_populates="source_video", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_source_videos_user_status", "user_id", "status"),
    )


class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(Integer, primary_key=True, index=True)
    source_video_id = Column(
        Integer,
        ForeignKey("source_videos.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    language = Column(String(20), nullable=True)
    full_text = Column(Text, nullable=True)
    segments = Column(JSONB, nullable=True)
    search_vector = Column(TSVECTOR, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    source_video = relationship("SourceVideo", back_populates="transcript")

    __table_args__ = (
        Index(
            "ix_transcripts_search_vector",
            "search_vector",
            postgresql_using="gin",
        ),
    )


class BatchUpload(Base):
    __tablename__ = "batch_uploads"

    id = Column(Integer, primary_key=True, index=True)
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
    status = Column(
        SAEnum(BatchUploadStatus),
        default=BatchUploadStatus.queued,
        nullable=False,
    )
    total_items = Column(Integer, default=0, nullable=False)
    completed_items = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="batch_uploads")
    project = relationship("Project", back_populates="batch_uploads")
