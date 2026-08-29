"""Celery task for Module 4 (Library): build a bulk-download zip bundle.

Importable without a running broker. Produces a real zip archive of each clip's
rendered object; clips whose render is missing are noted in a MANIFEST.txt so the
archive is always valid and self-describing.
"""

import io
import logging
import os
import zipfile

from app.database import SessionLocal
from app.models.clip import Clip
from app.models.library import DownloadBundle, DownloadBundleStatus
from app.storage import download_bytes, object_exists, upload_fileobj
from app.workers import celery

logger = logging.getLogger(__name__)


@celery.task(name="app.workers.bundles.build_bundle", bind=True)
def build_bundle(self, bundle_id: int) -> dict:
    """Assemble the rendered clips of a ``DownloadBundle`` into a single zip.

    Pipeline (conceptual):
      1. Mark the bundle ``building``.
      2. For each clip id, resolve ``clip.render_storage_key``.
      3. Stream every render out of object storage into a ``zipfile.ZipFile``.
      4. Upload the finished archive and set ``storage_key`` + status ``ready``.

    On any error: set status ``failed``.
    """
    db = SessionLocal()
    try:
        bundle = (
            db.query(DownloadBundle)
            .filter(DownloadBundle.id == bundle_id)
            .first()
        )
        if bundle is None:
            logger.warning("build_bundle: bundle %s not found", bundle_id)
            return {"bundle_id": bundle_id, "status": "not_found"}

        bundle.status = DownloadBundleStatus.building
        db.add(bundle)
        db.commit()

        clip_ids = list(bundle.clip_ids or [])
        clips = db.query(Clip).filter(Clip.id.in_(clip_ids)).all() if clip_ids else []
        by_id = {c.id: c for c in clips}

        bundle_key = f"bundles/{bundle.user_id}/{bundle.id}.zip"

        buffer = io.BytesIO()
        manifest: list[str] = [f"Reelify download bundle #{bundle.id}", ""]
        used_names: set[str] = set()
        included = 0

        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
            for cid in clip_ids:
                clip = by_id.get(cid)
                if clip is None:
                    manifest.append(f"- clip {cid}: not found / not owned")
                    continue
                key = clip.render_storage_key
                if not key or not object_exists(key):
                    manifest.append(f"- {clip.title or f'clip {cid}'}: no rendered file yet")
                    continue
                ext = os.path.splitext(key)[1] or ".mp4"
                base = f"{(clip.title or f'clip-{cid}').strip()[:60]}"
                name = f"{base}{ext}"
                n = 2
                while name in used_names:
                    name = f"{base} ({n}){ext}"
                    n += 1
                used_names.add(name)
                zf.writestr(name, download_bytes(key))
                manifest.append(f"- {name}")
                included += 1
            zf.writestr("MANIFEST.txt", "\n".join(manifest) + "\n")

        buffer.seek(0)
        upload_fileobj(bundle_key, buffer, content_type="application/zip")
        logger.info(
            "build_bundle: bundle %s zipped %d/%d clips", bundle_id, included, len(clip_ids)
        )

        bundle.storage_key = bundle_key
        bundle.status = DownloadBundleStatus.ready
        db.add(bundle)
        db.commit()
        logger.info("build_bundle: bundle %s ready -> %s", bundle_id, bundle_key)
        return {"bundle_id": bundle_id, "status": DownloadBundleStatus.ready.value}
    except Exception:  # noqa: BLE001 - never crash the worker loop
        logger.exception("build_bundle failed for bundle %s", bundle_id)
        db.rollback()
        try:
            failed = (
                db.query(DownloadBundle)
                .filter(DownloadBundle.id == bundle_id)
                .first()
            )
            if failed is not None:
                failed.status = DownloadBundleStatus.failed
                db.add(failed)
                db.commit()
        except Exception:  # noqa: BLE001
            logger.exception(
                "build_bundle: could not mark bundle %s failed", bundle_id
            )
            db.rollback()
        return {"bundle_id": bundle_id, "status": DownloadBundleStatus.failed.value}
    finally:
        db.close()
