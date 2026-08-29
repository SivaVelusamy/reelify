"""ffmpeg-backed clip rendering and export.

Pure media helpers: no DB, no object storage. Callers download inputs to local
paths, invoke these functions, then upload the results.

Requires the ``ffmpeg`` / ``ffprobe`` binaries on PATH (present in the backend
Docker image). ``ffmpeg_available()`` lets callers fall back to a stub when they
are missing (local dev / CI without ffmpeg).
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

# Target pixel dimensions per aspect-ratio value.
ASPECT_DIMENSIONS: dict[str, tuple[int, int]] = {
    "9:16": (1080, 1920),
    "1:1": (1080, 1080),
    "16:9": (1920, 1080),
}

# Caption vertical placement -> libass Alignment (numpad layout, all centred).
_ALIGNMENT = {"top": 8, "middle": 5, "bottom": 2}

_FONT_FALLBACK = "DejaVu Sans"


class FFmpegError(RuntimeError):
    """Raised when an ffmpeg/ffprobe invocation exits non-zero."""


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def _run(cmd: list[str]) -> None:
    logger.info("ffmpeg: %s", " ".join(cmd))
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        stderr = proc.stderr or ""
        # Prefer the error-looking lines over the (very long) build-config banner.
        hits = [
            ln for ln in stderr.splitlines()
            if any(k in ln.lower() for k in ("error", "invalid", "no such", "unable", "failed"))
        ]
        detail = " | ".join(hits[-5:]) if hits else stderr[-1500:]
        logger.error("ffmpeg failed (%s): %s", proc.returncode, stderr[-3000:])
        raise FFmpegError(f"{cmd[0]} exited {proc.returncode}: {detail}")


def probe_duration(path: str) -> float | None:
    """Return media duration in seconds, or None if it cannot be determined."""
    try:
        out = subprocess.run(
            [
                "ffprobe", "-v", "error", "-show_entries", "format=duration",
                "-of", "json", path,
            ],
            capture_output=True, text=True, check=True,
        ).stdout
        return float(json.loads(out)["format"]["duration"])
    except (subprocess.CalledProcessError, KeyError, ValueError, json.JSONDecodeError):
        return None


# --------------------------------------------------------------------------- #
# Colour + subtitle helpers
# --------------------------------------------------------------------------- #
def _hex_to_ass(color: str | None, default: str) -> str:
    """`#RRGGBB` (or `#RGB`) -> libass `&HBBGGRR&`. Falls back to `default`."""
    value = (color or default).lstrip("#")
    if len(value) == 3:
        value = "".join(c * 2 for c in value)
    if len(value) != 6:
        value = default.lstrip("#")
    rr, gg, bb = value[0:2], value[2:4], value[4:6]
    return f"&H{bb}{gg}{rr}&".upper()


def _srt_ts(seconds: float) -> str:
    """Standard SRT timestamp: ``HH:MM:SS,mmm``."""
    seconds = max(0.0, seconds)
    ms = round(seconds * 1000)
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


@dataclass
class CaptionStyle:
    font_family: str | None = None
    font_size: int | None = None
    text_color: str | None = None
    highlight_color: str | None = None
    background_style: str | None = None  # none | solid | outline | shadow
    position: str | None = None          # top | middle | bottom

    def force_style(self, video_height: int) -> str:
        size = self.font_size or max(28, round(video_height * 0.045))
        primary = _hex_to_ass(self.text_color, "#FFFFFF")
        outline_col = _hex_to_ass(self.highlight_color, "#000000")
        align = _ALIGNMENT.get((self.position or "bottom").lower(), 2)
        bg = (self.background_style or "outline").lower()
        # BorderStyle 1 = outline+shadow, 3 = opaque box
        if bg == "solid":
            border_style, outline, shadow = 3, 4, 0
        elif bg == "shadow":
            border_style, outline, shadow = 1, 0, 3
        elif bg == "none":
            border_style, outline, shadow = 1, 0, 0
        else:  # outline
            border_style, outline, shadow = 1, 3, 1
        parts = [
            f"FontName={self.font_family or _FONT_FALLBACK}",
            f"FontSize={size}",
            f"PrimaryColour={primary}",
            f"OutlineColour={outline_col}",
            "BackColour=&H80000000&",
            f"BorderStyle={border_style}",
            f"Outline={outline}",
            f"Shadow={shadow}",
            f"Alignment={align}",
            "MarginV=48",
        ]
        return ",".join(parts)


def write_srt(segments: list[dict], dest: str, *, clip_start: float, clip_duration: float) -> bool:
    """Write caption segments to an SRT file. Times are treated as relative to the
    clip; a segment whose start looks absolute (>= clip_duration) is shifted by
    ``clip_start``. Returns False if there is nothing to write."""
    lines: list[str] = []
    index = 1
    for seg in segments or []:
        text = str(seg.get("text", "")).strip()
        if not text:
            continue
        start = float(seg.get("start", 0) or 0)
        end = float(seg.get("end", start) or start)
        if start >= clip_duration or end > clip_duration + 0.5:
            start -= clip_start
            end -= clip_start
        start = max(0.0, start)
        end = min(clip_duration, max(end, start + 0.3))
        if start >= clip_duration:
            continue
        lines.append(str(index))
        lines.append(f"{_srt_ts(start)} --> {_srt_ts(end)}")
        lines.append(text)
        lines.append("")
        index += 1
    if index == 1:
        return False
    Path(dest).write_text("\n".join(lines), encoding="utf-8")
    return True


# --------------------------------------------------------------------------- #
# Render + export
# --------------------------------------------------------------------------- #
@dataclass
class RenderRequest:
    source_path: str
    output_path: str
    start_seconds: float
    end_seconds: float
    aspect_ratio: str = "9:16"
    reframe_mode: str = "auto"                # auto | manual
    crop_config: dict | None = None          # {x,y,w,h} as 0..1 fractions
    caption_segments: list[dict] = field(default_factory=list)
    caption_style: CaptionStyle = field(default_factory=CaptionStyle)
    subtitle_path: str | None = None         # scratch path for the generated .srt


def _reframe_filter(req: RenderRequest, width: int, height: int) -> str:
    """Crop the input to the target aspect then scale to WxH."""
    crop = req.crop_config or {}
    if req.reframe_mode == "manual" and {"w", "h"} <= set(crop):
        x = float(crop.get("x", 0.0))
        y = float(crop.get("y", 0.0))
        w = float(crop["w"])
        h = float(crop["h"])
        crop_expr = (
            f"crop=w=iw*{w:.4f}:h=ih*{h:.4f}:x=iw*{x:.4f}:y=ih*{y:.4f}"
        )
    else:
        # Auto: cover the frame at the target ratio, centre-crop.
        crop_expr = (
            f"crop='min(iw,ih*{width}/{height})':'min(ih,iw*{height}/{width})'"
            f":'(iw-ow)/2':'(ih-oh)/2'"
        )
    return f"{crop_expr},scale={width}:{height}:flags=lanczos,setsar=1"


def render_clip(req: RenderRequest) -> None:
    """Trim -> reframe -> (optional) burn captions -> H.264/AAC mp4 at output_path."""
    width, height = ASPECT_DIMENSIONS.get(req.aspect_ratio, (1080, 1920))
    duration = max(0.1, req.end_seconds - req.start_seconds)
    vf = _reframe_filter(req, width, height)

    subs_ok = False
    if req.caption_segments and req.subtitle_path:
        subs_ok = write_srt(
            req.caption_segments, req.subtitle_path,
            clip_start=req.start_seconds, clip_duration=duration,
        )
    if subs_ok:
        style = req.caption_style.force_style(height).replace("'", r"\'")
        sub_path = req.subtitle_path.replace("\\", "/").replace(":", r"\:")
        vf += f",subtitles='{sub_path}':force_style='{style}'"

    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{req.start_seconds:.3f}",
        "-i", req.source_path,
        "-t", f"{duration:.3f}",
        "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", vf,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart",
        req.output_path,
    ]
    _run(cmd)


def export_clip(render_path: str, output_path: str, resolution: str | None) -> None:
    """Transcode a finished render to a target resolution (letterboxed/padded)."""
    if resolution and "x" in resolution.lower():
        w, h = (int(p) for p in resolution.lower().split("x", 1))
    else:
        w, h = 1080, 1920
    vf = (
        f"scale={w}:{h}:force_original_aspect_ratio=decrease,"
        f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1"
    )
    cmd = [
        "ffmpeg", "-y", "-i", render_path,
        "-map", "0:v:0", "-map", "0:a:0?",
        "-vf", vf,
        "-c:v", "libx264", "-preset", "medium", "-profile:v", "high", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k",
        "-movflags", "+faststart",
        output_path,
    ]
    _run(cmd)
