BASE = "/api/v1"


def test_dashboard_summary(client, make_source_video, make_clip, make_project, user, auth_headers):
    project = make_project(user)
    ready = make_source_video(user, project=project, status="ready", duration_seconds=600.0)
    make_source_video(user, project=project, status="transcribing", duration_seconds=120.0)
    make_clip(user, video=ready, status="rendered")
    make_clip(user, video=ready, status="draft")

    resp = client.get(f"{BASE}/dashboard/summary", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["minutes_processed"] == 10.0  # 600s / 60
    assert body["clips_generated"] == 2
    assert body["videos_processing"] == 1
    assert body["projects_count"] == 1
    assert body["plan"] == "free"
    assert body["minutes_limit"] == 30


def test_dashboard_activity_feed_sorted_desc(client, make_source_video, make_clip, user, auth_headers):
    video = make_source_video(user, status="ready")
    make_clip(user, video=video, status="rendered")

    resp = client.get(f"{BASE}/dashboard/activity", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 3
    timestamps = [item["timestamp"] for item in body["items"]]
    assert timestamps == sorted(timestamps, reverse=True)


def test_dashboard_requires_auth(client):
    assert client.get(f"{BASE}/dashboard/summary").status_code == 401
    assert client.get(f"{BASE}/dashboard/activity").status_code == 401
