"""Library models: Tag, ClipTag, ClipVersion, DownloadBundle."""
import enum

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class DownloadBundleStatus(enum.Enum):
    queued = "queued"
    building = "building"
    ready = "ready"
    failed = "failed"


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(80), nullable=False)
    color = Column(String(20), nullable=True)

    user = relationship("User", back_populates="tags")
    clips = relationship(
        "Clip", secondary="clip_tags", back_populates="tags"
    )
    clip_tags = relationship(
        "ClipTag", back_populates="tag", cascade="all, delete-orphan",
        overlaps="tags,clips",
    )

    __table_args__ = (
        Index("ix_tags_user_name", "user_id", "name", unique=True),
    )


class ClipTag(Base):
    __tablename__ = "clip_tags"

    clip_id = Column(
        Integer,
        ForeignKey("clips.id", ondelete="CASCADE"),
        primary_key=True,
    )
    tag_id = Column(
        Integer,
        ForeignKey("tags.id", ondelete="CASCADE"),
        primary_key=True,
    )

    clip = relationship("Clip", back_populates="clip_tags", overlaps="tags,clips")
    tag = relationship("Tag", back_populates="clip_tags", overlaps="tags,clips")


class ClipVersion(Base):
    __tablename__ = "clip_versions"

    id = Column(Integer, primary_key=True, index=True)
    clip_id = Column(
        Integer,
        ForeignKey("clips.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_number = Column(Integer, nullable=False)
    snapshot = Column(JSONB, nullable=True)
    render_storage_key = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    clip = relationship("Clip", back_populates="versions")
    created_by_user = relationship("User", back_populates="clip_versions")


class DownloadBundle(Base):
    __tablename__ = "download_bundles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    clip_ids = Column(JSONB, nullable=True)
    status = Column(
        SAEnum(DownloadBundleStatus),
        default=DownloadBundleStatus.queued,
        nullable=False,
    )
    storage_key = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="download_bundles")
