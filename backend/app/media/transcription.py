"""Speech-to-text for source videos.

Providers, chosen by ``settings.TRANSCRIPTION_PROVIDER``:

* ``openai``  — POST the extracted audio to an OpenAI-compatible
  ``/audio/transcriptions`` endpoint (``verbose_json`` for timed segments).
* ``whisper`` — local ``faster-whisper`` (downloads the model on first use).
* ``stub``    — evenly-spaced placeholder segments (no audio processing).
* ``auto``    — ``openai`` if an API key is set, else ``whisper`` if the package
  is importable, else ``stub``.

Pure module: callers pass a local media path; no DB or object storage here.
"""

from __future__ import annotations

import logging
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

_STUB_SEGMENT_SECONDS = 30.0


@dataclass
class TranscriptResult:
    language: str
    segments: list[dict] = field(default_factory=list)  # {start, end, text, speaker}
    full_text: str = ""

    @classmethod
    def from_segments(cls, language: str, segments: list[dict]) -> TranscriptResult:
        cleaned = [
            {
                "start": round(float(s["start"]), 2),
                "end": round(float(s["end"]), 2),
                "text": str(s["text"]).strip(),
                "speaker": s.get("speaker", "SPEAKER_00"),
            }
            for s in segments
            if str(s.get("text", "")).strip()
        ]
        return cls(
            language=language,
            segments=cleaned,
            full_text=" ".join(s["text"] for s in cleaned).strip(),
        )


# --------------------------------------------------------------------------- #
# Audio extraction
# --------------------------------------------------------------------------- #
def extract_audio(src_path: str, dest_path: str, *, mp3: bool = False) -> str:
    """Extract mono 16 kHz audio from a media file (wav, or mp3 for upload size)."""
    codec = ["-c:a", "libmp3lame", "-b:a", "64k"] if mp3 else ["-c:a", "pcm_s16le"]
    cmd = [
        "ffmpeg", "-y", "-i", src_path,
        "-vn", "-ac", "1", "-ar", "16000", *codec,
        dest_path,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"audio extraction failed: {(proc.stderr or '')[-800:]}")
    return dest_path


# --------------------------------------------------------------------------- #
# Providers
# --------------------------------------------------------------------------- #
def _resolve_provider() -> str:
    choice = (settings.TRANSCRIPTION_PROVIDER or "auto").lower()
    if choice != "auto":
        return choice
    if settings.TRANSCRIPTION_API_KEY:
        return "openai"
    try:
        import faster_whisper  # noqa: F401

        return "whisper"
    except ImportError:
        return "stub"


def _transcribe_stub(
    _src: str, *, language: str | None, duration: float | None
) -> TranscriptResult:
    total = float(duration or 0) or _STUB_SEGMENT_SECONDS
    segments = []
    start = 0.0
    i = 0
    while start < total:
        end = min(start + _STUB_SEGMENT_SECONDS, total)
        segments.append(
            {"start": start, "end": end, "text": f"[placeholder transcript segment {i + 1}]"}
        )
        start = end
        i += 1
    return TranscriptResult.from_segments(language or "en", segments)


def _transcribe_faster_whisper(
    src: str, *, language: str | None, duration: float | None
) -> TranscriptResult:
    from faster_whisper import WhisperModel

    logger.info(
        "transcription: loading faster-whisper model %r (%s/%s)",
        settings.WHISPER_MODEL, settings.WHISPER_DEVICE, settings.WHISPER_COMPUTE_TYPE,
    )
    model = WhisperModel(
        settings.WHISPER_MODEL,
        device=settings.WHISPER_DEVICE,
        compute_type=settings.WHISPER_COMPUTE_TYPE,
    )
    with tempfile.TemporaryDirectory() as tmp:
        wav = extract_audio(src, str(Path(tmp) / "audio.wav"))
        segments_iter, info = model.transcribe(
            wav, language=language, vad_filter=True, beam_size=1
        )
        segments = [
            {"start": s.start, "end": s.end, "text": s.text} for s in segments_iter
        ]
    return TranscriptResult.from_segments(
        getattr(info, "language", None) or language or "en", segments
    )


def _transcribe_openai(
    src: str, *, language: str | None, duration: float | None
) -> TranscriptResult:
    import httpx

    with tempfile.TemporaryDirectory() as tmp:
        audio = extract_audio(src, str(Path(tmp) / "audio.mp3"), mp3=True)
        with open(audio, "rb") as fh:
            files = {"file": ("audio.mp3", fh, "audio/mpeg")}
            data = {
                "model": settings.OPENAI_TRANSCRIBE_MODEL,
                "response_format": "verbose_json",
                "timestamp_granularities[]": "segment",
            }
            if language:
                data["language"] = language
            resp = httpx.post(
                f"{settings.OPENAI_BASE_URL.rstrip('/')}/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.TRANSCRIPTION_API_KEY}"},
                data=data,
                files=files,
                timeout=600,
            )
    resp.raise_for_status()
    payload = resp.json()
    raw = payload.get("segments") or []
    if raw:
        segments = [
            {"start": s["start"], "end": s["end"], "text": s["text"]} for s in raw
        ]
    else:  # no segment timings -> single block
        text = payload.get("text", "")
        segments = [{"start": 0.0, "end": float(duration or 0.0), "text": text}]
    return TranscriptResult.from_segments(
        payload.get("language") or language or "en", segments
    )


_PROVIDERS = {
    "stub": _transcribe_stub,
    "whisper": _transcribe_faster_whisper,
    "openai": _transcribe_openai,
}


def transcribe(
    src_path: str, *, language: str | None = None, duration: float | None = None
) -> TranscriptResult:
    """Transcribe a media file. Falls back to the stub on any provider failure."""
    provider = _resolve_provider()
    fn = _PROVIDERS.get(provider, _transcribe_stub)
    try:
        result = fn(src_path, language=language, duration=duration)
        if result.segments:
            logger.info(
                "transcription: %s produced %d segments", provider, len(result.segments)
            )
            return result
        logger.warning("transcription: %s produced no segments; using stub", provider)
    except Exception:  # noqa: BLE001 - never fail the pipeline on transcription
        logger.exception("transcription: %s failed; falling back to stub", provider)
    return _transcribe_stub(src_path, language=language, duration=duration)


__all__ = ["TranscriptResult", "transcribe", "extract_audio"]
