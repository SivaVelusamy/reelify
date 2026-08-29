"""Publish adapters for Module 8.

Each adapter module exposes a module-level callable::

    publish(job, clip, account_or_webhook) -> str   # returns external_post_id

matching :class:`app.services.publishing.base.PublishAdapter`.

Social adapters (:mod:`tiktok`, :mod:`instagram`, :mod:`youtube`) additionally
expose ``build_auth_url(state)`` and ``exchange_code(code)`` for the OAuth
connect flow. Their ``publish()`` is a STUB (logs the intended upload call and
returns a fake id); the real upload endpoint + payload live in code comments.

:mod:`slack` and :mod:`teams` are REAL — they POST the clip's presigned URL and
caption to a user-supplied incoming-webhook URL. :mod:`link` is REAL — it
ensures a :class:`~app.models.publishing.ShareLink` exists and returns its slug.
"""

from app.services.publishing import (
    instagram,
    link,
    slack,
    teams,
    tiktok,
    youtube,
)

SOCIAL_ADAPTERS = {
    "tiktok": tiktok,
    "instagram": instagram,
    "youtube": youtube,
}

__all__ = [
    "SOCIAL_ADAPTERS",
    "instagram",
    "link",
    "slack",
    "teams",
    "tiktok",
    "youtube",
]
