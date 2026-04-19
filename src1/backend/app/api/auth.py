from __future__ import annotations

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.auth_staff import AuthUser, hash_pin, require_user
from app.core.auth_tokens import sign_token
from app.core.config import settings
from app.db.models_auth import StaffUser
from app.db.schemas_auth import LoginRequest, LoginResponse, WhoAmIResponse


def login(db: Session, req: LoginRequest) -> LoginResponse:
    user = (
        db.query(StaffUser)
        .filter(StaffUser.username == req.username.strip(), StaffUser.is_active == True)  # noqa: E712
        .first()
    )
    if not user or user.pin_hash != hash_pin(req.pin):
        # Deliberately generic
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login fehlgeschlagen")

    token = sign_token({"uid": user.id, "role": user.role}, secret=settings.auth_secret, ttl_seconds=60 * 60 * 12)
    return LoginResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        display_name=user.display_name,
        role=user.role,
    )


def whoami(user: AuthUser = Depends(require_user)) -> WhoAmIResponse:
    return WhoAmIResponse(
        user_id=user.user_id,
        username=user.username,
        display_name=user.display_name,
        role=user.role,
    )
