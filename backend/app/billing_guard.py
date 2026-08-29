"""Reusable FastAPI dependency for Module 7 "Limit enforcement".

Blocks pipeline work once the caller has hit their plan's monthly processing
allowance. Kept out of ``app.dependencies`` (foundation, do not edit) so billing
stays an isolated module.

Attach to any endpoint that enqueues pipeline jobs, e.g. the source-video /
batch-upload / reprocess routes in ``app.routers.projects``::

    from app.billing_guard import require_within_usage_limit

    @router.post(
        "/projects/{project_id}/videos",
        dependencies=[Depends(require_within_usage_limit)],
    )
    async def upload_source_video(...):
        ...

On exhaustion it raises :class:`app.exceptions.PaymentRequiredError` -> HTTP 402
with a clear message, before any job is queued.
"""

from fastapi import Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_active_user
from app.models.user import User
from app.services import billing_service


async def require_within_usage_limit(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> User:
    billing_service.check_usage_allows_processing(db, user)
    return user
