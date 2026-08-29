"""Reelify async media pipeline (Celery).

Chain:

    ingest_source_video -> transcribe -> analyze -> finalize

Each stage runs inside :func:`_pipeline_stage`, which opens a DB session, and on
any exception sets ``SourceVideo.status = failed`` + ``error_message`` and
re-raises. The next stage is only enqueued when the current one succeeds.

``ingest`` downloads YouTube sources via a self-hosted **cobalt** API when
``COBALT_API_URL`` is set, falling back to **yt-dlp** on any failure (yt-dlp is
also the only path when cobalt is not configured).

``transcribe`` runs real speech-to-text via :mod:`app.media.transcription`
(local faster-whisper by default, OpenAI when a key is set, stub as a last
resort). ``analyze`` still uses a heuristic ranker, and ``finalize`` only sends
email if an ``app.services.email_service`` module exists.
"""

import functools
import logging
import os
import shutil
import subprocess
import tempfile
from collections.abc import Callable

from app.config import settings
from app.database import SessionLocal
from app.models.clip import Clip, ClipStatus
from app.models.project import (
    SourceType,
    SourceVideo,
    SourceVideoStatus,
    Transcript,
)
from app.workers import celery

logger = logging.getLogger(__name__)

MIN_CLIP_SECONDS = 20.0
MAX_CLIP_SECONDS = 60.0
MAX_SUGGESTED_CLIPS = 10
DEFAULT_DURATION_SECONDS = 600.0
_KEYWORDS = ("important", "key", "takeaway", "remember", "action", "result", "why")


def _pipeline_stage(fn: Callable[..., object]) -> Callable[[int], object]:
    """Wrap a stage ``fn(db, video_id)`` with session + failure handling."""

    @functools.wraps(fn)
    def wrapper(video_id: int) -> object:
        db = SessionLocal()
        try:
            result = fn(db, video_id)
            return result
        except Exception as exc:
            logger.exception(
                "Pipeline stage %s failed for video %s", fn.__name__, video_id
            )
            try:
                video = db.get(SourceVideo, video_id)
                if video is not None:
                    video.status = SourceVideoStatus.failed
                    video.error_message = str(exc)
                    db.commit()
            except Exception:  # pragma: no cover - defensive
                db.rollback()
            raise
        finally:
            db.close()

    return wrapper


def _require_video(db, video_id: int) -> SourceVideo:
    video = db.get(SourceVideo, video_id)
    if video is None:
        raise ValueError(f"SourceVideo {video_id} not found")
    return video


def _probe_duration(source: str) -> float | None:
    """Return media duration in seconds via ffprobe, or ``None`` on failure."""
    try:
        proc = subprocess.run(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                source,
            ],
            capture_output=True,
            text=True,
            timeout=120,
            check=True,
        )
        return float(proc.stdout.strip())
    except (subprocess.SubprocessError, ValueError, FileNotFoundError, OSError) as exc:
        logger.warning("ffprobe failed for %s: %s", source, exc)
        return None


_YT_MAX_BYTES = 2 * 1024 * 1024 * 1024  # 2 GB, matches the file-upload limit
_DOWNLOAD_CHUNK = 1024 * 1024


def _stream_to_file(url: str, dest_path: str, *, headers: dict | None = None) -> None:
    """Download ``url`` to ``dest_path``, aborting if it exceeds the size cap."""
    import httpx

    written = 0
    with httpx.stream("GET", url, headers=headers, follow_redirects=True, timeout=120) as resp:
        resp.raise_for_status()
        with open(dest_path, "wb") as fh:
            for chunk in resp.iter_bytes(_DOWNLOAD_CHUNK):
                written += len(chunk)
                if written > _YT_MAX_BYTES:
                    raise RuntimeError("Video exceeds the 2 GB limit")
                fh.write(chunk)
    if written == 0:
        raise RuntimeError("Downloaded an empty file")


