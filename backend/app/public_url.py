"""Resolve the app's public base URL for building outward-facing links
(share links, OAuth redirects, Stripe return URLs).

Priority:
  1. ``settings.PUBLIC_BASE_URL`` if set — the operator's canonical origin.
  2. The origin of the current request, derived from ``X-Forwarded-Proto`` /
     ``X-Forwarded-Host`` (or ``Host``) when ``TRUST_PROXY_HEADERS`` is on.
     Populated per-request by :func:`app.main`'s middleware.
  3. ``settings.FRONTEND_URL`` (the local-dev default).
"""

from contextvars import ContextVar

from starlette.requests import Request

from app.config import settings

_request_base_url: ContextVar[str | None] = ContextVar("_request_base_url", default=None)

_LOCAL_HOSTS = ("localhost", "127.0.0.1", "0.0.0.0")


def _is_local(url: str) -> bool:
    return any(h in url for h in _LOCAL_HOSTS)


def base_url_from_request(request: Request) -> str | None:
    """Best-effort public origin for an incoming request (proxy-aware)."""
    if not settings.TRUST_PROXY_HEADERS:
        return None
    headers = request.headers
    proto = (
        headers.get("x-forwarded-proto", "").split(",")[0].strip()
        or request.url.scheme
    )
    host = (
        headers.get("x-forwarded-host", "").split(",")[0].strip()
        or headers.get("host", "").strip()
        or request.url.netloc
    )
    if not host:
        return None
    return f"{proto}://{host}"


def set_request_base_url(value: str | None) -> None:
    _request_base_url.set(value)


def public_base_url() -> str:
    """The base URL to use for a link the app hands to a browser or 3rd party."""
    configured = settings.PUBLIC_BASE_URL.strip()
    if configured:
        return configured.rstrip("/")
    from_request = _request_base_url.get()
    if from_request and not _is_local(from_request):
        return from_request.rstrip("/")
    return settings.FRONTEND_URL.rstrip("/")
