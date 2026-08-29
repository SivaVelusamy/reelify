"""Business logic for authentication: registration, login, token lifecycle, password reset."""

import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy.orm import Session

from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.config import settings
from app.exceptions import ConflictError, UnauthorizedError
from app.models.user import PasswordResetToken, RefreshToken, User
from app.schemas.auth import (
    RegisterRequest,
    TokenResponse,
    UpdateProfileRequest,
)

logger = logging.getLogger("reelify.auth")

PASSWORD_RESET_TTL = timedelta(hours=1)


def _sha256(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def register_user(db: Session, data: RegisterRequest) -> User:
    existing = db.query(User).filter(User.email == data.email).first()
    if existing is not None:
        raise ConflictError("An account with this email already exists")

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, email: str, password: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is None or not user.hashed_password:
        raise UnauthorizedError("Incorrect email or password")
    if not verify_password(password, user.hashed_password):
        raise UnauthorizedError("Incorrect email or password")
    if not user.is_active:
        raise UnauthorizedError("Account is disabled")
    return user


def issue_token_pair(db: Session, user: User) -> TokenResponse:
    access_token = create_access_token({"sub": str(user.id)})
    # jti guarantees a unique token string even when two refresh tokens are
    # minted for the same user within the same second (e.g. immediate rotation).
    refresh_token = create_refresh_token(
        {"sub": str(user.id), "jti": secrets.token_urlsafe(16)}
    )

    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=_sha256(refresh_token),
            expires_at=datetime.now(UTC)
            + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
            revoked=False,
        )
    )
    db.commit()

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


def _load_valid_refresh_token(db: Session, raw: str) -> RefreshToken:
    payload = decode_token(raw)
    if not payload or payload.get("type") != "refresh":
        raise UnauthorizedError("Invalid or expired refresh token")

    record = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == _sha256(raw))
        .first()
    )
    if record is None or record.revoked:
        raise UnauthorizedError("Invalid or expired refresh token")

    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at < datetime.now(UTC):
        raise UnauthorizedError("Invalid or expired refresh token")

    return record


def rotate_refresh_token(db: Session, raw: str) -> TokenResponse:
    record = _load_valid_refresh_token(db, raw)

    user = db.query(User).filter(User.id == record.user_id).first()
    if user is None or not user.is_active:
        raise UnauthorizedError("Invalid or expired refresh token")

    record.revoked = True
    db.add(record)
    db.commit()

    return issue_token_pair(db, user)


def revoke_refresh_token(db: Session, raw: str) -> None:
    record = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == _sha256(raw))
        .first()
    )
    if record is not None and not record.revoked:
        record.revoked = True
        db.add(record)
        db.commit()


def create_password_reset(db: Session, email: str) -> str | None:
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        # Do not reveal whether the email is registered.
        return None

    raw_token = secrets.token_urlsafe(32)
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=_sha256(raw_token),
            expires_at=datetime.now(UTC) + PASSWORD_RESET_TTL,
            used=False,
        )
    )
    db.commit()

    logger.info("Password reset token issued for user_id=%s", user.id)
    if settings.DEBUG:
        # Dev only: no email service is wired yet, so surface the link locally.
        logger.debug("DEBUG reset link token for user_id=%s: %s", user.id, raw_token)
    # TODO: send this token by email via app.services.email_service once it exists.
    return raw_token


def reset_password(db: Session, token: str, new_password: str) -> None:
    record = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.token_hash == _sha256(token))
        .first()
    )
    if record is None or record.used:
        raise UnauthorizedError("Invalid or expired reset token")

    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at < datetime.now(UTC):
        raise UnauthorizedError("Invalid or expired reset token")

    user = db.query(User).filter(User.id == record.user_id).first()
    if user is None:
        raise UnauthorizedError("Invalid or expired reset token")

    user.hashed_password = hash_password(new_password)
    record.used = True
    db.add(user)
    db.add(record)

    # Invalidate all existing sessions after a password change.
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked.is_(False),
    ).update({"revoked": True})

    db.commit()


def update_profile(db: Session, user: User, data: UpdateProfileRequest) -> User:
    payload = data.model_dump(exclude_unset=True)
    if "full_name" in payload:
        user.full_name = payload["full_name"]
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