def _download_via_cobalt(url: str, dest_dir: str) -> tuple[str, dict]:
    """Resolve a media URL through a self-hosted cobalt API, then download it."""
    import httpx

    api = settings.COBALT_API_URL.rstrip("/")
    headers = {"Accept": "application/json", "Content-Type": "application/json"}
    if settings.COBALT_API_KEY:
        headers["Authorization"] = f"Api-Key {settings.COBALT_API_KEY}"

    payload = {
        "url": url,
        "videoQuality": str(settings.COBALT_VIDEO_QUALITY),
        "downloadMode": "auto",
        "filenameStyle": "basic",
        "youtubeVideoCodec": "h264",
    }
    resp = httpx.post(f"{api}/", json=payload, headers=headers, timeout=60)
    resp.raise_for_status()
    body = resp.json()
    status_ = body.get("status")

    if status_ in ("tunnel", "redirect"):
        media_url = body["url"]
        filename = body.get("filename") or "video.mp4"
    elif status_ == "picker":
        items = body.get("picker") or []
        videos = [i for i in items if i.get("type") in (None, "video")]
        if not videos:
            raise RuntimeError("cobalt picker returned no video item")
        media_url = videos[0]["url"]
        filename = "video.mp4"
    elif status_ == "error":
        code = (body.get("error") or {}).get("code", "unknown")
        raise RuntimeError(f"cobalt error: {code}")
    else:
        # e.g. "local-processing" (needs client-side muxing) — let yt-dlp handle it.
        raise RuntimeError(f"cobalt returned unsupported status {status_!r}")

    ext = os.path.splitext(filename)[1].lstrip(".").lower() or "mp4"
    dest = os.path.join(dest_dir, f"video.{ext}")
    _stream_to_file(media_url, dest, headers={"Accept": "*/*"})

    title = os.path.splitext(os.path.basename(filename))[0] or "YouTube video"
    return dest, {
        "id": url.rsplit("/", 1)[-1].split("?")[0][:32] or "cobalt",
        "title": title,
        "duration": _probe_duration(dest),
        "language": "en",
    }


def _download_remote_video(url: str, dest_dir: str) -> tuple[str, dict]:
    """cobalt first (when configured), yt-dlp as the fallback."""
    if settings.COBALT_API_URL.strip():
        try:
            path, info = _download_via_cobalt(url, dest_dir)
            logger.info("ingest: cobalt downloaded %s", url)
            return path, info
        except Exception as exc:  # noqa: BLE001 - fall back to yt-dlp
            logger.warning("cobalt download failed (%s); falling back to yt-dlp", exc)
    return _download_youtube(url, dest_dir)


def _download_youtube(url: str, dest_dir: str) -> tuple[str, dict]:
    from yt_dlp import YoutubeDL
    from yt_dlp.utils import DownloadError

    max_h = settings.YT_DLP_MAX_HEIGHT
    opts = {
        # Best <=max_h video + best audio, falling back to a single progressive stream.
        "format": f"bv*[height<={max_h}]+ba/b[height<={max_h}]/bv*+ba/b",
        "outtmpl": os.path.join(dest_dir, "%(id)s.%(ext)s"),
        "merge_output_format": "mp4",
        "noplaylist": True,
        "quiet": True,
        "noprogress": True,
        "retries": 3,
        "socket_timeout": 30,
        "max_filesize": _YT_MAX_BYTES,
    }

    cookies = settings.YT_DLP_COOKIES_FILE.strip()
    if cookies:
        if os.path.isfile(cookies):
            # yt-dlp rewrites the cookie jar after the session, so work on a
            # writable copy — the mounted file is typically read-only.
            work_cookies = os.path.join(dest_dir, "cookies.txt")
            shutil.copyfile(cookies, work_cookies)
            opts["cookiefile"] = work_cookies
            logger.info("yt-dlp: using cookies file %s", cookies)
        else:
            logger.warning("yt-dlp: YT_DLP_COOKIES_FILE=%s not found; continuing without", cookies)

    remote = settings.YT_DLP_REMOTE_COMPONENTS.strip()
    if remote:
        opts["remote_components"] = [remote]

    try:
        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            path = ydl.prepare_filename(info)
    except DownloadError as exc:
        # Surface a clean message on the SourceVideo row (the pipeline wrapper
        # writes str(exc) into error_message).
        raise RuntimeError(f"YouTube download failed: {exc}") from exc

    if not os.path.exists(path):
        base, _ = os.path.splitext(path)
        for ext in (".mp4", ".mkv", ".webm"):
            if os.path.exists(base + ext):
                path = base + ext
                break
    if not os.path.exists(path):
        raise RuntimeError("YouTube download produced no file (video may be unavailable)")
    return path, info


