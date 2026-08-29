"""Module 4 — Library / Assets API: filtering, FTS, tags, versions, bundles."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.clip import ClipStatus
from app.models.user import User
from app.schemas.library import (
    BundleCreate,
    BundleResponse,
    ClipTagsUpdate,
    ClipVersionResponse,
    LibraryClipResponse,
    PaginatedClips,
    SearchHit,
    TagCreate,
    TagResponse,
)
from app.services import library_service

router = APIRouter(tags=["library"])


@router.get("/library/clips", response_model=PaginatedClips)
async def list_library_clips(
    project_id: int | None = Query(default=None),
    tag_id: int | None = Query(default=None),
    campaign: str | None = Query(default=None),
    status: ClipStatus | None = Query(default=None),  # noqa: A002 - matches API
    page: int = Query(default=1, ge=1),
    per_page: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> PaginatedClips:
    return library_service.list_clips(
        db,
        user,
        project_id=project_id,
        tag_id=tag_id,
        campaign=campaign,
        status=status,
        page=page,
        per_page=per_page,
    )


@router.get("/library/search", response_model=list[SearchHit])
async def search_library(
    q: str = Query(..., min_length=1),
    limit: int = Query(default=50, ge=1, le=100),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> list[SearchHit]:
    return library_service.search(db, user, q, limit=limit)


@router.post("/tags", response_model=TagResponse, status_code=status.HTTP_201_CREATED)
async def create_tag(
    payload: TagCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> TagResponse:
    return library_service.create_tag(db, user, payload)


@router.get("/tags", response_model=list[TagResponse])
async def list_tags(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> list[TagResponse]:
    return library_service.list_tags(db, user)


@router.post("/clips/{clip_id}/tags", response_model=LibraryClipResponse)
async def update_clip_tags(
    clip_id: int,
    payload: ClipTagsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> LibraryClipResponse:
    clip = library_service.attach_tags(
        db, user, clip_id, payload.tag_ids, detach=payload.detach
    )
    return library_service.clip_to_response(clip)


@router.get("/clips/{clip_id}/versions", response_model=list[ClipVersionResponse])
async def list_clip_versions(
    clip_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> list[ClipVersionResponse]:
    return library_service.list_versions(db, user, clip_id)


@router.post("/clips/{clip_id}/restore/{version}", response_model=LibraryClipResponse)
async def restore_clip_version(
    clip_id: int,
    version: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> LibraryClipResponse:
    clip = library_service.restore_version(db, user, clip_id, version)
    return library_service.clip_to_response(clip)


@router.post(
    "/library/bundles",
    response_model=BundleResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_bundle(
    payload: BundleCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> BundleResponse:
    bundle = library_service.create_bundle(db, user, payload.clip_ids)
    return library_service.bundle_to_response(bundle)


@router.get("/library/bundles/{bundle_id}", response_model=BundleResponse)
async def get_bundle(
    bundle_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> BundleResponse:
    bundle = library_service.get_bundle(db, user, bundle_id)
    return library_service.bundle_to_response(bundle)
