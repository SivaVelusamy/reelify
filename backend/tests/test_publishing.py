from datetime import UTC, datetime, timedelta

from app.models.publishing import PublishJob, PublishJobStatus, ShareLink
from app.services.oauth_state import issue_state

BASE = "/api/v1"


def test_connect_returns_auth_url_and_state(client, auth_headers):
    resp = client.post(f"{BASE}/social-accounts/connect/tiktok", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["auth_url"].startswith("https://")
    assert body["state"]


def test_connect_unknown_platform_422(client, auth_headers):
    resp = client.post(f"{BASE}/social-accounts/connect/myspace", headers=auth_headers)
    assert resp.status_code == 422


def test_oauth_callback_tampered_state_rejected(client):
    resp = client.get(
        f"{BASE}/social-accounts/callback/tiktok",
        params={"code": "abc", "state": "tampered.signature"},
        follow_redirects=False,
    )
    assert resp.status_code == 422


def test_oauth_callback_valid_state_connects(client, db, user):
    state = issue_state(user.id, "tiktok")
    resp = client.get(
        f"{BASE}/social-accounts/callback/tiktok",
        params={"code": "abc", "state": state},
        follow_redirects=False,
    )
    assert resp.status_code == 302
    accounts = db.query(PublishJob).count()  # noqa: F841 - just exercising session
    from app.models.publishing import SocialAccount

    assert db.query(SocialAccount).filter(SocialAccount.user_id == user.id).count() == 1


def test_share_link_view_count_and_expiry(client, db, make_clip, user, auth_headers):
    clip = make_clip(user, status="rendered")
    created = client.post(f"{BASE}/clips/{clip.id}/share-link", headers=auth_headers)
    assert created.status_code == 201
    slug = created.json()["slug"]

    first = client.get(f"{BASE}/s/{slug}")
    assert first.status_code == 200
    assert first.json()["video_url"].startswith("https://")

    client.get(f"{BASE}/s/{slug}")
    link = db.query(ShareLink).filter(ShareLink.slug == slug).one()
    db.refresh(link)
    assert link.view_count >= 2

    link.expires_at = datetime.now(UTC) - timedelta(hours=1)
    db.commit()
    assert client.get(f"{BASE}/s/{slug}").status_code == 404


def test_publish_now_link_creates_job(client, make_clip, user, auth_headers):
    clip = make_clip(user, status="rendered")
    resp = client.post(
        f"{BASE}/clips/{clip.id}/publish",
        json={"destination_type": "link"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "publishing"


def test_publish_scheduled_future(client, make_clip, user, auth_headers):
    clip = make_clip(user, status="rendered")
    future = (datetime.now(UTC) + timedelta(days=2)).isoformat()
    resp = client.post(
        f"{BASE}/clips/{clip.id}/publish",
        json={"destination_type": "link", "scheduled_at": future},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "scheduled"


def test_publish_requires_rendered_clip(client, make_clip, user, auth_headers):
    clip = make_clip(user, status="draft", render_storage_key=None)
    resp = client.post(
        f"{BASE}/clips/{clip.id}/publish",
        json={"destination_type": "link"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_update_and_delete_only_on_editable_jobs(client, db, make_clip, user, auth_headers):
    clip = make_clip(user, status="rendered")
    future = datetime.now(UTC) + timedelta(days=3)
    job = PublishJob(
        clip_id=clip.id,
        user_id=user.id,
        destination_type="link",
        status=PublishJobStatus.scheduled,
        scheduled_at=future,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    new_time = (datetime.now(UTC) + timedelta(days=5)).isoformat()
    ok = client.put(
        f"{BASE}/publish-jobs/{job.id}",
        json={"scheduled_at": new_time, "caption_text": "edited"},
        headers=auth_headers,
    )
    assert ok.status_code == 200

    job.status = PublishJobStatus.published
    db.commit()
    blocked = client.put(
        f"{BASE}/publish-jobs/{job.id}",
        json={"caption_text": "nope"},
        headers=auth_headers,
    )
    assert blocked.status_code == 422
    assert client.delete(f"{BASE}/publish-jobs/{job.id}", headers=auth_headers).status_code == 422


def test_publish_to_slack_webhook_creates_account(client, db, make_clip, user, auth_headers):
    clip = make_clip(user, status="rendered")
    resp = client.post(
        f"{BASE}/clips/{clip.id}/publish",
        json={
            "destination_type": "slack",
            "slack_webhook_url": "https://hooks.slack.com/services/T/B/xyz",
            "caption_text": "ship it",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    from app.models.publishing import SocialAccount

    assert (
        db.query(SocialAccount)
        .filter(SocialAccount.user_id == user.id)
        .count()
        == 1
    )


def test_publish_slack_requires_webhook_url(client, make_clip, user, auth_headers):
    clip = make_clip(user, status="rendered")
    resp = client.post(
        f"{BASE}/clips/{clip.id}/publish",
        json={"destination_type": "slack"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_list_and_calendar_and_cancel_jobs(client, db, make_clip, user, auth_headers):
    clip = make_clip(user, status="rendered")
    future = datetime.now(UTC) + timedelta(days=1)
    job = PublishJob(
        clip_id=clip.id, user_id=user.id, destination_type="link",
        status=PublishJobStatus.scheduled, scheduled_at=future,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    listed = client.get(
        f"{BASE}/publish-jobs", params={"status": "scheduled"}, headers=auth_headers
    )
    assert listed.status_code == 200
    assert [j["id"] for j in listed.json()] == [job.id]

    cal = client.get(
        f"{BASE}/publish/calendar",
        params={
            "from": (datetime.now(UTC) - timedelta(days=1)).isoformat(),
            "to": (datetime.now(UTC) + timedelta(days=7)).isoformat(),
        },
        headers=auth_headers,
    )
    assert cal.status_code == 200
    assert len(cal.json()) == 1

    assert client.delete(f"{BASE}/publish-jobs/{job.id}", headers=auth_headers).status_code == 204


def test_list_and_disconnect_social_accounts(client, db, user, auth_headers):
    from app.models.publishing import SocialAccount, SocialPlatform

    account = SocialAccount(user_id=user.id, platform=SocialPlatform.tiktok, display_name="tt")
    db.add(account)
    db.commit()
    db.refresh(account)

    listed = client.get(f"{BASE}/social-accounts", headers=auth_headers)
    assert listed.status_code == 200
    assert [a["id"] for a in listed.json()] == [account.id]

    assert (
        client.delete(f"{BASE}/social-accounts/{account.id}", headers=auth_headers).status_code
        == 204
    )


def test_publish_job_ownership(client, db, make_clip, user, other_headers):
    clip = make_clip(user, status="rendered")
    job = PublishJob(
        clip_id=clip.id, user_id=user.id, destination_type="link",
        status=PublishJobStatus.draft,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    assert client.put(
        f"{BASE}/publish-jobs/{job.id}", json={"caption_text": "x"}, headers=other_headers
    ).status_code == 404
