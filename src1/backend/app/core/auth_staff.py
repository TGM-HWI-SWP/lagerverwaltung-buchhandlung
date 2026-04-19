from __future__ import annotations

from dataclasses import dataclass
from hashlib import sha256

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth_tokens import verify_token
from app.core.config import settings
from app.db.models_auth import StaffUser
from app.db.session import get_db


@dataclass(frozen=True)
class AuthUser:
    user_id: str
    username: str
    display_name: str
    role: str


def hash_pin(pin: str) -> str:
    return sha256(pin.encode("utf-8")).hexdigest()


def require_user(
    authorization: str | None = Header(default=None, alias="Authorization"),
    db: Session = Depends(get_db),
) -> AuthUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Nicht eingeloggt")
    token = authorization.split(" ", 1)[1].strip()
    payload = verify_token(token, secret=settings.auth_secret)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session abgelaufen")

    user_id = payload.get("uid")
    if not isinstance(user_id, str):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Ungültige Session")

    user = db.query(StaffUser).filter(StaffUser.id == user_id, StaffUser.is_active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Benutzer deaktiviert")

    return AuthUser(user_id=user.id, username=user.username, display_name=user.display_name, role=user.role)


def require_admin(user: AuthUser = Depends(require_user)) -> AuthUser:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin-Rechte erforderlich")
    return user
