"""Resolution of the browser-facing storage endpoint for presigned URLs."""

import pytest

from app import public_url, storage


@pytest.fixture(autouse=True)
def _reset(monkeypatch):
    public_url.set_request_base_url(None)
    yield
    public_url.set_request_base_url(None)


def test_empty_means_internal_endpoint(monkeypatch):
    monkeypatch.setattr(storage.settings, "STORAGE_PUBLIC_ENDPOINT", "")
    assert storage._public_endpoint() is None


def test_explicit_url_is_used(monkeypatch):
    monkeypatch.setattr(
        storage.settings, "STORAGE_PUBLIC_ENDPOINT", "https://s3.reelify.example.com"
    )
    assert storage._public_endpoint() == "https://s3.reelify.example.com"


def test_auto_derives_s3_subdomain(monkeypatch):
    monkeypatch.setattr(storage.settings, "STORAGE_PUBLIC_ENDPOINT", "auto")
    monkeypatch.setattr(public_url.settings, "PUBLIC_BASE_URL", "https://reelify.aisiva.tech")
    assert storage._public_endpoint() == "https://s3.reelify.aisiva.tech"


def test_auto_is_noop_for_localhost(monkeypatch):
    monkeypatch.setattr(storage.settings, "STORAGE_PUBLIC_ENDPOINT", "auto")
    monkeypatch.setattr(public_url.settings, "PUBLIC_BASE_URL", "")
    monkeypatch.setattr(public_url.settings, "FRONTEND_URL", "http://localhost:3010")
    assert storage._public_endpoint() is None


def test_presigned_url_uses_resolved_public_endpoint(monkeypatch):
    monkeypatch.setattr(storage.settings, "MEDIA_DELIVERY", "presigned")
    monkeypatch.setattr(storage.settings, "STORAGE_PUBLIC_ENDPOINT", "auto")
    monkeypatch.setattr(public_url.settings, "PUBLIC_BASE_URL", "https://reelify.aisiva.tech")

    seen = {}

    class _FakeClient:
        def generate_presigned_url(self, *a, **k):
            return "signed"

    def fake_client(endpoint=None):
        seen["endpoint"] = endpoint
        return _FakeClient()

    monkeypatch.setattr(storage, "_client", fake_client)
    storage.generate_presigned_url("renders/1/2.mp4")
    assert seen["endpoint"] == "https://s3.reelify.aisiva.tech"
