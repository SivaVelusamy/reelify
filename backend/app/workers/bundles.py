"""Celery task for Module 4 (Library): build a bulk-download zip bundle.

Importable without a running broker. The actual zip assembly is STUBBED so the
task never depends on real media being present; the real approach is spelled out
in comments for a later DEVOPS-AGENT pass.
"""

import logging
import tempfile

from app.database import SessionLocal
from app.models.clip import Clip
from app.models.library import DownloadBundle, DownloadBundleStatus
from app.storage import upload_fileobj
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
        render_keys = [c.render_storage_key for c in clips if c.render_storage_key]

        bundle_key = f"bundles/{bundle.user_id}/{bundle.id}.zip"

        # --- REAL zip assembly (STUBBED execution) ----------------------------
        # import os, zipfile
        # from app.storage import download_to_path  # (helper a DEVOPS-AGENT adds)
        # with tempfile.NamedTemporaryFile(suffix=".zip") as archive:
        #     with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
        #         for key in render_keys:
        #             local = download_to_path(key)
        #             zf.write(local, arcname=os.path.basename(key))
        #     archive.seek(0)
        #     upload_fileobj(bundle_key, archive, content_type="application/zip")
        # --------------------------------------------------------------------
        logger.info(
            "build_bundle: STUB zip for bundle %s (%d/%d clips have a render)",
            bundle_id,
            len(render_keys),
            len(clip_ids),
        )
        with tempfile.NamedTemporaryFile(suffix=".zip") as placeholder:
            placeholder.write(b"")
            placeholder.flush()
            placeholder.seek(0)
            upload_fileobj(
                bundle_key, placeholder, content_type="application/zip"
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
