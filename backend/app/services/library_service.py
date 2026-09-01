"""Business logic for Module 4 (Library / Assets).

Covers clip listing/filtering, PostgreSQL full-text search (with an ILIKE
fallback for before the search-vector indexer has run), tag management, clip
version history + restore, and bulk-download bundles.

Every query is ownership-scoped: a row that is missing or owned by another user
is treated exactly like a missing row (``NotFoundError``).
"""

import logging

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from app.exceptions import NotFoundError, ValidationError
from app.models.clip import (
    AspectRatio,
    Caption,
    Clip,
    ClipStatus,
    ReframeMode,
)
from app.models.library import (
    ClipVersion,
    DownloadBundle,
    DownloadBundleStatus,
    Tag,
)
from app.models.project import Project, Transcript
from app.models.user import User
from app.schemas.library import (
    BundleResponse,
    LibraryClipResponse,
    PaginatedClips,
    SearchHit,
    TagCreate,
    TagResponse,
)
from app.storage import generate_presigned_url

logger = logging.getLogger(__name__)

_TS_CONFIG = "english"
_HEADLINE_OPTS = (
    "StartSel=<mark>, StopSel=</mark>, MaxFragments=2, "
    "MinWords=3, MaxWords=18, FragmentDelimiter= ... "
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _get_owned_clip(db: Session, user: User, clip_id: int) -> Clip:
    clip = (
        db.query(Clip)
        .filter(Clip.id == clip_id, Clip.user_id == user.id)
        .first()
    )
    if clip is None:
        raise NotFoundError("Clip")
    return clip


def clip_to_response(clip: Clip) -> LibraryClipResponse:
    return LibraryClipResponse(
        id=clip.id,
        source_video_id=clip.source_video_id,
        user_id=clip.user_id,
        project_id=clip.project_id,
        project_title=clip.project.title if clip.project else None,
        title=clip.title,
        start_seconds=clip.start_seconds,
        end_seconds=clip.end_seconds,
        score=clip.score,
        rank=clip.rank,
        status=clip.status,
        aspect_ratio=clip.aspect_ratio,
        reframe_mode=clip.reframe_mode,
        crop_config=clip.crop_config,
        render_storage_key=clip.render_storage_key,
        created_at=clip.created_at,
        updated_at=clip.updated_at,
        tags=[TagResponse.model_validate(t) for t in clip.tags],
    )


# ---------------------------------------------------------------------------
# Clip listing / filtering
# ---------------------------------------------------------------------------
def list_clips(
    db: Session,
    user: User,
    *,
    project_id: int | None = None,
    tag_id: int | None = None,
    campaign: str | None = None,
    status: ClipStatus | None = None,
    page: int = 1,
    per_page: int = 20,
) -> PaginatedClips:
    query = db.query(Clip).filter(Clip.user_id == user.id)

    if project_id is not None:
        query = query.filter(Clip.project_id == project_id)
    if status is not None:
        query = query.filter(Clip.status == status)
    else:
        # Hide archived (deleted) clips unless the caller asks for them.
        query = query.filter(Clip.status != ClipStatus.archived)
    if campaign is not None:
        query = query.join(Project, Clip.project_id == Project.id).filter(
            Project.campaign == campaign
        )
    if tag_id is not None:
        query = query.join(Clip.tags).filter(Tag.id == tag_id)

    total = query.with_entities(func.count(func.distinct(Clip.id))).scalar() or 0

    rows = (
        query.options(
            selectinload(Clip.tags),
            joinedload(Clip.project),
        )
        .order_by(Clip.created_at.desc(), Clip.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    pages = (total + per_page - 1) // per_page if per_page else 0
    return PaginatedClips(
        items=[clip_to_response(c) for c in rows],
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


# ---------------------------------------------------------------------------
# Full-text search
# ---------------------------------------------------------------------------
def search(db: Session, user: User, q: str, *, limit: int = 50) -> list[SearchHit]:
    """Full-text search over transcript bodies + clip titles, ownership-scoped.

    Primary path uses PostgreSQL FTS: ``plainto_tsquery`` matched against the
    ``search_vector`` GIN columns on ``clips`` (title) and ``transcripts``
    (body), ranked with ``ts_rank`` and snippeted with ``ts_headline``.

    The ``search_vector`` columns are populated lazily by an indexer, so if the
    FTS pass yields nothing (columns still NULL) we fall back to a plain
    ``ILIKE`` over ``transcripts.full_text`` + ``clips.title`` so search is
    useful from the first upload.
    """
    q = (q or "").strip()
    if not q:
        return []

    hits: dict[int, SearchHit] = {}
    tsquery = func.plainto_tsquery(_TS_CONFIG, q)

    try:
        title_rows = (
            db.query(
                Clip.id,
                Clip.title,
                func.ts_rank(Clip.search_vector, tsquery).label("rank"),
            )
            .filter(
                Clip.user_id == user.id,
                Clip.status != ClipStatus.archived,
                Clip.search_vector.isnot(None),
                Clip.search_vector.op("@@")(tsquery),
            )
            .all()
        )
        for clip_id, title, rank in title_rows:
            hits[clip_id] = SearchHit(
                clip_id=clip_id,
                title=title,
                snippet=title or "",
                matched_in="title",
                rank=float(rank or 0.0),
            )

        transcript_rows = (
            db.query(
                Clip.id,
                Clip.title,
                func.ts_rank(Transcript.search_vector, tsquery).label("rank"),
                func.ts_headline(
                    _TS_CONFIG, Transcript.full_text, tsquery, _HEADLINE_OPTS
                ).label("snippet"),
            )
            .join(Transcript, Transcript.source_video_id == Clip.source_video_id)
            .filter(
                Clip.user_id == user.id,
                Clip.status != ClipStatus.archived,
                Transcript.search_vector.isnot(None),
                Transcript.search_vector.op("@@")(tsquery),
            )
            .all()
        )
        for clip_id, title, rank, snippet in transcript_rows:
            if clip_id in hits:
                continue
            hits[clip_id] = SearchHit(
                clip_id=clip_id,
                title=title,
                snippet=snippet or "",
                matched_in="transcript",
                rank=float(rank or 0.0),
            )
    except Exception:  # noqa: BLE001 - degrade to ILIKE on any FTS problem
        logger.exception("FTS search failed for %r; falling back to ILIKE", q)
        db.rollback()
        hits = {}

    if hits:
        return sorted(hits.values(), key=lambda h: h.rank, reverse=True)[:limit]

    return _search_ilike(db, user, q, limit=limit)


def _search_ilike(db: Session, user: User, q: str, *, limit: int) -> list[SearchHit]:
    like = f"%{q}%"
    rows = (
        db.query(Clip.id, Clip.title, Transcript.full_text)
        .outerjoin(Transcript, Transcript.source_video_id == Clip.source_video_id)
        .filter(
            Clip.user_id == user.id,
            Clip.status != ClipStatus.archived,
            or_(Clip.title.ilike(like), Transcript.full_text.ilike(like)),
        )
        .all()
    )

    needle = q.lower()
    results: list[SearchHit] = []
    seen: set[int] = set()
    for clip_id, title, full_text in rows:
        if clip_id in seen:
            continue
        seen.add(clip_id)
        if title and needle in title.lower():
            results.append(
                SearchHit(
                    clip_id=clip_id,
                    title=title,
                    snippet=title,
                    matched_in="title",
                    rank=1.0,
                )
            )
        elif full_text:
            idx = full_text.lower().find(needle)
            start = max(0, idx - 60)
            end = idx + len(q) + 60
            snippet = full_text[start:end].strip()
            if start > 0:
                snippet = "... " + snippet
            results.append(
                SearchHit(
                    clip_id=clip_id,
                    title=title,
                    snippet=snippet,
                    matched_in="transcript",
                    rank=0.5,
                )
            )
    return results[:limit]


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------
def create_tag(db: Session, user: User, data: TagCreate) -> Tag:
    """Create a tag, deduped on ``(user_id, name)`` — returns the existing row."""
    existing = (
        db.query(Tag)
        .filter(Tag.user_id == user.id, Tag.name == data.name)
        .first()
    )
    if existing is not None:
        if data.color is not None and existing.color != data.color:
            existing.color = data.color
            db.commit()
            db.refresh(existing)
        return existing

    tag = Tag(user_id=user.id, name=data.name, color=data.color)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


def list_tags(db: Session, user: User) -> list[Tag]:
    return (
        db.query(Tag)
        .filter(Tag.user_id == user.id)
        .order_by(Tag.name.asc())
        .all()
    )


def attach_tags(
    db: Session,
    user: User,
    clip_id: int,
    tag_ids: list[int],
    *,
    detach: bool = False,
) -> Clip:
    """Attach (or detach) the given owned tags on an owned clip.

    Writes go through the ``Clip.tags`` relationship (not the ``clip_tags``
    association object) so the ``overlaps`` config stays consistent.
    """
    clip = _get_owned_clip(db, user, clip_id)

    wanted = list(dict.fromkeys(tag_ids))
    tags = (
        db.query(Tag)
        .filter(Tag.user_id == user.id, Tag.id.in_(wanted))
        .all()
    )
    missing = set(wanted) - {t.id for t in tags}
    if missing:
        raise NotFoundError("Tag")

    current = {t.id for t in clip.tags}
    if detach:
        clip.tags = [t for t in clip.tags if t.id not in set(wanted)]
    else:
        for tag in tags:
            if tag.id not in current:
                clip.tags.append(tag)

    db.commit()
    db.refresh(clip)
    return clip


# ---------------------------------------------------------------------------
# Version history + restore
# ---------------------------------------------------------------------------
def _snapshot(clip: Clip, caption: Caption | None) -> dict:
    return {
        "clip": {
            "title": clip.title,
            "start_seconds": clip.start_seconds,
            "end_seconds": clip.end_seconds,
            "aspect_ratio": _val(clip.aspect_ratio),
            "reframe_mode": _val(clip.reframe_mode),
            "crop_config": clip.crop_config,
            "status": _val(clip.status),
            "render_storage_key": clip.render_storage_key,
        },
        "caption": None
        if caption is None
        else {
            "segments": caption.segments,
            "style_preset_id": caption.style_preset_id,
            "style_overrides": caption.style_overrides,
        },
    }


def _val(value: object) -> object:
    return value.value if hasattr(value, "value") else value


def _next_version_number(db: Session, clip_id: int) -> int:
    current = (
        db.query(func.max(ClipVersion.version_number))
        .filter(ClipVersion.clip_id == clip_id)
        .scalar()
    )
    return (current or 0) + 1


def list_versions(db: Session, user: User, clip_id: int) -> list[ClipVersion]:
    _get_owned_clip(db, user, clip_id)
    return (
        db.query(ClipVersion)
        .filter(ClipVersion.clip_id == clip_id)
        .order_by(ClipVersion.version_number.desc())
        .all()
    )


def restore_version(
    db: Session, user: User, clip_id: int, version_number: int
) -> Clip:
    """Restore a prior clip version.

    1. Snapshot the *current* Clip + Caption state into a new ``ClipVersion``
       row (so a restore is itself reversible and the version counter bumps).
    2. Apply the target version's snapshot back onto the Clip + Caption.
    """
    clip = _get_owned_clip(db, user, clip_id)

    target = (
        db.query(ClipVersion)
        .filter(
            ClipVersion.clip_id == clip_id,
            ClipVersion.version_number == version_number,
        )
        .first()
    )
    if target is None:
        raise NotFoundError("Clip version")

    caption = db.query(Caption).filter(Caption.clip_id == clip_id).first()

    backup = ClipVersion(
        clip_id=clip_id,
        version_number=_next_version_number(db, clip_id),
        snapshot=_snapshot(clip, caption),
        render_storage_key=clip.render_storage_key,
        created_by=user.id,
    )
    db.add(backup)

    snap = target.snapshot or {}
    clip_snap = snap.get("clip") or {}
    if "title" in clip_snap:
        clip.title = clip_snap["title"]
    if "start_seconds" in clip_snap:
        clip.start_seconds = clip_snap["start_seconds"]
    if "end_seconds" in clip_snap:
        clip.end_seconds = clip_snap["end_seconds"]
    if clip_snap.get("aspect_ratio") is not None:
        clip.aspect_ratio = AspectRatio(clip_snap["aspect_ratio"])
    if clip_snap.get("reframe_mode") is not None:
        clip.reframe_mode = ReframeMode(clip_snap["reframe_mode"])
    if "crop_config" in clip_snap:
        clip.crop_config = clip_snap["crop_config"]
    if clip_snap.get("status") is not None:
        clip.status = ClipStatus(clip_snap["status"])
    if "render_storage_key" in clip_snap:
        clip.render_storage_key = clip_snap["render_storage_key"]

    caption_snap = snap.get("caption")
    if caption_snap is not None:
        if caption is None:
            caption = Caption(clip_id=clip_id)
            db.add(caption)
        caption.segments = caption_snap.get("segments")
        caption.style_preset_id = caption_snap.get("style_preset_id")
        caption.style_overrides = caption_snap.get("style_overrides")

    db.commit()
    db.refresh(clip)
    logger.info(
        "Restored clip %s to version %s (backup v%s)",
        clip_id,
        version_number,
        backup.version_number,
    )
    return clip


# ---------------------------------------------------------------------------
# Download bundles
# ---------------------------------------------------------------------------
def create_bundle(db: Session, user: User, clip_ids: list[int]) -> DownloadBundle:
    """Validate ownership, kick off renders for any clip not rendered yet, then
    queue an async zip build. Clips still missing a render at build time are
    listed in the bundle's MANIFEST.txt rather than failing the whole download.
    """
    wanted = list(dict.fromkeys(clip_ids))
    if not wanted:
        raise ValidationError("clip_ids must not be empty")

    clips = (
        db.query(Clip)
        .filter(Clip.user_id == user.id, Clip.id.in_(wanted))
        .all()
    )
    missing = set(wanted) - {c.id for c in clips}
    if missing:
        raise NotFoundError("Clip")

    pending_render = sorted(
        c.id for c in clips if c.status != ClipStatus.rendered
    )

    bundle = DownloadBundle(
        user_id=user.id,
        clip_ids=wanted,
        status=DownloadBundleStatus.queued,
    )
    db.add(bundle)
    db.commit()
    db.refresh(bundle)

    for cid in pending_render:
        _enqueue_render(cid)
    # Give freshly-triggered renders a head start before the zip is assembled.
    _enqueue_bundle(bundle.id, delay_seconds=10 if pending_render else 0)
    return bundle


def _enqueue_render(clip_id: int) -> None:
    try:
        from app.workers.render import render_clip

        render_clip.delay(clip_id)
    except Exception as exc:  # pragma: no cover - broker/environment dependent
        logger.warning("Could not enqueue render for clip %s: %s", clip_id, exc)


def _enqueue_bundle(bundle_id: int, delay_seconds: int = 0) -> None:
    try:
        from app.workers.bundles import build_bundle

        if delay_seconds > 0:
            build_bundle.apply_async(args=[bundle_id], countdown=delay_seconds)
        else:
            build_bundle.delay(bundle_id)
    except Exception as exc:  # pragma: no cover - broker/environment dependent
        logger.warning("Could not enqueue bundle build %s: %s", bundle_id, exc)


def get_bundle(db: Session, user: User, bundle_id: int) -> DownloadBundle:
    bundle = (
        db.query(DownloadBundle)
        .filter(
            DownloadBundle.id == bundle_id,
            DownloadBundle.user_id == user.id,
        )
        .first()
    )
    if bundle is None:
        raise NotFoundError("Bundle")
    return bundle


def bundle_to_response(bundle: DownloadBundle) -> BundleResponse:
    body = BundleResponse.model_validate(bundle)
    if (
        bundle.status == DownloadBundleStatus.ready
        and bundle.storage_key
    ):
        try:
            body.download_url = generate_presigned_url(bundle.storage_key)
        except Exception as exc:  # pragma: no cover - storage dependent
            logger.warning(
                "Could not sign bundle %s url: %s", bundle.id, exc
            )
    return body
