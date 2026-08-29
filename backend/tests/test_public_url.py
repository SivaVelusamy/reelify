"""app.public_url — resolving the outward-facing base URL."""

import pytest

from app import public_url
from app.public_url import base_url_from_request, public_base_url, set_request_base_url


@pytest.fixture(autouse=True)
def _reset_context():
    set_request_base_url(None)
    yield
    set_request_base_url(None)


def test_configured_public_base_url_wins(monkeypatch):
    monkeypatch.setattr(public_url.settings, "PUBLIC_BASE_URL", "https://reelify.example.com/")
    set_request_base_url("https://something-else.test")
    assert public_base_url() == "https://reelify.example.com"


def test_request_origin_used_when_not_configured(monkeypatch):
    monkeypatch.setattr(public_url.settings, "PUBLIC_BASE_URL", "")
    set_request_base_url("https://vps.example.org")
    assert public_base_url() == "https://vps.example.org"


def test_local_request_origin_is_ignored(monkeypatch):
    monkeypatch.setattr(public_url.settings, "PUBLIC_BASE_URL", "")
    monkeypatch.setattr(public_url.settings, "FRONTEND_URL", "http://localhost:3010")
    set_request_base_url("http://localhost:8010")
    assert public_base_url() == "http://localhost:3010"


class _Req:
    def __init__(self, headers, scheme="http", netloc="backend:8000"):
        self.headers = headers
        self.url = type("U", (), {"scheme": scheme, "netloc": netloc})()


def test_base_url_from_forwarded_headers(monkeypatch):
    monkeypatch.setattr(public_url.settings, "TRUST_PROXY_HEADERS", True)
    req = _Req(
        {"x-forwarded-proto": "https", "x-forwarded-host": "reelify.example.com"}
    )
    assert base_url_from_request(req) == "https://reelify.example.com"


def test_base_url_from_host_header_fallback(monkeypatch):
    monkeypatch.setattr(public_url.settings, "TRUST_PROXY_HEADERS", True)
    req = _Req({"host": "reelify.example.com"}, scheme="https")
    assert base_url_from_request(req) == "https://reelify.example.com"


def test_proxy_headers_ignored_when_untrusted(monkeypatch):
    monkeypatch.setattr(public_url.settings, "TRUST_PROXY_HEADERS", False)
    req = _Req({"x-forwarded-proto": "https", "x-forwarded-host": "evil.test"})
    assert base_url_from_request(req) is None


def test_share_link_uses_request_origin(client, db, make_clip, user, auth_headers):
    clip = make_clip(user, status="rendered")
    resp = client.post(
        f"/api/v1/clips/{clip.id}/share-link",
        json={},
        headers={
            **auth_headers,
            "X-Forwarded-Proto": "https",
            "X-Forwarded-Host": "reelify.example.com",
        },
    )
    assert resp.status_code == 201
    assert resp.json()["url"].startswith("https://reelify.example.com/s/")
