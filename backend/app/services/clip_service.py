"""Business logic for Module 3 (Clips): candidates, editing, render, preview, export.

Every function is ownership-scoped: a row that exists but belongs to another user is
treated exactly like a missing row (``NotFoundError``).
"""

import logging

from sqlalchemy.orm import Session

from app.exceptions import NotFoundError, ValidationError
from app.models.brand import CaptionStylePreset
from app.models.clip import (
    Caption,
    Clip,
    ClipExport,
    ClipExportStatus,
    ClipStatus,
)
from app.models.project import SourceVideo
from app.models.user import User
from app.schemas.clip import (
    CaptionUpdate,
    ClipUpdate,
    ExportCreate,
    ManualClipCreate,
)
from app.storage import generate_presigned_url
from app.workers.render import export_clip, render_clip

logger = logging.getLogger(__name__)


def _get_owned_source_video(db: Session, user: User, video_id: int) -> SourceVideo:
    video = (
        db.query(SourceVideo)
        .filter(SourceVideo.id == video_id, SourceVideo.user_id == user.id)
        .first()
    )
    if video is None:
        raise NotFoundError("Source video")
    return video


def _get_owned_clip(db: Session, user: User, clip_id: int) -> Clip:
    clip = (
        db.query(Clip)
        .filter(Clip.id == clip_id, Clip.user_id == user.id)
        .first()
    )
    if clip is None:
        raise NotFoundError("Clip")
    return clip


def list_candidates(db: Session, user: User, video_id: int) -> list[Clip]:
    """Ranked clip candidates for a source video, ordered by ``rank`` ascending."""
    _get_owned_source_video(db, user, video_id)
    return (
        db.query(Clip)
        .filter(Clip.source_video_id == video_id, Clip.user_id == user.id)
        .order_by(Clip.rank.asc().nullslast(), Clip.score.desc().nullslast())
        .all()
    )


def create_manual_clip(
    db: Session, user: User, video_id: int, payload: ManualClipCreate
) -> Clip:
    """Create a user-defined clip (status ``draft``) validated against source duration."""
    video = _get_owned_source_video(db, user, video_id)

    if payload.start_seconds >= payload.end_seconds:
        raise ValidationError("start_seconds must be less than end_seconds")

    duration = video.duration_seconds
    if duration is not None and payload.end_seconds > duration + 0.5:
        raise ValidationError(
            f"Clip end ({payload.end_seconds}s) exceeds source duration ({duration}s)"
        )

    clip = Clip(
        source_video_id=video.id,
        user_id=user.id,
        project_id=video.project_id,
        title=payload.title,
        start_seconds=payload.start_seconds,
        end_seconds=payload.end_seconds,
        status=ClipStatus.draft,
    )
    db.add(clip)
    db.commit()
    db.refresh(clip)
    logger.info("Created manual clip %s for video %s", clip.id, video_id)
    return clip


def get_clip(db: Session, user: User, clip_id: int) -> Clip:
    return _get_owned_clip(db, user, clip_id)


def update_clip(
    db: Session, user: User, clip_id: int, payload: ClipUpdate
) -> Clip:
    """Update trim / reframe / crop / title / status. Promotes ``suggested`` -> ``draft``."""
    clip = _get_owned_clip(db, user, clip_id)
    data = payload.model_dump(exclude_unset=True)

    new_start = data.get("start_seconds", clip.start_seconds)
    new_end = data.get("end_seconds", clip.end_seconds)
    if new_start is not None and new_end is not None and new_start >= new_end:
        raise ValidationError("start_seconds must be less than end_seconds")

    for field, value in data.items():
        setattr(clip, field, value)

    if "status" not in data and clip.status == ClipStatus.suggested:
        clip.status = ClipStatus.draft

    db.add(clip)
    db.commit()
    db.refresh(clip)
    return clip


def update_captions(
    db: Session, user: User, clip_id: int, payload: CaptionUpdate
) -> Caption:
    """Upsert the 1:1 Caption row for a clip (text segments + style)."""
    clip = _get_owned_clip(db, user, clip_id)

    if payload.style_preset_id is not None:
        owns_preset = (
            db.query(CaptionStylePreset.id)
            .filter(
                CaptionStylePreset.id == payload.style_preset_id,
                CaptionStylePreset.user_id == user.id,
            )
            .first()
        )
        if owns_preset is None:
            raise NotFoundError("Caption style preset")

    caption = db.query(Caption).filter(Caption.clip_id == clip.id).first()
    if caption is None:
        caption = Caption(clip_id=clip.id)

    caption.segments = payload.segments
    caption.style_preset_id = payload.style_preset_id
    caption.style_overrides = payload.style_overrides

    if clip.status == ClipStatus.suggested:
        clip.status = ClipStatus.draft
        db.add(clip)

    db.add(caption)
    db.commit()
    db.refresh(caption)
    return caption


def enqueue_render(db: Session, user: User, clip_id: int) -> str | None:
    """Enqueue an async render of the clip. Sets nothing synchronously; returns job id."""
    clip = _get_owned_clip(db, user, clip_id)
    async_result = render_clip.delay(clip.id)
    job_id = getattr(async_result, "id", None)
    logger.info("Enqueued render for clip %s (job=%s)", clip.id, job_id)
    return job_id


def get_preview_url(db: Session, user: User, clip_id: int) -> tuple[str, int]:
    """Presigned URL for the rendered proxy, falling back to the source video."""
    clip = _get_owned_clip(db, user, clip_id)
    key = clip.render_storage_key
    if not key:
        source = db.query(SourceVideo).filter(SourceVideo.id == clip.source_video_id).first()
        key = getattr(source, "storage_key", None)
    if not key:
        raise NotFoundError("Clip preview")
    from app.config import settings

    return generate_presigned_url(key), settings.SIGNED_URL_TTL_SECONDS


def create_export(
    db: Session, user: User, clip_id: int, payload: ExportCreate
) -> ClipExport:
    """Create a queued ClipExport row and enqueue the transcode task."""
    clip = _get_owned_clip(db, user, clip_id)

    export = ClipExport(
        clip_id=clip.id,
        preset=payload.preset,
        resolution=payload.resolution,
        format=payload.format,
        status=ClipExportStatus.queued,
    )
    db.add(export)
    db.commit()
    db.refresh(export)

    async_result = export_clip.delay(export.id)
    logger.info(
        "Enqueued export %s for clip %s (job=%s)",
        export.id,
        clip.id,
        getattr(async_result, "id", None),
    )
    return export


def get_export(db: Session, user: User, export_id: int) -> ClipExport:
    """Ownership-scoped ClipExport lookup (joined through the owning Clip)."""
    export = (
        db.query(ClipExport)
        .join(Clip, ClipExport.clip_id == Clip.id)
        .filter(ClipExport.id == export_id, Clip.user_id == user.id)
        .first()
    )
    if export is None:
        raise NotFoundError("Export")
    return export


def get_export_download_url(export: ClipExport) -> str | None:
    if export.status != ClipExportStatus.ready or not export.storage_key:
        return None
    return generate_presigned_url(export.storage_key)


def delete_clip(db: Session, user: User, clip_id: int) -> None:
    """Archive a clip (soft delete via status); hard-delete if still a suggestion."""
    clip = _get_owned_clip(db, user, clip_id)
    if clip.status == ClipStatus.suggested:
        db.delete(clip)
    else:
        clip.status = ClipStatus.archived
        db.add(clip)
    db.commit()
