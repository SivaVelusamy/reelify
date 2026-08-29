from app.models.clip import ClipStatus

BASE = "/api/v1"


def test_list_candidates_ordered_by_rank(client, make_source_video, make_clip, user, auth_headers):
    video = make_source_video(user, duration_seconds=600.0)
    make_clip(user, video=video, status="suggested", rank=3, title="third")
    make_clip(user, video=video, status="suggested", rank=1, title="first")
    make_clip(user, video=video, status="suggested", rank=2, title="second")

    resp = client.get(f"{BASE}/videos/{video.id}/clips", headers=auth_headers)
    assert resp.status_code == 200
    assert [c["rank"] for c in resp.json()] == [1, 2, 3]


def test_manual_clip_start_must_precede_end(client, make_source_video, user, auth_headers):
    video = make_source_video(user, duration_seconds=600.0)
    resp = client.post(
        f"{BASE}/videos/{video.id}/clips",
        json={"start_seconds": 20, "end_seconds": 10},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_manual_clip_created_as_draft(client, make_source_video, user, auth_headers):
    video = make_source_video(user, duration_seconds=600.0)
    resp = client.post(
        f"{BASE}/videos/{video.id}/clips",
        json={"start_seconds": 5, "end_seconds": 25, "title": "manual"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "draft"


def test_update_clip_promotes_suggested_to_draft(client, make_clip, user, auth_headers):
    clip = make_clip(user, status="suggested")
    resp = client.put(
        f"{BASE}/clips/{clip.id}", json={"title": "Promoted"}, headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "draft"


def test_update_clip_rejects_bad_bounds(client, make_clip, user, auth_headers):
    clip = make_clip(user, status="draft")
    resp = client.put(
        f"{BASE}/clips/{clip.id}",
        json={"start_seconds": 30, "end_seconds": 5},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_update_captions(client, make_clip, user, auth_headers):
    clip = make_clip(user, status="draft")
    resp = client.put(
        f"{BASE}/clips/{clip.id}/captions",
        json={"segments": [{"start": 0, "end": 2, "text": "hi"}]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["clip_id"] == clip.id
    assert resp.json()["segments"][0]["text"] == "hi"


def test_render_returns_202(client, make_clip, user, auth_headers):
    clip = make_clip(user, status="draft")
    resp = client.post(f"{BASE}/clips/{clip.id}/render", headers=auth_headers)
    assert resp.status_code == 202
    assert resp.json()["clip_id"] == clip.id
    assert resp.json()["job_id"] == "test-task-id"


def test_export_returns_202(client, make_clip, user, auth_headers):
    clip = make_clip(user, status="rendered")
    resp = client.post(
        f"{BASE}/clips/{clip.id}/export",
        json={"preset": "tiktok", "resolution": "1080x1920", "format": "mp4"},
        headers=auth_headers,
    )
    assert resp.status_code == 202
    assert resp.json()["status"] == "queued"


def test_clip_preview_url(client, make_clip, user, auth_headers):
    clip = make_clip(user, status="rendered")
    resp = client.get(f"{BASE}/clips/{clip.id}/preview", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["preview_url"].startswith("https://")


def test_clip_ownership_404(client, make_clip, user, other_headers):
    clip = make_clip(user, status="draft")
    assert client.get(f"{BASE}/clips/{clip.id}", headers=other_headers).status_code == 404
    assert (
        client.put(
            f"{BASE}/clips/{clip.id}", json={"title": "x"}, headers=other_headers
        ).status_code
        == 404
    )


def test_delete_clip_archives_rendered(client, make_clip, user, auth_headers, db):
    clip = make_clip(user, status="rendered")
    assert client.delete(f"{BASE}/clips/{clip.id}", headers=auth_headers).status_code == 204
    db.refresh(clip)
    assert clip.status == ClipStatus.archived


def test_get_export_with_download_url(client, db, make_clip, user, auth_headers):
    from app.models.clip import ClipExport, ClipExportStatus

    clip = make_clip(user, status="rendered")
    export = ClipExport(
        clip_id=clip.id,
        preset="tiktok",
        status=ClipExportStatus.ready,
        storage_key="exports/x.mp4",
    )
    db.add(export)
    db.commit()
    db.refresh(export)

    resp = client.get(f"{BASE}/exports/{export.id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["download_url"].startswith("https://")
    # ownership
    assert client.get(f"{BASE}/exports/{export.id}", headers=_other(client)).status_code in (401, 404)


def _other(client):
    return {"Authorization": "Bearer bogus"}


def test_preview_falls_back_to_source_video(client, make_source_video, make_clip, user, auth_headers):
    video = make_source_video(user, storage_key="sources/x/1/src.mp4")
    clip = make_clip(user, video=video, status="draft", render_storage_key=None)
    resp = client.get(f"{BASE}/clips/{clip.id}/preview", headers=auth_headers)
    assert resp.status_code == 200


def test_delete_clip_hard_deletes_suggested(client, make_clip, user, auth_headers):
    clip = make_clip(user, status="suggested")
    assert client.delete(f"{BASE}/clips/{clip.id}", headers=auth_headers).status_code == 204
    assert client.get(f"{BASE}/clips/{clip.id}", headers=auth_headers).status_code == 404
