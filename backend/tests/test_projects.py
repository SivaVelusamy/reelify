from app.models.project import SourceVideoStatus

BASE = "/api/v1"


def test_project_crud(client, auth_headers):
    created = client.post(
        f"{BASE}/projects",
        json={"title": "Launch", "campaign": "q3", "description": "desc"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    pid = created.json()["id"]

    listed = client.get(f"{BASE}/projects", headers=auth_headers)
    assert listed.status_code == 200
    assert [p["id"] for p in listed.json()] == [pid]

    got = client.get(f"{BASE}/projects/{pid}", headers=auth_headers)
    assert got.status_code == 200

    updated = client.put(
        f"{BASE}/projects/{pid}", json={"title": "Launch v2"}, headers=auth_headers
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Launch v2"

    assert client.delete(f"{BASE}/projects/{pid}", headers=auth_headers).status_code == 204
    assert client.get(f"{BASE}/projects/{pid}", headers=auth_headers).status_code == 404


def test_project_ownership_isolation(client, make_project, user, other_headers):
    project = make_project(user)
    resp = client.get(f"{BASE}/projects/{project.id}", headers=other_headers)
    assert resp.status_code == 404


def test_upload_source_video_queues_row(client, make_project, user, auth_headers, db):
    project = make_project(user)
    resp = client.post(
        f"{BASE}/projects/{project.id}/videos",
        files={"file": ("tiny.mp4", b"\x00\x00\x00", "video/mp4")},
        headers=auth_headers,
    )
    assert resp.status_code == 202
    body = resp.json()
    assert body["status"] == "queued"
    assert body["project_id"] == project.id

    videos = client.get(f"{BASE}/projects/{project.id}/videos", headers=auth_headers)
    assert videos.status_code == 200
    assert len(videos.json()) == 1


def test_upload_rejects_non_video(client, make_project, user, auth_headers):
    project = make_project(user)
    resp = client.post(
        f"{BASE}/projects/{project.id}/videos",
        files={"file": ("note.txt", b"hello", "text/plain")},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_youtube_url_host_validation(client, make_project, user, auth_headers):
    project = make_project(user)
    bad = client.post(
        f"{BASE}/projects/{project.id}/videos",
        data={"youtube_url": "https://vimeo.com/12345"},
        headers=auth_headers,
    )
    assert bad.status_code == 422

    good = client.post(
        f"{BASE}/projects/{project.id}/videos",
        data={"youtube_url": "https://www.youtube.com/watch?v=abc"},
        headers=auth_headers,
    )
    assert good.status_code == 202
    assert good.json()["source_type"] == "youtube_url"


def test_youtube_import_accepts_url_field(client, make_project, user, auth_headers):
    # The frontend posts the link as `url`, not `youtube_url`.
    project = make_project(user)
    resp = client.post(
        f"{BASE}/projects/{project.id}/videos",
        data={"url": "https://youtu.be/dQw4w9WgXcQ"},
        headers=auth_headers,
    )
    assert resp.status_code == 202
    assert resp.json()["source_type"] == "youtube_url"


def test_add_video_missing_payload_422(client, make_project, user, auth_headers):
    project = make_project(user)
    resp = client.post(f"{BASE}/projects/{project.id}/videos", headers=auth_headers)
    assert resp.status_code == 422


def test_reprocess_resets_status(client, make_source_video, user, auth_headers, db):
    video = make_source_video(user, status="failed")
    resp = client.post(f"{BASE}/videos/{video.id}/reprocess", headers=auth_headers)
    assert resp.status_code == 202
    assert resp.json()["status"] == "queued"
    db.refresh(video)
    assert video.status == SourceVideoStatus.queued
    assert video.error_message is None


def test_video_status_and_ownership(client, make_source_video, user, auth_headers, other_headers):
    video = make_source_video(user, status="transcribing")
    ok = client.get(f"{BASE}/videos/{video.id}/status", headers=auth_headers)
    assert ok.status_code == 200
    assert ok.json()["status"] == "transcribing"
    assert ok.json()["progress"] > 0

    assert client.get(f"{BASE}/videos/{video.id}", headers=other_headers).status_code == 404


def test_delete_video(client, make_source_video, user, auth_headers):
    video = make_source_video(user)
    assert client.delete(f"{BASE}/videos/{video.id}", headers=auth_headers).status_code == 204
    assert client.get(f"{BASE}/videos/{video.id}", headers=auth_headers).status_code == 404


def test_transcript_404_when_absent(client, make_source_video, user, auth_headers):
    video = make_source_video(user)
    assert client.get(f"{BASE}/videos/{video.id}/transcript", headers=auth_headers).status_code == 404


def test_transcript_returned_when_present(client, db, make_source_video, make_transcript, user, auth_headers):
    video = make_source_video(user)
    make_transcript(video, full_text="hello world")
    db.expire_all()
    resp = client.get(f"{BASE}/videos/{video.id}/transcript", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["full_text"] == "hello world"


def test_batch_upload(client, make_project, user, auth_headers):
    project = make_project(user)
    resp = client.post(
        f"{BASE}/projects/{project.id}/videos/batch",
        files=[
            ("files", ("a.mp4", b"\x00\x00", "video/mp4")),
            ("files", ("b.mp4", b"\x00\x00", "video/mp4")),
        ],
        headers=auth_headers,
    )
    assert resp.status_code == 202
    body = resp.json()
    assert body["total_items"] == 2
    assert body["completed_items"] == 2
    assert body["status"] == "completed"
