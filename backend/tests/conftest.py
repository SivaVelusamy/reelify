"""Shared pytest fixtures for the Reelify backend suite.

Schema is created once per session; every test runs inside an outer transaction
with a SAVEPOINT-based nested session so ``db.commit()`` in app code is real
within the test but rolled back afterwards.

External systems (S3, Celery/Redis, Stripe) are stubbed by the autouse
``_patch_externals`` fixture.
"""

import os
from unittest.mock import MagicMock

# The app reads DATABASE_URL at import time via app.config.Settings — set it
# *before* importing anything under ``app``.
os.environ.setdefault(
    "DATABASE_URL", "postgresql://postgres:postgres@localhost:5590/reelify_test"
)
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

import app.models  # noqa: E402,F401  (registers every table on Base.metadata)
from app.auth.jwt import create_access_token, hash_password  # noqa: E402
from app.config import settings  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models.clip import AspectRatio, Clip, ClipStatus  # noqa: E402
from app.models.project import (  # noqa: E402
    Project,
    SourceType,
    SourceVideo,
    SourceVideoStatus,
    Transcript,
)
from app.models.user import User, UserPlan  # noqa: E402
from app.rate_limit import limiter  # noqa: E402

# Rate limiting would make repeated auth calls flaky across the suite.
limiter.enabled = False


# --------------------------------------------------------------------------- #
# Engine / session
# --------------------------------------------------------------------------- #
@pytest.fixture(scope="session")
def engine():
    eng = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
    Base.metadata.drop_all(eng)
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture()
def db(engine):
    conn = engine.connect()
    outer = conn.begin()
    Session = sessionmaker(
        bind=conn,
        autoflush=False,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    session = Session()
    try:
        yield session
    finally:
        session.close()
        outer.rollback()
        conn.close()


@pytest.fixture()
def client(db):
    def _override_get_db():
        yield db

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_db, None)


# --------------------------------------------------------------------------- #
# External-system stubs
# --------------------------------------------------------------------------- #
class _FakeAsyncResult:
    id = "test-task-id"


class _FakeTask:
    """Stands in for a Celery task object (only ``.delay`` is exercised)."""

    def delay(self, *args, **kwargs):
        return _FakeAsyncResult()

    def __call__(self, *args, **kwargs):  # pragma: no cover - defensive
        return {}


@pytest.fixture(autouse=True)
def _patch_externals(monkeypatch):
    mock_s3 = MagicMock()
    mock_s3.generate_presigned_url.return_value = "https://signed.example/object"
    monkeypatch.setattr("app.storage._client", lambda *a, **k: mock_s3)

    monkeypatch.setattr("app.services.clip_service.render_clip", _FakeTask())
    monkeypatch.setattr("app.services.clip_service.export_clip", _FakeTask())
    monkeypatch.setattr(
        "app.services.publishing_service.run_publish_job", _FakeTask()
    )
    monkeypatch.setattr(
        "app.services.publishing_service._enqueue_render",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        "app.services.project_service._enqueue_pipeline", lambda video_id: None
    )
    monkeypatch.setattr(
        "app.services.library_service._enqueue_bundle",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        "app.services.library_service._enqueue_render",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        "app.services.admin_service._broker_reachable", lambda: False
    )
    yield


# --------------------------------------------------------------------------- #
# Users / auth
# --------------------------------------------------------------------------- #
def _make_user(db, *, email, password="password123", is_admin=False, plan=UserPlan.free):
    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name="Test User",
        is_active=True,
        is_admin=is_admin,
        plan=plan,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def user(db):
    return _make_user(db, email="user@example.com")


@pytest.fixture()
def other_user(db):
    return _make_user(db, email="other@example.com")


@pytest.fixture()
def admin_user(db):
    return _make_user(db, email="admin@example.com", is_admin=True)


def _headers(user):
    token = create_access_token({"sub": str(user.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def auth_headers(user):
    return _headers(user)


@pytest.fixture()
def other_headers(other_user):
    return _headers(other_user)


@pytest.fixture()
def admin_headers(admin_user):
    return _headers(admin_user)


# --------------------------------------------------------------------------- #
# Domain factories
# --------------------------------------------------------------------------- #
def _coerce(enum_cls, value):
    if value is None or isinstance(value, enum_cls):
        return value
    return enum_cls(value)


@pytest.fixture()
def make_project(db):
    def _make(user, *, title="Test Project", campaign=None, description=None):
        project = Project(
            user_id=user.id,
            title=title,
            campaign=campaign,
            description=description,
        )
        db.add(project)
        db.commit()
        db.refresh(project)
        return project

    return _make


@pytest.fixture()
def make_source_video(db, make_project):
    def _make(
        user,
        *,
        project=None,
        status="queued",
        source_type=SourceType.upload,
        duration_seconds=120.0,
        filename="clip.mp4",
        storage_key="sources/x/1/clip.mp4",
        original_url=None,
    ):
        if project is None:
            project = make_project(user)
        video = SourceVideo(
            project_id=project.id,
            user_id=user.id,
            source_type=source_type,
            status=_coerce(SourceVideoStatus, status),
            duration_seconds=duration_seconds,
            filename=filename,
            storage_key=storage_key,
            original_url=original_url,
        )
        db.add(video)
        db.commit()
        db.refresh(video)
        return video

    return _make


@pytest.fixture()
def make_clip(db, make_source_video):
    def _make(
        user,
        *,
        video=None,
        status="rendered",
        start_seconds=1.0,
        end_seconds=15.0,
        rank=None,
        score=None,
        title="A clip",
        aspect_ratio=AspectRatio.vertical,
        render_storage_key=None,
    ):
        if video is None:
            video = make_source_video(user)
        status_enum = _coerce(ClipStatus, status)
        if render_storage_key is None and status_enum == ClipStatus.rendered:
            render_storage_key = f"renders/{user.id}/x.mp4"
        clip = Clip(
            source_video_id=video.id,
            user_id=user.id,
            project_id=video.project_id,
            title=title,
            start_seconds=start_seconds,
            end_seconds=end_seconds,
            rank=rank,
            score=score,
            status=status_enum,
            aspect_ratio=aspect_ratio,
            render_storage_key=render_storage_key,
        )
        db.add(clip)
        db.commit()
        db.refresh(clip)
        return clip

    return _make


@pytest.fixture()
def make_transcript(db):
    def _make(video, *, full_text="the quick brown fox jumps over the lazy dog", segments=None):
        transcript = Transcript(
            source_video_id=video.id,
            language="en",
            full_text=full_text,
            segments=segments or [{"start": 0.0, "end": 5.0, "text": full_text}],
        )
        db.add(transcript)
        db.commit()
        db.refresh(transcript)
        return transcript

    return _make
