"""Publishing models: SocialAccount, PublishJob, ShareLink."""
import enum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.base import TimestampMixin


class SocialPlatform(enum.Enum):
    tiktok = "tiktok"
    instagram = "instagram"
    youtube = "youtube"
    slack = "slack"
    teams = "teams"


class SocialAccountStatus(enum.Enum):
    connected = "connected"
    expired = "expired"
    revoked = "revoked"


class PublishDestinationType(enum.Enum):
    social = "social"
    slack = "slack"
    teams = "teams"
    link = "link"


class PublishJobStatus(enum.Enum):
    draft = "draft"
    scheduled = "scheduled"
    publishing = "publishing"
    published = "published"
    failed = "failed"


class SocialAccount(Base):
    __tablename__ = "social_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    platform = Column(SAEnum(SocialPlatform), nullable=False)
    external_account_id = Column(String(255), nullable=True)
    display_name = Column(String(255), nullable=True)
    access_token_encrypted = Column(Text, nullable=True)
    refresh_token_encrypted = Column(Text, nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(
        SAEnum(SocialAccountStatus),
        default=SocialAccountStatus.connected,
        nullable=False,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="social_accounts")
    publish_jobs = relationship(
        "PublishJob", back_populates="social_account"
    )

    __table_args__ = (
        Index("ix_social_accounts_user_platform", "user_id", "platform"),
    )


class PublishJob(Base, TimestampMixin):
    __tablename__ = "publish_jobs"

    id = Column(Integer, primary_key=True, index=True)
    clip_id = Column(
        Integer,
        ForeignKey("clips.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    social_account_id = Column(
        Integer,
        ForeignKey("social_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    destination_type = Column(SAEnum(PublishDestinationType), nullable=False)
    caption_text = Column(Text, nullable=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(
        SAEnum(PublishJobStatus),
        default=PublishJobStatus.draft,
        nullable=False,
    )
    external_post_id = Column(String(255), nullable=True)
    error_message = Column(Text, nullable=True)

    clip = relationship("Clip", back_populates="publish_jobs")
    user = relationship("User", back_populates="publish_jobs")
    social_account = relationship(
        "SocialAccount", back_populates="publish_jobs"
    )

    __table_args__ = (
        Index("ix_publish_jobs_status_scheduled_at", "status", "scheduled_at"),
    )


class ShareLink(Base):
    __tablename__ = "share_links"

    id = Column(Integer, primary_key=True, index=True)
    clip_id = Column(
        Integer,
        ForeignKey("clips.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    slug = Column(String(64), nullable=False, unique=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    view_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    clip = relationship("Clip", back_populates="share_links")
    user = relationship("User", back_populates="share_links")