# ---------------------------------------------------------------------------
# Stage 1: ingest
# ---------------------------------------------------------------------------
@celery.task(name="app.workers.pipeline.ingest_source_video")
@_pipeline_stage
def ingest_source_video(db, video_id: int) -> int:
    from app import storage

    video = _require_video(db, video_id)

    if video.source_type == SourceType.youtube_url:
        with tempfile.TemporaryDirectory(prefix="reelify-ingest-") as tmp:
            path, info = _download_remote_video(video.original_url, tmp)
            ext = os.path.splitext(path)[1].lstrip(".").lower() or "mp4"
            content_type = {"webm": "video/webm", "mkv": "video/x-matroska"}.get(
                ext, "video/mp4"
            )
            key = f"sources/{video.user_id}/{video.id}/{os.path.basename(path)}"
            with open(path, "rb") as fh:
                storage.upload_fileobj(key, fh, content_type)
            video.storage_key = key
            video.filename = info.get("title") or os.path.basename(path)
            video.duration_seconds = (
                float(info["duration"]) if info.get("duration") else None
            )
            video.language = info.get("language") or "en"
            logger.info(
                "ingest: downloaded YouTube video %s (%s, %.0fs) -> %s",
                info.get("id"), ext, video.duration_seconds or 0, key,
            )
    else:
        # Upload path: download the object and probe the local file.
        duration = None
        if video.storage_key:
            try:
                with tempfile.TemporaryDirectory(prefix="reelify-probe-") as tmp:
                    local = os.path.join(tmp, "source")
                    storage.download_to_path(video.storage_key, local)
                    duration = _probe_duration(local)
            except Exception as exc:  # pragma: no cover - environment dependent
                logger.warning("Could not probe upload %s: %s", video.storage_key, exc)
        video.duration_seconds = duration or DEFAULT_DURATION_SECONDS
        video.language = video.language or "en"

    if not video.duration_seconds:
        video.duration_seconds = DEFAULT_DURATION_SECONDS
    db.commit()

    transcribe.delay(video_id)
    return video_id


# ---------------------------------------------------------------------------
# Stage 2: transcribe (real speech-to-text via app.media.transcription)
# ---------------------------------------------------------------------------
@celery.task(name="app.workers.pipeline.transcribe")
@_pipeline_stage
def transcribe(db, video_id: int) -> int:
    from app import storage
    from app.media import transcription

    video = _require_video(db, video_id)
    video.status = SourceVideoStatus.transcribing
    db.commit()

    duration = float(video.duration_seconds or DEFAULT_DURATION_SECONDS)
    language = video.language or None

    result = None
    if video.storage_key:
        with tempfile.TemporaryDirectory(prefix="reelify-stt-") as tmp:
            src = os.path.join(tmp, "source")
            try:
                storage.download_to_path(video.storage_key, src)
                result = transcription.transcribe(
                    src, language=language, duration=duration
                )
            except Exception as exc:  # pragma: no cover - environment dependent
                logger.warning("transcribe: could not process %s: %s", video.storage_key, exc)

    if result is None:
        result = transcription.transcribe(
            "", language=language, duration=duration
        )

    if video.transcript is not None:
        db.delete(video.transcript)
        db.flush()

    db.add(
        Transcript(
            source_video_id=video.id,
            language=result.language,
            full_text=result.full_text,
            segments=result.segments,
        )
    )
    if not video.language:
        video.language = result.language
    db.commit()

    analyze.delay(video_id)
    return video_id


