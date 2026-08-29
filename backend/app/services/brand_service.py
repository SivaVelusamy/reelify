"""Business logic for Module 5 — Brand Kits & Caption Style Presets.

Every query is scoped by ``user_id``; a row that is missing or owned by another
user raises :class:`NotFoundError` so ownership is never leaked.
"""

import logging
import os

from fastapi import UploadFile
from sqlalchemy.orm import Session

from app import storage
from app.exceptions import NotFoundError, ValidationError
from app.models.brand import BrandKit, CaptionStylePreset
from app.models.user import User
from app.schemas.brand import (
    BrandKitCreate,
    BrandKitUpdate,
    CaptionStylePresetCreate,
    CaptionStylePresetUpdate,
)

logger = logging.getLogger(__name__)

MAX_LOGO_BYTES = 5 * 1024 * 1024  # 5 MB


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _get_owned_kit(db: Session, user: User, kit_id: int) -> BrandKit:
    kit = (
        db.query(BrandKit)
        .filter(BrandKit.id == kit_id, BrandKit.user_id == user.id)
        .first()
    )
    if kit is None:
        raise NotFoundError("Brand kit")
    return kit


def _get_owned_preset(db: Session, user: User, preset_id: int) -> CaptionStylePreset:
    preset = (
        db.query(CaptionStylePreset)
        .filter(
            CaptionStylePreset.id == preset_id,
            CaptionStylePreset.user_id == user.id,
        )
        .first()
    )
    if preset is None:
        raise NotFoundError("Caption style preset")
    return preset


def _unset_other_defaults(db: Session, user: User, keep_id: int | None) -> None:
    query = db.query(BrandKit).filter(
        BrandKit.user_id == user.id, BrandKit.is_default.is_(True)
    )
    if keep_id is not None:
        query = query.filter(BrandKit.id != keep_id)
    for other in query.all():
        other.is_default = False
        db.add(other)


def _promote_a_default(db: Session, user: User) -> None:
    """Ensure exactly one default remains: promote the oldest kit if none is default."""
    has_default = (
        db.query(BrandKit)
        .filter(BrandKit.user_id == user.id, BrandKit.is_default.is_(True))
        .first()
    )
    if has_default is not None:
        return
    fallback = (
        db.query(BrandKit)
        .filter(BrandKit.user_id == user.id)
        .order_by(BrandKit.id.asc())
        .first()
    )
    if fallback is not None:
        fallback.is_default = True
        db.add(fallback)


def _logo_key(user_id: int, kit_id: int, filename: str) -> str:
    safe = os.path.basename(filename or "logo").replace("/", "_") or "logo"
    return f"brand-kits/{user_id}/{kit_id}/{safe}"


def _upload_size(upload: UploadFile) -> int:
    upload.file.seek(0, os.SEEK_END)
    size = upload.file.tell()
    upload.file.seek(0)
    return size


def brand_kit_logo_url(kit: BrandKit) -> str | None:
    """Presigned GET URL for the kit logo, or ``None`` when there is no logo."""
    if not kit.logo_storage_key:
        return None
    try:
        return storage.generate_presigned_url(kit.logo_storage_key)
    except Exception as exc:  # pragma: no cover - storage/environment dependent
        logger.warning("Could not sign logo URL for kit %s: %s", kit.id, exc)
        return None


# ---------------------------------------------------------------------------
# Brand kit CRUD
# ---------------------------------------------------------------------------
def list_brand_kits(db: Session, user: User) -> list[BrandKit]:
    return (
        db.query(BrandKit)
        .filter(BrandKit.user_id == user.id)
        .order_by(BrandKit.is_default.desc(), BrandKit.id.asc())
        .all()
    )


def get_brand_kit(db: Session, user: User, kit_id: int) -> BrandKit:
    return _get_owned_kit(db, user, kit_id)


def create_brand_kit(db: Session, user: User, data: BrandKitCreate) -> BrandKit:
    is_first = (
        db.query(BrandKit).filter(BrandKit.user_id == user.id).first() is None
    )
    make_default = data.is_default or is_first

    kit = BrandKit(
        user_id=user.id,
        name=data.name,
        is_default=make_default,
        primary_color=data.primary_color,
        secondary_color=data.secondary_color,
        font_family=data.font_family,
        watermark_position=data.watermark_position,
    )
    db.add(kit)
    db.flush()  # assign kit.id before toggling siblings

    if make_default:
        _unset_other_defaults(db, user, keep_id=kit.id)

    db.commit()
    db.refresh(kit)
    logger.info("Created brand kit %s for user %s (default=%s)", kit.id, user.id, make_default)
    return kit


