"""Projects / Uploads API (PRP Module 2).

Routes are mounted under ``/api/v1`` by ``app.main``. Every route requires an
authenticated, active user and is scoped to that user's own rows.
"""

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.orm import Session

from app.billing_guard import require_within_usage_limit
from app.dependencies import get_current_active_user, get_db
from app.exceptions import ValidationError
from app.models.user import User
from app.schemas.project import (
    BatchUploadResponse,
    ProjectCreate,
    ProjectResponse,
    ProjectUpdate,
    SourceVideoResponse,
    SourceVideoStatusResponse,
    TranscriptResponse,
)
from app.services import project_service

router = APIRouter(tags=["projects"])


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------
@router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> list[ProjectResponse]:
    return project_service.list_projects(db, user)


@router.post(
    "/projects",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> ProjectResponse:
    return project_service.create_project(db, user, payload)


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> ProjectResponse:
    return project_service.get_project(db, user, project_id)


@router.get(
    "/projects/{project_id}/videos",
    response_model=list[SourceVideoResponse],
)
async def list_project_videos(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> list[SourceVideoResponse]:
    return project_service.list_project_videos(db, user, project_id)


@router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> ProjectResponse:
    return project_service.update_project(db, user, project_id, payload)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> None:
    project_service.delete_project(db, user, project_id)


# ---------------------------------------------------------------------------
# Source videos — ingestion
# ---------------------------------------------------------------------------
@router.post(
    "/projects/{project_id}/videos",
    response_model=SourceVideoResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_within_usage_limit)],
)
async def add_source_video(
    project_id: int,
    file: UploadFile | None = File(default=None),
    url: str | None = Form(default=None),
    youtube_url: str | None = Form(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> SourceVideoResponse:
    """Accept a multipart video ``file`` OR a YouTube ``url`` form field."""
    if file is not None:
        return project_service.create_source_video_from_upload(
            db, user, project_id, file
        )
    link = (url or youtube_url or "").strip()
    if link:
        return project_service.create_source_video_from_youtube(
            db, user, project_id, link
        )
    raise ValidationError("Provide either a video file or a YouTube url")


@router.post(
    "/projects/{project_id}/videos/batch",
    response_model=BatchUploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_within_usage_limit)],
)
async def add_source_videos_batch(
    project_id: int,
    files: list[UploadFile] | None = File(default=None),
    youtube_urls: list[str] | None = Form(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> BatchUploadResponse:
    return project_service.create_batch_upload(
        db, user, project_id, files, youtube_urls
    )


# ---------------------------------------------------------------------------
# Source videos — reads / lifecycle
# ---------------------------------------------------------------------------
@router.get("/videos/{video_id}", response_model=SourceVideoResponse)
async def get_video(
    video_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> SourceVideoResponse:
    return project_service.get_video(db, user, video_id)


@router.get("/videos/{video_id}/status", response_model=SourceVideoStatusResponse)
async def get_video_status(
    video_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> SourceVideoStatusResponse:
    return SourceVideoStatusResponse(
        **project_service.get_video_status(db, user, video_id)
    )


@router.get("/videos/{video_id}/transcript", response_model=TranscriptResponse)
async def get_video_transcript(
    video_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> TranscriptResponse:
    return project_service.get_transcript(db, user, video_id)


@router.post(
    "/videos/{video_id}/reprocess",
    response_model=SourceVideoResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_within_usage_limit)],
)
async def reprocess_video(
    video_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> SourceVideoResponse:
    return project_service.reprocess_video(db, user, video_id)


@router.delete("/videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_video(
    video_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> None:
    project_service.delete_video(db, user, video_id)
