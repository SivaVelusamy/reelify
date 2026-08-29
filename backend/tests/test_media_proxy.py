"""Backend media proxy — same-origin streaming of storage objects."""

import pytest

from app import storage
from app.media_proxy import sign_media_key, verify_media_token

BASE = "/api/v1"


def test_token_roundtrip():
    tok = sign_media_key("renders/1/2.mp4")
    assert verify_media_token(tok) == "renders/1/2.mp4"


def test_token_tampered_rejected():
    tok = sign_media_key("renders/1/2.mp4")
    with pytest.raises(ValueError):
        verify_media_token(tok[:-2] + "xx")


def test_token_expiry():
    tok = sign_media_key("k", ttl=-1)
    with pytest.raises(ValueError, match="expired"):
        verify_media_token(tok)


def test_generate_url_is_proxy_by_default(monkeypatch):
    monkeypatch.setattr(storage.settings, "MEDIA_DELIVERY", "proxy")
    url = storage.generate_presigned_url("renders/1/2.mp4")
    assert "/api/v1/media/" in url
    token = url.rsplit("/media/", 1)[1]
    assert verify_media_token(token) == "renders/1/2.mp4"


def test_generate_url_presigned_when_configured(monkeypatch):
    monkeypatch.setattr(storage.settings, "MEDIA_DELIVERY", "presigned")
    url = storage.generate_presigned_url("renders/1/2.mp4")
    assert url == "https://signed.example/object"  # conftest mock


def _fake_get_object(**kwargs):
    body = b"\x00" * 2048
    rng = kwargs.get("Range")
    if rng:
        start = int(rng.split("=")[1].split("-")[0])
        chunk = body[start:]

        class _B:
            def iter_chunks(self, n):
                yield chunk

        return {
            "Body": _B(),
            "ContentLength": len(chunk),
            "ContentType": "video/mp4",
            "ContentRange": f"bytes {start}-{len(body) - 1}/{len(body)}",
        }

    class _B:
        def iter_chunks(self, n):
            yield body

    return {"Body": _B(), "ContentLength": len(body), "ContentType": "video/mp4"}


def test_media_route_streams_object(client, monkeypatch):
    fake_client = type("C", (), {"get_object": staticmethod(_fake_get_object)})()
    monkeypatch.setattr(storage, "_client", lambda *a, **k: fake_client)
    token = sign_media_key("renders/1/2.mp4")

    r = client.get(f"{BASE}/media/{token}")
    assert r.status_code == 200
    assert r.headers["content-type"] == "video/mp4"
    assert r.headers["accept-ranges"] == "bytes"
    assert len(r.content) == 2048


def test_media_route_supports_range(client, monkeypatch):
    fake_client = type("C", (), {"get_object": staticmethod(_fake_get_object)})()
    monkeypatch.setattr(storage, "_client", lambda *a, **k: fake_client)
    token = sign_media_key("renders/1/2.mp4")

    r = client.get(f"{BASE}/media/{token}", headers={"Range": "bytes=1024-"})
    assert r.status_code == 206
    assert r.headers["content-range"] == "bytes 1024-2047/2048"
    assert len(r.content) == 1024


def test_media_route_bad_token_404(client):
    assert client.get(f"{BASE}/media/not-a-real-token").status_code == 404


def test_media_route_expired_token_404(client):
    stale = sign_media_key("k", ttl=-1)
    assert client.get(f"{BASE}/media/{stale}").status_code == 404
