"""Common publish-adapter interface."""

from typing import Protocol

from app.models.clip import Clip
from app.models.publishing import PublishJob


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
