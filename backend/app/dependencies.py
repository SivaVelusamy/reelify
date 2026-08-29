"""Shared FastAPI dependencies: DB session + auth guards."""

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.auth.jwt import decode_token
from app.database import get_db  # noqa: F401  (re-exported for routers)
from app.exceptions import ForbiddenError, UnauthorizedError
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(token)
    if not payload or payload.get("type") != "access":
        raise UnauthorizedError("Invalid or expired token")

    sub = payload.get("sub")
    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise UnauthorizedError("Invalid token payload") from None

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise UnauthorizedError("User not found")
    return user


async def get_current_active_user(
    user: User = Depends(get_current_user),
) -> User:
    if not user.is_active:
        raise ForbiddenError("Inactive user account")
    return user


async def require_admin(
    user: User = Depends(get_current_active_user),
) -> User:
    if not getattr(user, "is_admin", False):
        raise ForbiddenError("Admin privileges required")
    return user
