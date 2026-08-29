"""Module 7 — Billing (Stripe) API.

Mounted under ``/api/v1`` by ``app.main``. Every route requires an authenticated
active user except ``POST /billing/webhook``, which is called by Stripe and is
protected instead by ``Stripe-Signature`` verification inside
``billing_service.handle_webhook``.
"""

import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.billing import (
    BillingOverview,
    CheckoutSessionRequest,
    CheckoutSessionResponse,
    PortalSessionResponse,
)
from app.services import billing_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["billing"])


@router.post("/billing/checkout-session", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    payload: CheckoutSessionRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> CheckoutSessionResponse:
    url = billing_service.create_checkout_session(db, user, payload.plan)
    return CheckoutSessionResponse(url=url)


@router.post("/billing/portal-session", response_model=PortalSessionResponse)
async def create_portal_session(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> PortalSessionResponse:
    url = billing_service.create_portal_session(db, user)
    return PortalSessionResponse(url=url)


@router.get("/billing/subscription", response_model=BillingOverview)
async def get_subscription(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> BillingOverview:
    return billing_service.get_overview(db, user)


@router.post("/billing/webhook")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
) -> dict:
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    return billing_service.handle_webhook(db, payload, sig_header)
