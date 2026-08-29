"""Module 5 — Brand Kits & Caption Style Presets API."""

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.brand import BrandKit
from app.models.user import User
from app.schemas.brand import (
    BrandKitCreate,
    BrandKitResponse,
    BrandKitUpdate,
    CaptionStylePresetCreate,
    CaptionStylePresetResponse,
    CaptionStylePresetUpdate,
)
from app.services import brand_service

router = APIRouter(tags=["brand-kits"])


def _kit_response(kit: BrandKit) -> BrandKitResponse:
    body = BrandKitResponse.model_validate(kit)
    body.logo_url = brand_service.brand_kit_logo_url(kit)
    return body


# ---------------------------------------------------------------------------
# Brand kits
# ---------------------------------------------------------------------------
@router.get("/brand-kits", response_model=list[BrandKitResponse])
async def list_brand_kits(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> list[BrandKitResponse]:
    return [_kit_response(k) for k in brand_service.list_brand_kits(db, user)]


@router.post(
    "/brand-kits",
    response_model=BrandKitResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_brand_kit(
    payload: BrandKitCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> BrandKitResponse:
    return _kit_response(brand_service.create_brand_kit(db, user, payload))


@router.get("/brand-kits/{kit_id}", response_model=BrandKitResponse)
async def get_brand_kit(
    kit_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> BrandKitResponse:
    return _kit_response(brand_service.get_brand_kit(db, user, kit_id))


@router.put("/brand-kits/{kit_id}", response_model=BrandKitResponse)
async def update_brand_kit(
    kit_id: int,
    payload: BrandKitUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> BrandKitResponse:
    return _kit_response(brand_service.update_brand_kit(db, user, kit_id, payload))


@router.delete("/brand-kits/{kit_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_brand_kit(
    kit_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> None:
    brand_service.delete_brand_kit(db, user, kit_id)


@router.post("/brand-kits/{kit_id}/logo", response_model=BrandKitResponse)
async def upload_brand_kit_logo(
    kit_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> BrandKitResponse:
    return _kit_response(brand_service.upload_logo(db, user, kit_id, file))


# ---------------------------------------------------------------------------
# Caption style presets
# ---------------------------------------------------------------------------
@router.get("/caption-presets", response_model=list[CaptionStylePresetResponse])
async def list_caption_presets(
    brand_kit_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> list[CaptionStylePresetResponse]:
    return brand_service.list_caption_presets(db, user, brand_kit_id)


@router.post(
    "/caption-presets",
    response_model=CaptionStylePresetResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_caption_preset(
    payload: CaptionStylePresetCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> CaptionStylePresetResponse:
    return brand_service.create_caption_preset(db, user, payload)


@router.put("/caption-presets/{preset_id}", response_model=CaptionStylePresetResponse)
async def update_caption_preset(
    preset_id: int,
    payload: CaptionStylePresetUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> CaptionStylePresetResponse:
    return brand_service.update_caption_preset(db, user, preset_id, payload)


@router.delete(
    "/caption-presets/{preset_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_caption_preset(
    preset_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> None:
    brand_service.delete_caption_preset(db, user, preset_id)
