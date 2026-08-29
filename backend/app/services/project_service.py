"""Business logic for projects and source-video ingestion.

Every query is scoped by ``user_id``; a row that is missing or owned by another
user raises :class:`NotFoundError` so ownership is never leaked.
"""

import logging
import os
from urllib.parse import urlparse

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app import storage
from app.exceptions import NotFoundError, ValidationError
from app.models.project import (
    BatchUpload,
    BatchUploadStatus,
    Project,
    SourceType,
    SourceVideo,
    SourceVideoStatus,
)
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectUpdate

logger = logging.getLogger(__name__)

MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024  # 2 GB
ALLOWED_YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
}

# Coarse progress hint per pipeline state (0..100).
STATUS_PROGRESS: dict[str, int] = {
    "queued": 5,
    "transcribing": 30,
    "analyzing": 60,
    "clipping": 85,
    "ready": 100,
    "failed": 0,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _enqueue_pipeline(video_id: int) -> None:
    """Kick off the async pipeline; tolerate an unavailable broker."""
    try:
        from app.workers.pipeline import ingest_source_video

        ingest_source_video.delay(video_id)
    except Exception as exc:  # pragma: no cover - broker/environment dependent
        logger.warning("Could not enqueue pipeline for video %s: %s", video_id, exc)


def _storage_key(user_id: int, video_id: int, filename: str) -> str:
    safe = os.path.basename(filename or "source").replace("/", "_") or "source"
    return f"sources/{user_id}/{video_id}/{safe}"


def _fileobj_size(upload: UploadFile) -> int:
    upload.file.seek(0, os.SEEK_END)
    size = upload.file.tell()
    upload.file.seek(0)
    return size


# ---------------------------------------------------------------------------
# Project CRUD
# ---------------------------------------------------------------------------
def list_projects(db: Session, user: User) -> list[Project]:
    return (
        db.query(Project)
        .filter(Project.user_id == user.id)
        .order_by(Project.created_at.desc())
        .all()
    )


def create_project(db: Session, user: User, data: ProjectCreate) -> Project:
    project = Project(
        user_id=user.id,
        title=data.title,
        description=data.description,
        campaign=data.campaign,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def get_project(db: Session, user: User, project_id: int) -> Project:
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user.id)
        .first()
    )
    if project is None:
        raise NotFoundError("Project")
    return project


def list_project_videos(
    db: Session, user: User, project_id: int
) -> list[SourceVideo]:
    get_project(db, user, project_id)  # ownership check / 404
    return (
        db.query(SourceVideo)
        .filter(SourceVideo.project_id == project_id, SourceVideo.user_id == user.id)
        .order_by(SourceVideo.created_at.desc())
        .all()
    )


def update_project(
    db: Session, user: User, project_id: int, data: ProjectUpdate
) -> Project:
    project = get_project(db, user, project_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, user: User, project_id: int) -> None:
    project = get_project(db, user, project_id)
    for video in project.source_videos:
        if video.storage_key:
            _safe_delete_object(video.storage_key)
    db.delete(project)
    db.commit()


# ---------------------------------------------------------------------------
# Source video ingestion
# ---------------------------------------------------------------------------
def create_source_video_from_upload(
    db: Session, user: User, project_id: int, upload_file: UploadFile
) -> SourceVideo:
    get_project(db, user, project_id)  # ownership check

    content_type = (upload_file.content_type or "").lower()
    if not content_type.startswith("video/"):
        raise ValidationError("Uploaded file must be a video (content-type video/*)")

    size = _fileobj_size(upload_file)
    if size <= 0:
        raise ValidationError("Uploaded file is empty")
    if size > MAX_VIDEO_BYTES:
        raise ValidationError("Uploaded file exceeds the 2GB limit")

    video = SourceVideo(
        project_id=project_id,
        user_id=user.id,
        source_type=SourceType.upload,
        filename=os.path.basename(upload_file.filename or "source"),
        status=SourceVideoStatus.queued,
    )
    db.add(video)
    db.commit()
    db.refresh(video)

    key = _storage_key(user.id, video.id, video.filename or "source")
    try:
        storage.upload_fileobj(key, upload_file.file, content_type)
    except Exception as exc:
        video.status = SourceVideoStatus.failed
        video.error_message = f"Upload to storage failed: {exc}"
        db.commit()
        raise

    video.storage_key = key
    db.commit()
    db.refresh(video)

    _enqueue_pipeline(video.id)
    return video


