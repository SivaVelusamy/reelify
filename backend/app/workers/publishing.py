"""Celery tasks for Module 8 (Publishing / Distribution).

* ``run_publish_job(job_id)`` — executes a single PublishJob through the right
  adapter and records the outcome.
* ``scan_due_publish_jobs()`` — Celery-beat entrypoint: finds ``scheduled`` jobs
  whose time has come, flips them to ``publishing`` and dispatches them.

Both own their DB session and never raise out of the task body, so a failure
can't crash the worker loop. Importable without a broker.

Wiring: ``app/workers/__init__.py`` currently defines a stub task named
``app.workers.publishing.scan_due_publish_jobs``. The orchestrator swaps that
block for ``from app.workers import publishing`` (kept next to the existing
``pipeline`` / ``render`` imports) so this module's real tasks register under the
same names; the ``beat_schedule`` entry already points at
``app.workers.publishing.scan_due_publish_jobs``.
"""

import logging
from datetime import UTC, datetime

from app.auth.security import decrypt_token
from app.database import SessionLocal
from app.models.clip import Clip
from app.models.publishing import (
    PublishDestinationType,
    PublishJob,
    PublishJobStatus,
    SocialAccount,
)
from app.services.publishing import SOCIAL_ADAPTERS, link, slack, teams
from app.workers import celery

logger = logging.getLogger(__name__)


def _resolve_adapter_and_target(db, job: PublishJob, clip: Clip):
    """Return ``(adapter_module, third_arg)`` for the job's destination."""
    dest = job.destination_type

    if dest == PublishDestinationType.link:
        return link, db

    account: SocialAccount | None = None
    if job.social_account_id is not None:
        account = (
            db.query(SocialAccount)
            .filter(SocialAccount.id == job.social_account_id)
            .first()
        )

    if dest == PublishDestinationType.slack:
        if account is None or not account.access_token_encrypted:
            raise ValueError("Slack publish job has no stored webhook URL")
        return slack, decrypt_token(account.access_token_encrypted)

    if dest == PublishDestinationType.teams:
        if account is None or not account.access_token_encrypted:
            raise ValueError("Teams publish job has no stored webhook URL")
        return teams, decrypt_token(account.access_token_encrypted)

    if dest == PublishDestinationType.social:
        if account is None:
            raise ValueError("Social publish job has no connected account")
        platform = (
            account.platform.value
            if hasattr(account.platform, "value")
            else str(account.platform)
        )
        adapter = SOCIAL_ADAPTERS.get(platform)
        if adapter is None:
            raise ValueError(f"No publish adapter for platform {platform!r}")
        return adapter, account

    raise ValueError(f"Unknown destination_type {dest!r}")


@celery.task(name="app.workers.publishing.run_publish_job", bind=True)
def run_publish_job(self, job_id: int) -> dict:
    """Publish one job. Sets ``published`` + ``external_post_id`` on success,
    ``failed`` + ``error_message`` on any error."""
    db = SessionLocal()
    try:
        job = db.query(PublishJob).filter(PublishJob.id == job_id).first()
        if job is None:
            logger.warning("run_publish_job: job %s not found", job_id)
            return {"job_id": job_id, "status": "not_found"}

        job.status = PublishJobStatus.publishing
        db.add(job)
        db.commit()

        clip = db.query(Clip).filter(Clip.id == job.clip_id).first()
        if clip is None:
            raise ValueError(f"Clip {job.clip_id} no longer exists")

        adapter, target = _resolve_adapter_and_target(db, job, clip)
        external_post_id = adapter.publish(job, clip, target)

        job.status = PublishJobStatus.published
        job.external_post_id = str(external_post_id) if external_post_id else None
        job.published_at = datetime.now(UTC)
        job.error_message = None
        db.add(job)
        db.commit()
        logger.info(
            "run_publish_job: job %s published (external_post_id=%s)",
            job_id,
            job.external_post_id,
        )
        return {"job_id": job_id, "status": PublishJobStatus.published.value}
    except Exception as exc:  # noqa: BLE001 - never crash the worker loop
        logger.exception("run_publish_job failed for job %s", job_id)
        db.rollback()
        try:
            failed = db.query(PublishJob).filter(PublishJob.id == job_id).first()
            if failed is not None:
                failed.status = PublishJobStatus.failed
                failed.error_message = str(exc)[:1000]
                db.add(failed)
                db.commit()
        except Exception:  # noqa: BLE001
            logger.exception("run_publish_job: could not mark job %s failed", job_id)
            db.rollback()
        return {"job_id": job_id, "status": PublishJobStatus.failed.value}
    finally:
        db.close()


@celery.task(name="app.workers.publishing.scan_due_publish_jobs")
def scan_due_publish_jobs() -> dict:
    """Celery-beat task (every minute): dispatch scheduled jobs that are due."""
    db = SessionLocal()
    try:
        now = datetime.now(UTC)
        due = (
            db.query(PublishJob)
            .filter(
                PublishJob.status == PublishJobStatus.scheduled,
                PublishJob.scheduled_at.isnot(None),
                PublishJob.scheduled_at <= now,
            )
            .all()
        )
        job_ids = [job.id for job in due]
        for job in due:
            job.status = PublishJobStatus.publishing
            db.add(job)
        db.commit()

        for job_id in job_ids:
            run_publish_job.delay(job_id)

        if job_ids:
            logger.info("scan_due_publish_jobs: dispatched %s job(s): %s", len(job_ids), job_ids)
        return {"dispatched": len(job_ids), "job_ids": job_ids}
    except Exception:  # noqa: BLE001
        logger.exception("scan_due_publish_jobs failed")
        db.rollback()
        return {"dispatched": 0, "job_ids": []}
    finally:
        db.close()
