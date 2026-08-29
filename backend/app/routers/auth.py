"""Authentication endpoints: register, login, token refresh, logout, password reset, profile."""

from fastapi import APIRouter, Depends, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.dependencies import get_current_active_user, get_db
from app.models.user import User
from app.rate_limit import limiter
from app.schemas.auth import (
    ForgotPasswordRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    request: Request,
    data: RegisterRequest,
    db: Session = Depends(get_db),
) -> User:
    return auth_service.register_user(db, data)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> TokenResponse:
    user = auth_service.authenticate_user(db, form.username, form.password)
    return auth_service.issue_token_pair(db, user)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
async def refresh(
    request: Request,
    data: RefreshRequest,
    db: Session = Depends(get_db),
) -> TokenResponse:
    return auth_service.rotate_refresh_token(db, data.refresh_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    data: RefreshRequest,
    db: Session = Depends(get_db),
) -> None:
    auth_service.revoke_refresh_token(db, data.refresh_token)


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("3/minute")
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    auth_service.create_password_reset(db, data.email)
    return {"message": "If the email is registered, a reset link has been sent."}


@router.post("/reset-password", status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    data: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    auth_service.reset_password(db, data.token, data.new_password)
    return {"message": "Password has been reset."}


@router.get("/me", response_model=UserResponse)
async def read_me(
    user: User = Depends(get_current_active_user),
) -> User:
    return user


@router.put("/me", response_model=UserResponse)
async def update_me(
    data: UpdateProfileRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_active_user),
) -> User:
    return auth_service.update_profile(db, user, data)
