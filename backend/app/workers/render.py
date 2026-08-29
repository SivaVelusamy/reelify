"""Celery render + export tasks for Module 3 (Clips).

Both tasks are importable without a running broker and are guarded so that a missing
``ffmpeg`` binary never raises — the heavy media work is STUBBED. The real ffmpeg command
strings are written out in comments so a DEVOPS-AGENT can drop in real execution.
"""

import logging
import shutil
import tempfile

from app.database import SessionLocal
from app.models.clip import Caption, Clip, ClipExport, ClipExportStatus, ClipStatus
from app.storage import upload_fileobj
from app.workers import celery

logger = logging.getLogger(__name__)

# Map aspect-ratio enum value -> target WxH used by the (stubbed) ffmpeg crop/scale.
_ASPECT_DIMENSIONS = {
    "9:16": (1080, 1920),
    "1:1": (1080, 1080),
    "16:9": (1920, 1080),
}


def _ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


@celery.task(name="app.workers.render.render_clip", bind=True)
def render_clip(self, clip_id: int) -> dict:
    """Render a single Clip to its ``render_storage_key`` and mark it ``rendered``.

    Pipeline (conceptual):
      1. Download source video for ``clip.source_video.storage_key``.
      2. Cut the [start_seconds, end_seconds] window.
      3. Reframe / crop to ``clip.aspect_ratio`` (using ``crop_config`` when present).
      4. Burn in captions from ``Caption.segments`` styled by the caption style preset
         (+ ``style_overrides``).
      5. Upload the result and set ``clip.render_storage_key`` + status ``rendered``.

    On any error: log, leave the clip status untouched, and re-raise nothing.
    """
    db = SessionLocal()
    try:
        clip = db.query(Clip).filter(Clip.id == clip_id).first()
        if clip is None:
            logger.warning("render_clip: clip %s not found", clip_id)
            return {"clip_id": clip_id, "status": "not_found"}

        caption = db.query(Caption).filter(Caption.clip_id == clip_id).first()
        aspect_value = (
            clip.aspect_ratio.value
            if hasattr(clip.aspect_ratio, "value")
            else str(clip.aspect_ratio)
        )
        width, height = _ASPECT_DIMENSIONS.get(aspect_value, (1080, 1920))
        source_key = getattr(clip.source_video, "storage_key", None)
        render_key = f"renders/{clip.user_id}/{clip.id}.mp4"

        # --- REAL ffmpeg (STUBBED execution) -------------------------------------
        # subtitles_path = write_ass_from_segments(caption.segments, style_preset, overrides)
        # crop = clip.crop_config or {"x": "(in_w-out_w)/2", "y": "(in_h-out_h)/2"}
        # cmd = [
        #     "ffmpeg", "-y",
        #     "-ss", str(clip.start_seconds),
        #     "-to", str(clip.end_seconds),
        #     "-i", local_source_path,
        #     "-vf", (
        #         f"crop=w={crop.get('w','in_h*9/16')}:h={crop.get('h','in_h')}:"
        #         f"x={crop['x']}:y={crop['y']},"
        #         f"scale={width}:{height},"
        #         f"subtitles={subtitles_path}"
        #     ),
        #     "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
        #     "-c:a", "aac", "-b:a", "128k",
        #     "-movflags", "+faststart",
        #     local_render_path,
        # ]
        # subprocess.run(cmd, check=True, capture_output=True)
        # ----------------------------------------------------------------------
        if not _ffmpeg_available():
            logger.info(
                "render_clip: ffmpeg missing — STUB render for clip %s "
                "(source_key=%s target=%sx%s captions=%s)",
                clip_id,
                source_key,
                width,
                height,
                bool(caption and caption.segments),
            )
        else:
            logger.info(
                "render_clip: ffmpeg present — real render still stubbed for clip %s",
                clip_id,
            )

        with tempfile.NamedTemporaryFile(suffix=".mp4") as placeholder:
            placeholder.write(b"")
            placeholder.flush()
            placeholder.seek(0)
            upload_fileobj(render_key, placeholder, content_type="video/mp4")

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
    """Transcode a rendered Clip into a platform preset and mark the ClipExport ``ready``.

    On error: set ``ClipExport.status = failed``.
    """
    db = SessionLocal()
    try:
        export = db.query(ClipExport).filter(ClipExport.id == export_id).first()
        if export is None:
            logger.warning("export_clip: export %s not found", export_id)
            return {"export_id": export_id, "status": "not_found"}

        clip = db.query(Clip).filter(Clip.id == export.clip_id).first()
        if clip is None or not clip.render_storage_key:
            logger.error(
                "export_clip: export %s has no rendered clip; marking failed", export_id
            )
            export.status = ClipExportStatus.failed
            db.add(export)
            db.commit()
            return {"export_id": export_id, "status": ClipExportStatus.failed.value}

        export.status = ClipExportStatus.rendering
        db.add(export)
        db.commit()

        preset_value = (
            export.preset.value if hasattr(export.preset, "value") else str(export.preset)
        )
        resolution = export.resolution or "1080x1920"
        fmt = export.format or "mp4"
        export_key = f"exports/{clip.user_id}/{export_id}.{fmt}"

        # --- REAL ffmpeg (STUBBED execution) -----------------------------------
        # w, h = resolution.lower().split("x")
        # cmd = [
        #     "ffmpeg", "-y", "-i", local_render_path,
        #     "-vf", f"scale={w}:{h}:force_original_aspect_ratio=decrease,"
        #            f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2",
        #     "-c:v", "libx264", "-profile:v", "high", "-crf", "18",
        #     "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart",
        #     f"{local_export_path}.{fmt}",
        # ]
        # subprocess.run(cmd, check=True, capture_output=True)
        # --------------------------------------------------------------------
        if not _ffmpeg_available():
            logger.info(
                "export_clip: ffmpeg missing — STUB export %s (preset=%s res=%s fmt=%s)",
                export_id,
                preset_value,
                resolution,
                fmt,
            )

        with tempfile.NamedTemporaryFile(suffix=f".{fmt}") as placeholder:
            placeholder.write(b"")
            placeholder.flush()
            placeholder.seek(0)
            upload_fileobj(export_key, placeholder, content_type=f"video/{fmt}")

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
