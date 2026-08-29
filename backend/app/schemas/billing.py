"""Pydantic v2 schemas for Module 7 (Billing / Stripe)."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class CheckoutSessionRequest(BaseModel):
    plan: Literal["starter", "pro"]


class CheckoutSessionResponse(BaseModel):
    url: str


class PortalSessionResponse(BaseModel):
    url: str


class SubscriptionResponse(BaseModel):
    plan: str
    status: str
    current_period_end: datetime | None = None
    cancel_at_period_end: bool | None = None


class UsageResponse(BaseModel):
    minutes_processed: int
    clips_generated: int
    storage_bytes: int
    minutes_limit: int
    over_limit: bool


class BillingOverview(BaseModel):
    subscription: SubscriptionResponse | None = None
    usage: UsageResponse
