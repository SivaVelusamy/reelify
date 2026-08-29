"""yt-dlp option wiring in app.workers.pipeline._download_youtube."""

import pytest

from app.workers import pipeline


class _FakeYDL:
    """Captures the opts dict and pretends to download a file."""

    last_opts: dict = {}

    def __init__(self, opts):
        type(self).last_opts = opts
        self._dest = opts["outtmpl"].replace("%(id)s.%(ext)s", "vid.mp4")

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def extract_info(self, url, download=True):
        with open(self._dest, "wb") as fh:
            fh.write(b"\x00" * 64)
        return {"id": "vid", "title": "T", "duration": 12.0, "language": "en"}

    def prepare_filename(self, info):
        return self._dest


@pytest.fixture(autouse=True)
def _fake_ytdl(monkeypatch):
    import yt_dlp

    monkeypatch.setattr(yt_dlp, "YoutubeDL", _FakeYDL)
    _FakeYDL.last_opts = {}


def test_no_cookies_by_default(tmp_path, monkeypatch):
    monkeypatch.setattr(pipeline.settings, "YT_DLP_COOKIES_FILE", "")
    pipeline._download_youtube("https://youtu.be/x", str(tmp_path))
    assert "cookiefile" not in _FakeYDL.last_opts


def test_cookies_file_passed_when_present(tmp_path, monkeypatch):
    src = tmp_path / "src"
    src.mkdir()
    cookies = src / "cookies.txt"
    cookies.write_text("# Netscape HTTP Cookie File\n")
    dest = tmp_path / "dl"
    dest.mkdir()
    monkeypatch.setattr(pipeline.settings, "YT_DLP_COOKIES_FILE", str(cookies))
    pipeline._download_youtube("https://youtu.be/x", str(dest))
    # yt-dlp gets a writable *copy* inside the download dir, not the mounted file.
    used = _FakeYDL.last_opts["cookiefile"]
    assert used == str(dest / "cookies.txt")
    assert (dest / "cookies.txt").read_text() == "# Netscape HTTP Cookie File\n"


def test_missing_cookies_file_is_skipped(tmp_path, monkeypatch):
    monkeypatch.setattr(
        pipeline.settings, "YT_DLP_COOKIES_FILE", str(tmp_path / "nope.txt")
    )
    pipeline._download_youtube("https://youtu.be/x", str(tmp_path))
    assert "cookiefile" not in _FakeYDL.last_opts


def test_max_height_flows_into_format(tmp_path, monkeypatch):
    monkeypatch.setattr(pipeline.settings, "YT_DLP_MAX_HEIGHT", 720)
    pipeline._download_youtube("https://youtu.be/x", str(tmp_path))
    assert "height<=720" in _FakeYDL.last_opts["format"]
