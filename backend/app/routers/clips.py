"""Module 3 — Clips API: candidates, editor, render, preview, export."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.user import User
from app.schemas.clip import (
    CaptionResponse,
    CaptionUpdate,
    ClipCandidateResponse,
    ClipExportResponse,
    ClipResponse,
    ClipUpdate,
    ExportCreate,
    ManualClipCreate,
    PreviewResponse,
    RenderResponse,
)
from app.services import clip_service

router = APIRouter(tags=["clips"])


@router.get("/videos/{video_id}/clips", response_model=list[ClipCandidateResponse])
async def list_clip_candidates(
    video_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> list[ClipCandidateResponse]:
    return clip_service.list_candidates(db, user, video_id)


@router.post(
    "/videos/{video_id}/clips",
    response_model=ClipResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_manual_clip(
    video_id: int,
    payload: ManualClipCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> ClipResponse:
    return clip_service.create_manual_clip(db, user, video_id, payload)


@router.get("/clips/{clip_id}", response_model=ClipResponse)
async def get_clip(
    clip_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> ClipResponse:
    return clip_service.get_clip(db, user, clip_id)


@router.put("/clips/{clip_id}", response_model=ClipResponse)
async def update_clip(
    clip_id: int,
    payload: ClipUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> ClipResponse:
    return clip_service.update_clip(db, user, clip_id, payload)


@router.put("/clips/{clip_id}/captions", response_model=CaptionResponse)
async def update_clip_captions(
    clip_id: int,
    payload: CaptionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> CaptionResponse:
    return clip_service.update_captions(db, user, clip_id, payload)


@router.post(
    "/clips/{clip_id}/render",
    response_model=RenderResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def render_clip(
    clip_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> RenderResponse:
    job_id = clip_service.enqueue_render(db, user, clip_id)
    clip = clip_service.get_clip(db, user, clip_id)
    return RenderResponse(job_id=job_id, clip_id=clip.id, status=clip.status)


@router.get("/clips/{clip_id}/preview", response_model=PreviewResponse)
async def get_clip_preview(
    clip_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> PreviewResponse:
    url, ttl = clip_service.get_preview_url(db, user, clip_id)
    return PreviewResponse(clip_id=clip_id, preview_url=url, expires_in=ttl)


@router.post(
    "/clips/{clip_id}/export",
    response_model=ClipExportResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def export_clip(
    clip_id: int,
    payload: ExportCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> ClipExportResponse:
    export = clip_service.create_export(db, user, clip_id, payload)
    return ClipExportResponse.model_validate(export)


@router.get("/exports/{export_id}", response_model=ClipExportResponse)
async def get_export(
    export_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> ClipExportResponse:
    export = clip_service.get_export(db, user, export_id)
    body = ClipExportResponse.model_validate(export)
    body.download_url = clip_service.get_export_download_url(export)
    return body


@router.delete("/clips/{clip_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_clip(
    clip_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> None:
    clip_service.delete_clip(db, user, clip_id)
