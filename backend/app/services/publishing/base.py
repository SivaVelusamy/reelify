"""Common publish-adapter interface."""

from typing import Protocol

from app.models.clip import Clip
from app.models.publishing import PublishJob

_PLACEHOLDER_MARKERS = ("changeme", "placeholder", "your-", "xxx")


def is_placeholder(value: str | None) -> bool:
    """True when a credential is unset or still a template placeholder."""
    v = (value or "").strip().lower()
    return not v or any(m in v for m in _PLACEHOLDER_MARKERS)


def use_stub_tokens(code: str, client_id: str | None) -> bool:
    """Whether the OAuth callback should skip the real token exchange."""
    return code == "simulated" or is_placeholder(client_id)


class PublishAdapter(Protocol):
    """Every adapter module satisfies this by exposing a module-level ``publish``.

    ``account_or_webhook`` is, depending on the destination:
      * social  -> a :class:`~app.models.publishing.SocialAccount` (holds encrypted tokens)
      * slack   -> the decrypted incoming-webhook URL (``str``)
      * teams   -> the decrypted incoming-webhook URL (``str``)
      * link    -> the active SQLAlchemy ``Session`` (the adapter creates the ShareLink)
    """

    def publish(self, job: PublishJob, clip: Clip, account_or_webhook: object) -> str:
        """Perform the publish and return the external post / message / slug id."""
        ...
