import pytest

BASE = "/api/v1/admin"

ADMIN_ROUTES = [
    ("get", "/users"),
    ("get", "/users/1"),
    ("get", "/stats"),
    ("get", "/jobs"),
]


@pytest.mark.parametrize("method,path", ADMIN_ROUTES)
def test_non_admin_forbidden(client, auth_headers, method, path):
    resp = getattr(client, method)(f"{BASE}{path}", headers=auth_headers)
    assert resp.status_code == 403


def test_admin_routes_require_auth(client):
    assert client.get(f"{BASE}/users").status_code == 401


def test_admin_lists_and_searches_users(client, admin_headers, user):
    listed = client.get(f"{BASE}/users", headers=admin_headers)
    assert listed.status_code == 200
    assert listed.json()["total"] >= 2

    searched = client.get(
        f"{BASE}/users", params={"q": "user@example.com"}, headers=admin_headers
    )
    assert searched.status_code == 200
    emails = [row["email"] for row in searched.json()["items"]]
    assert "user@example.com" in emails


def test_admin_updates_plan(client, admin_headers, user):
    resp = client.put(
        f"{BASE}/users/{user.id}", json={"plan": "starter"}, headers=admin_headers
    )
    assert resp.status_code == 200
    assert resp.json()["plan"] == "starter"


def test_admin_cannot_self_demote(client, admin_headers, admin_user):
    resp = client.put(
        f"{BASE}/users/{admin_user.id}", json={"is_admin": False}, headers=admin_headers
    )
    assert resp.status_code == 422


def test_admin_user_detail_404(client, admin_headers):
    assert client.get(f"{BASE}/users/999999", headers=admin_headers).status_code == 404


def test_platform_stats_shape(client, admin_headers, user):
    resp = client.get(f"{BASE}/stats", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    for key in (
        "users_total",
        "users_active",
        "users_new_30d",
        "minutes_processed_30d",
        "clips_generated_total",
        "publish_jobs_total",
        "revenue_estimate_cents",
    ):
        assert key in body


def test_job_queue_health_shape(client, admin_headers):
    resp = client.get(f"{BASE}/jobs", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == {"pipeline", "render", "publish", "broker_reachable"}
    assert body["broker_reachable"] is False
    assert "processing" in body["pipeline"]
