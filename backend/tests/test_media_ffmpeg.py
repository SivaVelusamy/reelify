"""Tests for the ffmpeg media helpers (app.media.ffmpeg).

Pure-function tests always run; the two integration tests that shell out to
ffmpeg are skipped when the binary is not on PATH (local dev / CI without it).
"""

import os
import subprocess

import pytest

from app.media import ffmpeg as media

pytestmark = pytest.mark.filterwarnings("ignore")


def test_hex_to_ass_bgr_order():
    # #112233 -> R=11 G=22 B=33 -> &H332211&
    assert media._hex_to_ass("#112233", "#000000") == "&H332211&"
    assert media._hex_to_ass("#abc", "#000000") == "&HCCBBAA&"
    assert media._hex_to_ass(None, "#FFFFFF") == "&HFFFFFF&"
    assert media._hex_to_ass("garbage", "#000000") == "&H000000&"


def test_force_style_positions_and_backgrounds():
    solid = media.CaptionStyle(position="top", background_style="solid").force_style(1920)
    assert "Alignment=8" in solid and "BorderStyle=3" in solid
    none = media.CaptionStyle(background_style="none").force_style(1920)
    assert "Outline=0" in none and "Shadow=0" in none


def test_write_srt_relative_and_absolute(tmp_path):
    dest = tmp_path / "c.srt"
    ok = media.write_srt(
        [
            {"start": 0.0, "end": 1.5, "text": "hello"},
            {"start": 2.0, "end": 3.0, "text": "world"},
            {"start": 0.0, "end": 0.0, "text": ""},  # dropped
        ],
        str(dest),
        clip_start=10.0,
        clip_duration=5.0,
    )
    assert ok
    body = dest.read_text()
    assert "hello" in body and "world" in body
    assert "00:00:00,000 --> 00:00:01,500" in body


def test_write_srt_empty_returns_false(tmp_path):
    assert media.write_srt([], str(tmp_path / "x.srt"), clip_start=0, clip_duration=5) is False


def test_reframe_filter_auto_vs_manual():
    auto = media._reframe_filter(
        media.RenderRequest(source_path="s", output_path="o", start_seconds=0, end_seconds=1),
        1080, 1920,
    )
    assert "crop=" in auto and "scale=1080:1920" in auto
    manual = media._reframe_filter(
        media.RenderRequest(
            source_path="s", output_path="o", start_seconds=0, end_seconds=1,
            reframe_mode="manual", crop_config={"x": 0.1, "y": 0.0, "w": 0.5, "h": 1.0},
        ),
        1080, 1920,
    )
    assert "iw*0.5000" in manual and "ih*1.0000" in manual


# --------------------------------------------------------------------------- #
# Integration: real ffmpeg
# --------------------------------------------------------------------------- #
ffmpeg_only = pytest.mark.skipif(
    not media.ffmpeg_available(), reason="ffmpeg/ffprobe not installed"
)


@pytest.fixture
def sample_source(tmp_path):
    """A 3s 640x360 test clip with a tone."""
    path = tmp_path / "src.mp4"
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-f", "lavfi", "-i", "testsrc=size=640x360:rate=24:duration=3",
            "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
            "-c:v", "libx264", "-t", "3", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-shortest", str(path),
        ],
        check=True, capture_output=True,
    )
    return str(path)


@ffmpeg_only
def test_render_clip_produces_vertical_video(tmp_path, sample_source):
    out = tmp_path / "clip.mp4"
    media.render_clip(
        media.RenderRequest(
            source_path=sample_source,
            output_path=str(out),
            start_seconds=0.5,
            end_seconds=2.0,
            aspect_ratio="9:16",
            caption_segments=[{"start": 0.0, "end": 1.0, "text": "Hi there"}],
            caption_style=media.CaptionStyle(position="bottom", background_style="solid"),
            subtitle_path=str(tmp_path / "c.srt"),
        )
    )
    assert out.exists() and out.stat().st_size > 1000
    dims = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=width,height", "-of", "csv=p=0", str(out),
        ],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    assert dims == "1080,1920"
    dur = media.probe_duration(str(out))
    assert dur is not None and 1.3 < dur < 1.8


@ffmpeg_only
def test_export_clip_pads_to_resolution(tmp_path, sample_source):
    render = tmp_path / "r.mp4"
    media.render_clip(
        media.RenderRequest(
            source_path=sample_source, output_path=str(render),
            start_seconds=0.0, end_seconds=2.0, aspect_ratio="9:16",
        )
    )
    out = tmp_path / "export.mp4"
    media.export_clip(str(render), str(out), "720x1280")
    assert out.exists() and os.path.getsize(out) > 1000
    dims = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=width,height", "-of", "csv=p=0", str(out),
        ],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    assert dims == "720,1280"
