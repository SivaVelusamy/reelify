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


# --------------------------------------------------------------------------- #
# cobalt downloader
# --------------------------------------------------------------------------- #
class _FakeResp:
    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self._payload


@pytest.fixture
def _fake_stream(monkeypatch):
    """Stub _stream_to_file to just write a small file; record the URL used."""
    calls = {}

    def fake(url, dest_path, headers=None):
        calls["url"] = url
        with open(dest_path, "wb") as fh:
            fh.write(b"\x00" * 128)

    monkeypatch.setattr(pipeline, "_stream_to_file", fake)
    monkeypatch.setattr(pipeline, "_probe_duration", lambda p: 42.0)
    return calls


def test_cobalt_tunnel_download(tmp_path, monkeypatch, _fake_stream):
    monkeypatch.setattr(pipeline.settings, "COBALT_API_URL", "http://cobalt:9000")
    import httpx

    monkeypatch.setattr(
        httpx, "post",
        lambda *a, **k: _FakeResp(
            {"status": "tunnel", "url": "http://cobalt:9000/tunnel?id=abc",
             "filename": "Great Talk.mp4"}
        ),
    )
    path, info = pipeline._download_via_cobalt("https://youtu.be/xyz", str(tmp_path))
    assert path.endswith(".mp4")
    assert info["title"] == "Great Talk"
    assert info["duration"] == 42.0
    assert _fake_stream["url"] == "http://cobalt:9000/tunnel?id=abc"


def test_cobalt_error_status_raises(tmp_path, monkeypatch):
    monkeypatch.setattr(pipeline.settings, "COBALT_API_URL", "http://cobalt:9000")
    import httpx

    monkeypatch.setattr(
        httpx, "post",
        lambda *a, **k: _FakeResp({"status": "error", "error": {"code": "content.video.unavailable"}}),
    )
    with pytest.raises(RuntimeError, match="content.video.unavailable"):
        pipeline._download_via_cobalt("https://youtu.be/xyz", str(tmp_path))


def test_remote_video_falls_back_to_ytdlp_on_cobalt_failure(tmp_path, monkeypatch):
    monkeypatch.setattr(pipeline.settings, "COBALT_API_URL", "http://cobalt:9000")
    import httpx

    def boom(*a, **k):
        raise httpx.ConnectError("cobalt down")

    monkeypatch.setattr(httpx, "post", boom)
    # yt-dlp is stubbed by the autouse _fake_ytdl fixture.
    path, info = pipeline._download_remote_video("https://youtu.be/xyz", str(tmp_path))
    assert info["id"] == "vid"  # came from the fake yt-dlp


def test_remote_video_uses_ytdlp_when_cobalt_unset(tmp_path, monkeypatch):
    monkeypatch.setattr(pipeline.settings, "COBALT_API_URL", "")
    path, info = pipeline._download_remote_video("https://youtu.be/xyz", str(tmp_path))
    assert info["id"] == "vid"
