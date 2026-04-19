from __future__ import annotations

import hashlib
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth_tokens import verify_token
from app.core.config import settings
from app.db.models_auth import StaffUser
from app.db.session import get_db

try:
    import bcrypt
    HAS_BCRYPT = True
except ImportError:
    HAS_BCRYPT = False


@dataclass(frozen=True)
class AuthUser:
    user_id: str
    username: str
    display_name: str
    role: str


def hash_pin(pin: str) -> str:
    """Hash a 4-digit PIN using bcrypt (fallback to SHA-256)."""
    if HAS_BCRYPT:
        salt = bcrypt.gensalt(rounds=6)
        return bcrypt.hashpw(pin.encode("utf-8"), salt).decode("utf-8")
    else:
        return hashlib.sha256(pin.encode("utf-8")).hexdigest()


def hash_password(password: str) -> str:
    """Hash a password using bcrypt (fallback to SHA-256)."""
    if HAS_BCRYPT:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    else:
        return hashlib.sha256(password.encode("utf-8")).hexdigest()


def verify_pin(pin: str, hashed_pin: str) -> bool:
    """Verify a PIN against its hash (bcrypt or SHA-256)."""
    if HAS_BCRYPT:
        try:
            return bcrypt.checkpw(pin.encode("utf-8"), hashed_pin.encode("utf-8"))
        except (ValueError, TypeError):
            return False
    else:
        return hash_pin(pin) == hashed_pin


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify a password against its hash (bcrypt or SHA-256)."""
    if HAS_BCRYPT:
        try:
            return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
        except (ValueError, TypeError):
            return False
    else:
        return hash_password(password) == hashed_password


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
