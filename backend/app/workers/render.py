"""Celery render + export tasks for Module 3 (Clips).

Real ffmpeg pipeline (see ``app.media.ffmpeg``). When ffmpeg/ffprobe are not on
PATH — local dev or CI — the tasks fall back to uploading a tiny placeholder so
the rest of the flow (bundles, exports, downloads) still works.
"""

import logging
import os
import tempfile

from app.database import SessionLocal
from app.media import ffmpeg as media
from app.media.ffmpeg import CaptionStyle, RenderRequest, ffmpeg_available
from app.models.clip import Caption, Clip, ClipExport, ClipExportStatus, ClipStatus
from app.storage import download_to_path, upload_file, upload_fileobj
from app.workers import celery

logger = logging.getLogger(__name__)

_PLACEHOLDER = b"\x00" * 32


def _enum_value(value) -> str:
    return value.value if hasattr(value, "value") else str(value)


def _caption_style(caption: Caption | None) -> CaptionStyle:
    if caption is None:
        return CaptionStyle()
    preset = caption.style_preset
    overrides = caption.style_overrides or {}

    def pick(field: str):
        if field in overrides and overrides[field] is not None:
            return overrides[field]
        return getattr(preset, field, None) if preset is not None else None

    return CaptionStyle(
        font_family=pick("font_family"),
        font_size=pick("font_size"),
        text_color=pick("text_color"),
        highlight_color=pick("highlight_color"),
        background_style=pick("background_style"),
        position=pick("position"),
    )


def _upload_placeholder(key: str, content_type: str) -> None:
    with tempfile.NamedTemporaryFile() as fh:
        fh.write(_PLACEHOLDER)
        fh.flush()
        fh.seek(0)
        upload_fileobj(key, fh, content_type=content_type)


@celery.task(name="app.workers.render.render_clip", bind=True)
def render_clip(self, clip_id: int) -> dict:
    """Trim → reframe → burn captions → upload; then mark the clip ``rendered``."""
    db = SessionLocal()
    try:
        clip = db.query(Clip).filter(Clip.id == clip_id).first()
        if clip is None:
            logger.warning("render_clip: clip %s not found", clip_id)
            return {"clip_id": clip_id, "status": "not_found"}

        caption = db.query(Caption).filter(Caption.clip_id == clip_id).first()
        source_key = getattr(clip.source_video, "storage_key", None)
        render_key = f"renders/{clip.user_id}/{clip.id}.mp4"
        aspect = _enum_value(clip.aspect_ratio)

        if not ffmpeg_available() or not source_key:
            reason = "no source video" if not source_key else "ffmpeg unavailable"
            logger.info(
                "render_clip: %s — placeholder render for clip %s", reason, clip_id
            )
            _upload_placeholder(render_key, "video/mp4")
        else:
            with tempfile.TemporaryDirectory() as tmp:
                src = os.path.join(tmp, "source")
                out = os.path.join(tmp, "clip.mp4")
                srt = os.path.join(tmp, "captions.srt")
                download_to_path(source_key, src)
                media.render_clip(
                    RenderRequest(
                        source_path=src,
                        output_path=out,
                        start_seconds=float(clip.start_seconds),
                        end_seconds=float(clip.end_seconds),
                        aspect_ratio=aspect,
                        reframe_mode=_enum_value(clip.reframe_mode),
                        crop_config=clip.crop_config,
                        caption_segments=(caption.segments or []) if caption else [],
                        caption_style=_caption_style(caption),
                        subtitle_path=srt,
                    )
                )
                upload_file(render_key, out, content_type="video/mp4")

        clip.render_storage_key = render_key
        clip.status = ClipStatus.rendered
        db.add(clip)
        db.commit()
        logger.info("render_clip: clip %s rendered -> %s", clip_id, render_key)
        return {"clip_id": clip_id, "status": ClipStatus.rendered.value}
    except Exception:  # noqa: BLE001 - never let a render crash the worker loop
        logger.exception("render_clip failed for clip %s; leaving status unchanged", clip_id)
        db.rollback()
        return {"clip_id": clip_id, "status": "error"}
    finally:
        db.close()


@celery.task(name="app.workers.render.export_clip", bind=True)
def export_clip(self, export_id: int) -> dict:
    """Transcode a rendered Clip into a platform preset and mark it ``ready``."""
    db = SessionLocal()
    try:
        export = db.query(ClipExport).filter(ClipExport.id == export_id).first()
        if export is None:
            logger.warning("export_clip: export %s not found", export_id)
            return {"export_id": export_id, "status": "not_found"}

        clip = db.query(Clip).filter(Clip.id == export.clip_id).first()
        if clip is None or not clip.render_storage_key:
            logger.error("export_clip: export %s has no rendered clip", export_id)
            export.status = ClipExportStatus.failed
            db.add(export)
            db.commit()
            return {"export_id": export_id, "status": ClipExportStatus.failed.value}

        export.status = ClipExportStatus.rendering
        db.add(export)
        db.commit()

        fmt = export.format or "mp4"
        resolution = export.resolution or "1080x1920"
        export_key = f"exports/{clip.user_id}/{export_id}.{fmt}"

        if not ffmpeg_available():
            logger.info("export_clip: ffmpeg missing — placeholder export %s", export_id)
            _upload_placeholder(export_key, f"video/{fmt}")
        else:
            with tempfile.TemporaryDirectory() as tmp:
                render = os.path.join(tmp, "render.mp4")
                out = os.path.join(tmp, f"export.{fmt}")
                download_to_path(clip.render_storage_key, render)
                media.export_clip(render, out, resolution)
                upload_file(export_key, out, content_type=f"video/{fmt}")

        export.storage_key = export_key
        export.status = ClipExportStatus.ready
        db.add(export)
        db.commit()
        logger.info("export_clip: export %s ready -> %s", export_id, export_key)
        return {"export_id": export_id, "status": ClipExportStatus.ready.value}
    except Exception:  # noqa: BLE001
        logger.exception("export_clip failed for export %s; marking failed", export_id)
        db.rollback()
        try:
            failed = db.query(ClipExport).filter(ClipExport.id == export_id).first()
            if failed is not None:
                failed.status = ClipExportStatus.failed
                db.add(failed)
                db.commit()
        except Exception:  # noqa: BLE001
            logger.exception("export_clip: could not mark export %s failed", export_id)
            db.rollback()
        return {"export_id": export_id, "status": ClipExportStatus.failed.value}
    finally:
        db.close()
