"""Tests for app.media.transcription — provider selection, stub, fallbacks."""

import importlib.util

import pytest

from app.media import transcription as stt


def test_transcript_result_cleans_and_filters():
    r = stt.TranscriptResult.from_segments(
        "en",
        [
            {"start": 0, "end": 1.234, "text": "  hello  "},
            {"start": 1.2, "end": 2, "text": ""},          # dropped (empty)
            {"start": 2, "end": 3, "text": "world"},
        ],
    )
    assert [s["text"] for s in r.segments] == ["hello", "world"]
    assert r.segments[0]["end"] == 1.23
    assert r.segments[0]["speaker"] == "SPEAKER_00"
    assert r.full_text == "hello world"


def test_stub_segments_span_duration():
    r = stt._transcribe_stub("", language="en", duration=75.0)
    assert len(r.segments) == 3  # 30 + 30 + 15
    assert r.segments[0]["start"] == 0.0
    assert r.segments[-1]["end"] == 75.0


def test_resolve_provider_prefers_openai_when_key_set(monkeypatch):
    monkeypatch.setattr(stt.settings, "TRANSCRIPTION_PROVIDER", "auto")
    monkeypatch.setattr(stt.settings, "TRANSCRIPTION_API_KEY", "sk-test")
    assert stt._resolve_provider() == "openai"


def test_resolve_provider_explicit_wins(monkeypatch):
    monkeypatch.setattr(stt.settings, "TRANSCRIPTION_PROVIDER", "stub")
    monkeypatch.setattr(stt.settings, "TRANSCRIPTION_API_KEY", "sk-test")
    assert stt._resolve_provider() == "stub"


def test_transcribe_falls_back_to_stub_on_provider_error(monkeypatch):
    monkeypatch.setattr(stt.settings, "TRANSCRIPTION_PROVIDER", "openai")

    def boom(*a, **k):
        raise RuntimeError("network down")

    monkeypatch.setitem(stt._PROVIDERS, "openai", boom)
    r = stt.transcribe("/nonexistent", language="en", duration=40.0)
    assert r.segments and r.segments[0]["text"].startswith("[placeholder")


def test_transcribe_openai_parses_verbose_json(monkeypatch, tmp_path):
    monkeypatch.setattr(stt.settings, "TRANSCRIPTION_PROVIDER", "openai")
    monkeypatch.setattr(stt.settings, "TRANSCRIPTION_API_KEY", "sk-test")
    monkeypatch.setattr(
        stt, "extract_audio", lambda src, dest, **kw: (open(dest, "wb").close() or dest)
    )

    class _Resp:
        def raise_for_status(self):
            pass

        def json(self):
            return {
                "language": "english",
                "segments": [
                    {"start": 0.0, "end": 2.0, "text": "Welcome to the talk."},
                    {"start": 2.0, "end": 4.0, "text": "Today we cover RAG."},
                ],
            }

    import httpx

    monkeypatch.setattr(httpx, "post", lambda *a, **k: _Resp())
    r = stt.transcribe(str(tmp_path / "v.mp4"), duration=4.0)
    assert r.language == "english"
    assert r.full_text == "Welcome to the talk. Today we cover RAG."


@pytest.mark.skipif(
    importlib.util.find_spec("faster_whisper") is None,
    reason="faster-whisper not installed",
)
def test_faster_whisper_path_with_fake_model(monkeypatch, tmp_path):
    monkeypatch.setattr(stt.settings, "TRANSCRIPTION_PROVIDER", "whisper")
    monkeypatch.setattr(stt, "extract_audio", lambda src, dest, **kw: dest)

    class _Seg:
        def __init__(self, s, e, t):
            self.start, self.end, self.text = s, e, t

    class _Info:
        language = "en"

    class _FakeModel:
        def __init__(self, *a, **k):
            pass

        def transcribe(self, *a, **k):
            return iter([_Seg(0.0, 1.5, "hi"), _Seg(1.5, 3.0, "there")]), _Info()

    import faster_whisper

    monkeypatch.setattr(faster_whisper, "WhisperModel", _FakeModel)
    r = stt.transcribe(str(tmp_path / "v.mp4"), duration=3.0)
    assert r.full_text == "hi there"
