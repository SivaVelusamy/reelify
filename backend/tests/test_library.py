from app.models.library import ClipVersion

BASE = "/api/v1"


def test_list_library_clips_filters(client, make_source_video, make_clip, make_project, user, auth_headers):
    project_a = make_project(user, title="A", campaign="alpha")
    project_b = make_project(user, title="B", campaign="beta")
    video_a = make_source_video(user, project=project_a)
    video_b = make_source_video(user, project=project_b)
    make_clip(user, video=video_a, status="rendered")
    make_clip(user, video=video_b, status="draft")

    all_clips = client.get(f"{BASE}/library/clips", headers=auth_headers)
    assert all_clips.status_code == 200
    assert all_clips.json()["total"] == 2

    by_project = client.get(
        f"{BASE}/library/clips", params={"project_id": project_a.id}, headers=auth_headers
    )
    assert by_project.json()["total"] == 1

    by_status = client.get(
        f"{BASE}/library/clips", params={"status": "draft"}, headers=auth_headers
    )
    assert by_status.json()["total"] == 1


def test_search_ilike_fallback(client, make_source_video, make_transcript, make_clip, user, auth_headers):
    video = make_source_video(user)
    make_transcript(video, full_text="we talk about kubernetes autoscaling today")
    make_clip(user, video=video, status="rendered", title="Scaling talk")

    resp = client.get(f"{BASE}/library/search", params={"q": "kubernetes"}, headers=auth_headers)
    assert resp.status_code == 200
    hits = resp.json()
    assert len(hits) >= 1
    assert hits[0]["matched_in"] in ("transcript", "title")


def test_tag_create_dedupe_attach_and_filter(client, make_clip, user, auth_headers):
    clip = make_clip(user, status="rendered")

    first = client.post(f"{BASE}/tags", json={"name": "funny"}, headers=auth_headers)
    assert first.status_code == 201
    tag_id = first.json()["id"]

    dup = client.post(f"{BASE}/tags", json={"name": "funny"}, headers=auth_headers)
    assert dup.status_code == 201
    assert dup.json()["id"] == tag_id  # deduped

    attach = client.post(
        f"{BASE}/clips/{clip.id}/tags", json={"tag_ids": [tag_id]}, headers=auth_headers
    )
    assert attach.status_code == 200
    assert [t["id"] for t in attach.json()["tags"]] == [tag_id]

    filtered = client.get(
        f"{BASE}/library/clips", params={"tag_id": tag_id}, headers=auth_headers
    )
    assert filtered.json()["total"] == 1


def test_version_restore_keeps_backup(client, db, make_clip, user, auth_headers):
    clip = make_clip(user, status="rendered", title="current title", start_seconds=2.0, end_seconds=8.0)
    db.add(
        ClipVersion(
            clip_id=clip.id,
            version_number=1,
            snapshot={
                "clip": {
                    "title": "old title",
                    "start_seconds": 0.0,
                    "end_seconds": 5.0,
                    "status": "rendered",
                },
                "caption": None,
            },
        )
    )
    db.commit()

    resp = client.post(f"{BASE}/clips/{clip.id}/restore/1", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["title"] == "old title"

    versions = client.get(f"{BASE}/clips/{clip.id}/versions", headers=auth_headers)
    # original v1 + the backup snapshot taken during restore
    assert len(versions.json()) == 2


def test_bundle_rejects_non_rendered(client, make_clip, user, auth_headers):
    draft = make_clip(user, status="draft")
    resp = client.post(
        f"{BASE}/library/bundles", json={"clip_ids": [draft.id]}, headers=auth_headers
    )
    assert resp.status_code == 422


def test_bundle_created_for_rendered(client, make_clip, user, auth_headers):
    clip = make_clip(user, status="rendered")
    resp = client.post(
        f"{BASE}/library/bundles", json={"clip_ids": [clip.id]}, headers=auth_headers
    )
    assert resp.status_code == 202
    assert resp.json()["status"] == "queued"


def test_get_bundle(client, make_clip, user, auth_headers, other_headers):
    clip = make_clip(user, status="rendered")
    created = client.post(
        f"{BASE}/library/bundles", json={"clip_ids": [clip.id]}, headers=auth_headers
    )
    bundle_id = created.json()["id"]
    got = client.get(f"{BASE}/library/bundles/{bundle_id}", headers=auth_headers)
    assert got.status_code == 200
    assert got.json()["clip_ids"] == [clip.id]
    assert client.get(f"{BASE}/library/bundles/{bundle_id}", headers=other_headers).status_code == 404


def test_restore_version_with_caption_snapshot(client, db, make_clip, user, auth_headers):
    clip = make_clip(user, status="rendered", title="now")
    db.add(
        ClipVersion(
            clip_id=clip.id,
            version_number=1,
            snapshot={
                "clip": {"title": "was", "start_seconds": 0.0, "end_seconds": 4.0},
                "caption": {"segments": [{"text": "old"}], "style_preset_id": None,
                            "style_overrides": None},
            },
        )
    )
    db.commit()
    resp = client.post(f"{BASE}/clips/{clip.id}/restore/1", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["title"] == "was"


def test_search_empty_query_422(client, auth_headers):
    assert client.get(f"{BASE}/library/search", params={"q": ""}, headers=auth_headers).status_code == 422


def test_library_ownership(client, make_clip, user, other_headers):
    clip = make_clip(user, status="rendered")
    resp = client.post(
        f"{BASE}/clips/{clip.id}/tags", json={"tag_ids": [1]}, headers=other_headers
    )
    assert resp.status_code == 404
