"""Billing models: Subscription, UsageRecord."""
import enum

from sqlalchemy import (
    BigInteger,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import relationship

from app.database import Base
from app.models.base import TimestampMixin


class SubscriptionPlan(enum.Enum):
    free = "free"
    starter = "starter"
    pro = "pro"


class SubscriptionStatus(enum.Enum):
    active = "active"
    trialing = "trialing"
    past_due = "past_due"
    canceled = "canceled"
    incomplete = "incomplete"


class Subscription(Base, TimestampMixin):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    stripe_customer_id = Column(String(255), nullable=True, index=True)
    stripe_subscription_id = Column(String(255), nullable=True, index=True)
    plan = Column(
        SAEnum(SubscriptionPlan),
        default=SubscriptionPlan.free,
        nullable=False,
    )
    status = Column(
        SAEnum(SubscriptionStatus),
        default=SubscriptionStatus.active,
        nullable=False,
    )
    current_period_end = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="subscription")


class UsageRecord(Base):
    __tablename__ = "usage_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    minutes_processed = Column(Integer, default=0, nullable=False)
    clips_generated = Column(Integer, default=0, nullable=False)
    storage_bytes = Column(BigInteger, default=0, nullable=False)

    user = relationship("User", back_populates="usage_records")
