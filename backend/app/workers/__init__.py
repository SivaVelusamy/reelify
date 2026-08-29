"""Celery application for Reelify async pipeline + scheduled publishing.

Phase 2 agents add task modules under app/workers/ (ingest, transcribe, analyze,
generate_clips, render, export, publishing, bundles, email). autodiscover picks them up.
"""

from celery import Celery

from app.config import settings

celery = Celery(
    "reelify",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    # Tasks are fire-and-forget; do not open a result-backend subscription on
    # enqueue (that path retries for ~20s when Redis is unreachable).
    task_ignore_result=True,
    # Fail fast instead of blocking the request thread when the broker is down.
    broker_connection_retry_on_startup=False,
    broker_transport_options={
        "max_retries": 1,
        "interval_start": 0,
        "interval_step": 0.2,
        "interval_max": 0.5,
    },
)

celery.autodiscover_tasks(["app.workers"])

celery.conf.beat_schedule = {
    "scan-due-publish-jobs": {
        "task": "app.workers.publishing.scan_due_publish_jobs",
        "schedule": 60.0,
    },
}


# Task modules imported explicitly so tasks register on `from app.workers import
# celery` without a running worker; their file names do not match Celery
# autodiscover's default related_name ("tasks").
from app.workers import (  # noqa: F401
    bundles,  # Module 4: Library / Assets
    pipeline,  # Module 2: Projects / Uploads
    publishing,  # Module 8: Publishing / Distribution — real scan_due_publish_jobs
    render,  # Module 3: Clips
)
