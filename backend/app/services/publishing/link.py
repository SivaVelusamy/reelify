"""Share-link publish adapter — REAL.

"Publishing" a clip to the ``link`` destination just means ensuring a public
:class:`~app.models.publishing.ShareLink` exists for it. The slug is returned as
the job's ``external_post_id``.
"""

import logging
import secrets

from sqlalchemy.orm import Session

from app.models.publishing import ShareLink

logger = logging.getLogger(__name__)

SLUG_BYTES = 9  # secrets.token_urlsafe(9) -> 12-char unguessable slug


def _new_slug(db: Session) -> str:
    for _ in range(5):
        candidate = secrets.token_urlsafe(SLUG_BYTES)
        if not db.query(ShareLink).filter(ShareLink.slug == candidate).first():
            return candidate
    raise RuntimeError("Could not allocate a unique share-link slug")


def publish(job, clip, account_or_webhook) -> str:
    """Ensure an active ShareLink for ``clip`` and return its slug.

    ``account_or_webhook`` is the active SQLAlchemy ``Session``.
    """
    db: Session = account_or_webhook

    existing = (
        db.query(ShareLink)
        .filter(
            ShareLink.clip_id == clip.id,
            ShareLink.user_id == job.user_id,
            ShareLink.is_active.is_(True),
        )
        .order_by(ShareLink.created_at.desc())
        .first()
    )
    if existing is not None:
        logger.info("link.publish: reusing share link %s for clip %s", existing.slug, clip.id)
        return existing.slug

    link = ShareLink(
        clip_id=clip.id,
        user_id=job.user_id,
        slug=_new_slug(db),
        is_active=True,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    logger.info("link.publish: created share link %s for clip %s", link.slug, clip.id)
    return link.slug
