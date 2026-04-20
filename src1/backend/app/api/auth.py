from __future__ import annotations

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.auth_staff import AuthUser, require_user, verify_pin, verify_password
from app.core.auth_tokens import sign_token
from app.core.config import settings
from app.db.models_auth import StaffUser
from app.db.schemas_auth import AdminLoginRequest, CashierPinLoginRequest, LoginResponse, WhoAmIResponse


def _to_login_response(user: StaffUser) -> LoginResponse:
    token = sign_token({"uid": user.id, "role": user.role}, secret=settings.auth_secret, ttl_seconds=60 * 60 * 12)
    return LoginResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
        display_name=user.display_name,
        role=user.role,
    )


def admin_login(db: Session, req: AdminLoginRequest) -> LoginResponse:
    user = (
        db.query(StaffUser)
        .filter(StaffUser.id == req.user_id.strip(), StaffUser.role == "admin", StaffUser.is_active == True)  # noqa: E712
        .first()
    )
    if not user or not user.password_hash or not verify_password(req.password, user.password_hash):
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login fehlgeschlagen")

    return _to_login_response(user)


def cashier_pin_login(db: Session, req: CashierPinLoginRequest) -> LoginResponse:
    user = (
        db.query(StaffUser)
        .filter(StaffUser.id == req.user_id.strip(), StaffUser.is_active == True)  # noqa: E712
        .first()
    )
    if not user or not verify_pin(req.pin, user.pin_hash):
        from fastapi import HTTPException, status

        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Login fehlgeschlagen")

    return _to_login_response(user)


def whoami(user: AuthUser = Depends(require_user)) -> WhoAmIResponse:
    return WhoAmIResponse(
        user_id=user.user_id,
        username=user.username,
        display_name=user.display_name,
        role=user.role,
    )
