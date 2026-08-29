"""Microsoft Teams publish adapter — REAL.

Posts the clip's presigned video URL + caption to a user-provided Teams
*incoming webhook* connector URL as a MessageCard payload. No Teams OAuth app is
required; the webhook URL is stored encrypted on a ``SocialAccount`` row
(platform ``teams``).
"""

import logging

import httpx

from app.storage import generate_presigned_url

logger = logging.getLogger(__name__)

_HTTP_TIMEOUT = 15.0


def publish(job, clip, account_or_webhook) -> str:
    """POST a MessageCard to the Teams webhook. ``account_or_webhook`` is the URL (str)."""
    webhook_url = account_or_webhook
    if not isinstance(webhook_url, str) or not webhook_url.startswith("https://"):
        raise ValueError("Teams destination requires a valid https incoming-webhook URL")

    if not clip.render_storage_key:
        raise ValueError("Clip has not been rendered yet")

    video_url = generate_presigned_url(clip.render_storage_key)
    caption = job.caption_text or clip.title or "New clip from Reelify"

    payload = {
        "@type": "MessageCard",
        "@context": "https://schema.org/extensions",
        "summary": "New clip from Reelify",
        "themeColor": "5B6EF5",
        "title": clip.title or "New clip from Reelify",
        "text": caption,
        "potentialAction": [
            {
                "@type": "OpenUri",
                "name": "Watch the clip",
                "targets": [{"os": "default", "uri": video_url}],
            }
        ],
    }

    with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
        resp = client.post(webhook_url, json=payload)
        resp.raise_for_status()

    logger.info("teams.publish: posted clip %s to Teams webhook", clip.id)
    return f"teams-{job.id}"
