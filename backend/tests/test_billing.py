import pytest
import stripe

from app.exceptions import PaymentRequiredError
from app.models.billing import Subscription, SubscriptionStatus
from app.models.user import UserPlan
from app.services import billing_service

BASE = "/api/v1"


def test_subscription_overview_free_defaults(client, auth_headers):
    resp = client.get(f"{BASE}/billing/subscription", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["usage"]["minutes_limit"] == 30
    assert body["usage"]["over_limit"] is False


def test_checkout_session_short_circuits_to_active_pro(client, db, user, auth_headers):
    resp = client.post(
        f"{BASE}/billing/checkout-session", json={"plan": "pro"}, headers=auth_headers
    )
    assert resp.status_code == 200
    assert "checkout=success" in resp.json()["url"]

    db.refresh(user)
    assert user.plan == UserPlan.pro

    overview = client.get(f"{BASE}/billing/subscription", headers=auth_headers).json()
    assert overview["subscription"]["plan"] == "pro"
    assert overview["subscription"]["status"] == "active"
    assert overview["usage"]["minutes_limit"] == 1200


def test_portal_session_simulated(client, auth_headers):
    resp = client.post(f"{BASE}/billing/portal-session", headers=auth_headers)
    assert resp.status_code == 200
    assert "portal=simulated" in resp.json()["url"]


def test_check_usage_allows_processing_raises_402(db, user, make_source_video):
    make_source_video(user, status="ready", duration_seconds=40 * 60)  # 40 min > 30
    with pytest.raises(PaymentRequiredError):
        billing_service.check_usage_allows_processing(db, user)


def test_usage_limit_blocks_upload_endpoint(client, db, user, auth_headers, make_project, make_source_video):
    project = make_project(user)
    make_source_video(user, project=project, status="ready", duration_seconds=45 * 60)
    resp = client.post(
        f"{BASE}/projects/{project.id}/videos",
        files={"file": ("tiny.mp4", b"\x00\x00", "video/mp4")},
        headers=auth_headers,
    )
    assert resp.status_code == 402


def test_webhook_bad_signature_422(client):
    resp = client.post(
        f"{BASE}/billing/webhook",
        content=b'{"id": "evt_1", "type": "checkout.session.completed"}',
        headers={"stripe-signature": "t=1,v1=deadbeef"},
    )
    assert resp.status_code == 422


def test_webhook_checkout_completed_syncs_subscription(client, db, user, monkeypatch):
    event = {
        "id": "evt_checkout_1",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cus_123",
                "subscription": "sub_123",
                "metadata": {"user_id": str(user.id), "plan": "starter"},
            }
        },
    }
    monkeypatch.setattr(stripe.Webhook, "construct_event", lambda *a, **k: event)

    resp = client.post(
        f"{BASE}/billing/webhook",
        content=b"{}",
        headers={"stripe-signature": "whatever"},
    )
    assert resp.status_code == 200
    db.expire_all()
    sub = db.query(Subscription).filter(Subscription.user_id == user.id).one()
    assert sub.status == SubscriptionStatus.active
    assert sub.stripe_customer_id == "cus_123"
    db.refresh(user)
    assert user.plan == UserPlan.starter


def test_webhook_is_idempotent(client, user, monkeypatch):
    event = {
        "id": "evt_dupe_1",
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": "sub_9",
                "customer": "cus_9",
                "status": "active",
                "metadata": {"user_id": str(user.id), "plan": "pro"},
            }
        },
    }
    monkeypatch.setattr(stripe.Webhook, "construct_event", lambda *a, **k: event)
    first = client.post(f"{BASE}/billing/webhook", content=b"{}", headers={"stripe-signature": "x"})
    second = client.post(f"{BASE}/billing/webhook", content=b"{}", headers={"stripe-signature": "x"})
    assert first.status_code == second.status_code == 200
    assert second.json().get("duplicate") is True


def test_webhook_subscription_deleted_downgrades(client, db, user, monkeypatch):
    event = {
        "id": "evt_del_1",
        "type": "customer.subscription.deleted",
        "data": {
            "object": {
                "id": "sub_x",
                "customer": "cus_x",
                "metadata": {"user_id": str(user.id)},
            }
        },
    }
    monkeypatch.setattr(stripe.Webhook, "construct_event", lambda *a, **k: event)
    resp = client.post(f"{BASE}/billing/webhook", content=b"{}", headers={"stripe-signature": "x"})
    assert resp.status_code == 200
    db.expire_all()
    sub = db.query(Subscription).filter(Subscription.user_id == user.id).one()
    assert sub.status == SubscriptionStatus.canceled