def update_brand_kit(
    db: Session, user: User, kit_id: int, data: BrandKitUpdate
) -> BrandKit:
    kit = _get_owned_kit(db, user, kit_id)
    fields = data.model_dump(exclude_unset=True)

    if "is_default" in fields:
        if fields["is_default"]:
            kit.is_default = True
            _unset_other_defaults(db, user, keep_id=kit.id)
        else:
            kit.is_default = False
        fields.pop("is_default")

    for name, value in fields.items():
        setattr(kit, name, value)

    db.add(kit)
    db.flush()
    _promote_a_default(db, user)  # never leave the user with zero defaults
    db.commit()
    db.refresh(kit)
    return kit


def delete_brand_kit(db: Session, user: User, kit_id: int) -> None:
    kit = _get_owned_kit(db, user, kit_id)
    was_default = kit.is_default
    if kit.logo_storage_key:
        _safe_delete_object(kit.logo_storage_key)

    db.delete(kit)
    db.flush()

    if was_default:
        _promote_a_default(db, user)

    db.commit()
    logger.info("Deleted brand kit %s for user %s", kit_id, user.id)


def upload_logo(
    db: Session, user: User, kit_id: int, file: UploadFile
) -> BrandKit:
    kit = _get_owned_kit(db, user, kit_id)

    content_type = (file.content_type or "").lower()
    if not content_type.startswith("image/"):
        raise ValidationError("Logo must be an image (content-type image/*)")

    size = _upload_size(file)
    if size <= 0:
        raise ValidationError("Uploaded file is empty")
    if size > MAX_LOGO_BYTES:
        raise ValidationError("Logo exceeds the 5MB limit")

    key = _logo_key(user.id, kit.id, file.filename or "logo")
    storage.upload_fileobj(key, file.file, content_type)

    kit.logo_storage_key = key
    db.add(kit)
    db.commit()
    db.refresh(kit)
    logger.info("Stored logo for brand kit %s (%s)", kit.id, key)
    return kit


def _safe_delete_object(key: str) -> None:
    try:
        storage.delete_object(key)
    except Exception as exc:  # pragma: no cover - storage/environment dependent
        logger.warning("Could not delete object %s: %s", key, exc)


# ---------------------------------------------------------------------------
# Caption style preset CRUD
# ---------------------------------------------------------------------------
def _validate_kit_ref(db: Session, user: User, brand_kit_id: int | None) -> None:
    if brand_kit_id is not None:
        _get_owned_kit(db, user, brand_kit_id)


def list_caption_presets(
    db: Session, user: User, brand_kit_id: int | None = None
) -> list[CaptionStylePreset]:
    query = db.query(CaptionStylePreset).filter(
        CaptionStylePreset.user_id == user.id
    )
    if brand_kit_id is not None:
        query = query.filter(CaptionStylePreset.brand_kit_id == brand_kit_id)
    return query.order_by(CaptionStylePreset.id.asc()).all()


def create_caption_preset(
    db: Session, user: User, data: CaptionStylePresetCreate
) -> CaptionStylePreset:
    _validate_kit_ref(db, user, data.brand_kit_id)

    preset = CaptionStylePreset(
        user_id=user.id,
        brand_kit_id=data.brand_kit_id,
        name=data.name,
        font_family=data.font_family,
        font_size=data.font_size,
        text_color=data.text_color,
        highlight_color=data.highlight_color,
        background_style=data.background_style,
        animation=data.animation,
        position=data.position,
    )
    db.add(preset)
    db.commit()
    db.refresh(preset)
    logger.info("Created caption preset %s for user %s", preset.id, user.id)
    return preset


def update_caption_preset(
    db: Session, user: User, preset_id: int, data: CaptionStylePresetUpdate
) -> CaptionStylePreset:
    preset = _get_owned_preset(db, user, preset_id)
    fields = data.model_dump(exclude_unset=True)

    if "brand_kit_id" in fields:
        _validate_kit_ref(db, user, fields["brand_kit_id"])

    for name, value in fields.items():
        setattr(preset, name, value)

    db.add(preset)
    db.commit()
    db.refresh(preset)
    return preset


def delete_caption_preset(db: Session, user: User, preset_id: int) -> None:
    preset = _get_owned_preset(db, user, preset_id)
    db.delete(preset)
    db.commit()
    logger.info("Deleted caption preset %s for user %s", preset_id, user.id)