def create_source_video_from_youtube(
    db: Session, user: User, project_id: int, url: str
) -> SourceVideo:
    get_project(db, user, project_id)  # ownership check

    parsed = urlparse(str(url))
    host = (parsed.hostname or "").lower()
    if host not in ALLOWED_YOUTUBE_HOSTS:
        raise ValidationError("URL host must be a youtube.com or youtu.be address")

    video = SourceVideo(
        project_id=project_id,
        user_id=user.id,
        source_type=SourceType.youtube_url,
        original_url=str(url),
        status=SourceVideoStatus.queued,
    )
    db.add(video)
    db.commit()
    db.refresh(video)

    _enqueue_pipeline(video.id)
    return video


def create_batch_upload(
    db: Session,
    user: User,
    project_id: int,
    files: list[UploadFile] | None,
    youtube_urls: list[str] | None,
) -> BatchUpload:
    get_project(db, user, project_id)  # ownership check

    files = files or []
    youtube_urls = [u for u in (youtube_urls or []) if u.strip()]
    total = len(files) + len(youtube_urls)
    if total == 0:
        raise ValidationError("Provide at least one file or YouTube URL")

    batch = BatchUpload(
        user_id=user.id,
        project_id=project_id,
        status=BatchUploadStatus.processing,
        total_items=total,
        completed_items=0,
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    completed = 0
    for upload_file in files:
        try:
            create_source_video_from_upload(db, user, project_id, upload_file)
            completed += 1
        except Exception as exc:
            logger.warning("Batch %s: file ingest failed: %s", batch.id, exc)

    for url in youtube_urls:
        try:
            create_source_video_from_youtube(db, user, project_id, url)
            completed += 1
        except Exception as exc:
            logger.warning("Batch %s: url ingest failed: %s", batch.id, exc)

    batch.completed_items = completed
    batch.status = (
        BatchUploadStatus.completed
        if completed == total
        else BatchUploadStatus.failed
        if completed == 0
        else BatchUploadStatus.processing
    )
    db.commit()
    db.refresh(batch)
    return batch


# ---------------------------------------------------------------------------
# Source video reads / mutations
# ---------------------------------------------------------------------------
def get_video(db: Session, user: User, video_id: int) -> SourceVideo:
    video = (
        db.query(SourceVideo)
        .filter(SourceVideo.id == video_id, SourceVideo.user_id == user.id)
        .first()
    )
    if video is None:
        raise NotFoundError("Source video")
    return video


def get_video_status(db: Session, user: User, video_id: int) -> dict:
    video = get_video(db, user, video_id)
    status_value = (
        video.status.value if hasattr(video.status, "value") else str(video.status)
    )
    return {
        "status": status_value,
        "error_message": video.error_message,
        "progress": STATUS_PROGRESS.get(status_value, 0),
    }


def get_transcript(db: Session, user: User, video_id: int):
    video = get_video(db, user, video_id)
    if video.transcript is None:
        raise NotFoundError("Transcript")
    return video.transcript


def delete_video(db: Session, user: User, video_id: int) -> None:
    video = get_video(db, user, video_id)
    if video.storage_key:
        _safe_delete_object(video.storage_key)
    db.delete(video)
    db.commit()


def reprocess_video(db: Session, user: User, video_id: int) -> SourceVideo:
    video = get_video(db, user, video_id)
    video.status = SourceVideoStatus.queued
    video.error_message = None
    db.commit()
    db.refresh(video)

    _enqueue_pipeline(video.id)
    return video


def _safe_delete_object(key: str) -> None:
    try:
        storage.delete_object(key)
    except Exception as exc:  # pragma: no cover - storage/environment dependent
        logger.warning("Could not delete storage object %s: %s", key, exc)