# ---------------------------------------------------------------------------
# Stage 3: analyze / rank clip candidates (STUB)
# ---------------------------------------------------------------------------
def _score_window(text: str, start: float, duration: float) -> float:
    length_score = min(len(text) / 400.0, 1.0)
    keyword_hits = sum(text.lower().count(k) for k in _KEYWORDS)
    keyword_score = min(keyword_hits / 5.0, 1.0)
    position_score = (
        1.0 - abs((start / duration) - 0.33) if duration else 0.5
    )
    raw = 0.4 * length_score + 0.4 * keyword_score + 0.2 * position_score
    return round(max(0.0, min(1.0, raw)), 4)


def _candidate_windows(segments: list[dict], duration: float) -> list[dict]:
    windows: list[dict] = []
    n = len(segments)
    for i in range(n):
        w_start = float(segments[i]["start"])
        j = i
        while j < n and float(segments[j]["end"]) - w_start < MIN_CLIP_SECONDS:
            j += 1
        while (
            j + 1 < n
            and float(segments[j + 1]["end"]) - w_start <= MAX_CLIP_SECONDS
        ):
            j += 1
        if j >= n:
            j = n - 1
        w_end = min(float(segments[j]["end"]), w_start + MAX_CLIP_SECONDS)
        if w_end - w_start < MIN_CLIP_SECONDS:
            continue
        text = " ".join(s["text"] for s in segments[i : j + 1])
        windows.append(
            {
                "start": round(w_start, 2),
                "end": round(min(w_end, duration), 2),
                "score": _score_window(text, w_start, duration),
            }
        )
    return windows


@celery.task(name="app.workers.pipeline.analyze")
@_pipeline_stage
def analyze(db, video_id: int) -> int:
    video = _require_video(db, video_id)
    video.status = SourceVideoStatus.analyzing
    db.commit()

    duration = float(video.duration_seconds or DEFAULT_DURATION_SECONDS)
    transcript = video.transcript
    segments = list(transcript.segments) if transcript and transcript.segments else []

    windows = _candidate_windows(segments, duration)
    windows.sort(key=lambda w: w["score"], reverse=True)

    # Clear previous auto-suggestions before regenerating.
    for clip in list(video.clips):
        if clip.status == ClipStatus.suggested:
            db.delete(clip)
    db.flush()

    for rank, window in enumerate(windows[:MAX_SUGGESTED_CLIPS], start=1):
        db.add(
            Clip(
                source_video_id=video.id,
                user_id=video.user_id,
                project_id=video.project_id,
                title=f"Suggested clip {rank}",
                start_seconds=window["start"],
                end_seconds=window["end"],
                score=window["score"],
                rank=rank,
                status=ClipStatus.suggested,
            )
        )
    db.commit()

    finalize.delay(video_id)
    return video_id


# ---------------------------------------------------------------------------
# Stage 4: finalize
# ---------------------------------------------------------------------------
def _send_processing_complete_email(video: SourceVideo) -> None:
    try:
        from app.services import email_service  # type: ignore
    except ImportError:
        logger.info(
            "processing-complete email skipped (no email service) for video %s",
            video.id,
        )
        return
    try:
        email_service.send_processing_complete(video)  # type: ignore[attr-defined]
    except Exception as exc:  # pragma: no cover - depends on provider
        logger.warning("processing-complete email failed for video %s: %s", video.id, exc)


@celery.task(name="app.workers.pipeline.finalize")
@_pipeline_stage
def finalize(db, video_id: int) -> int:
    video = _require_video(db, video_id)
    video.status = SourceVideoStatus.ready
    video.error_message = None
    db.commit()

    _send_processing_complete_email(video)
    return video_id
