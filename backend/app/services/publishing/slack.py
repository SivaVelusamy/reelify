"""Slack publish adapter — REAL.

Posts the clip's presigned video URL + caption to a user-provided Slack
*incoming webhook* URL (https://api.slack.com/messaging/webhooks). No Slack OAuth
app is required; the webhook URL is the credential and is stored encrypted on a
``SocialAccount`` row (platform ``slack``).
"""

import logging

import httpx

from app.storage import generate_presigned_url

logger = logging.getLogger(__name__)

_HTTP_TIMEOUT = 15.0


def publish(job, clip, account_or_webhook) -> str:
    """POST to the incoming webhook. ``account_or_webhook`` is the webhook URL (str)."""
    webhook_url = account_or_webhook
    if not isinstance(webhook_url, str) or not webhook_url.startswith("https://"):
        raise ValueError("Slack destination requires a valid https incoming-webhook URL")

    if not clip.render_storage_key:
        raise ValueError("Clip has not been rendered yet")

    video_url = generate_presigned_url(clip.render_storage_key)
    caption = job.caption_text or clip.title or "New clip from Reelify"

    payload = {
        "text": f"{caption}\n{video_url}",
        "blocks": [
            {"type": "section", "text": {"type": "mrkdwn", "text": caption}},
            {
                "type": "section",
                "text": {"type": "mrkdwn", "text": f"<{video_url}|▶ Watch the clip>"},
            },
        ],
    }

    with httpx.Client(timeout=_HTTP_TIMEOUT) as client:
        resp = client.post(webhook_url, json=payload)
        resp.raise_for_status()

    logger.info("slack.publish: posted clip %s to Slack webhook", clip.id)
    # Incoming webhooks return only "ok" (no message ts), so synthesise an id.
    return f"slack-{job.id}"
