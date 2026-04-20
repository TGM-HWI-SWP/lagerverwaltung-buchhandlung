from __future__ import annotations

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


def _require_bcrypt() -> None:
    if not HAS_BCRYPT:
        raise RuntimeError("bcrypt ist erforderlich, um Mitarbeiter-Logins sicher zu verwenden.")


@dataclass(frozen=True)
class AuthUser:
    user_id: str
    username: str
    display_name: str
    role: str


def hash_pin(pin: str) -> str:
    """Hash a 4-digit PIN using bcrypt."""
    _require_bcrypt()
    salt = bcrypt.gensalt(rounds=6)
    return bcrypt.hashpw(pin.encode("utf-8"), salt).decode("utf-8")


def hash_password(password: str) -> str:
    """Hash a password using bcrypt."""
    _require_bcrypt()
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_pin(pin: str, hashed_pin: str) -> bool:
    """Verify a PIN against its bcrypt hash."""
    _require_bcrypt()
    try:
        return bcrypt.checkpw(pin.encode("utf-8"), hashed_pin.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify a password against its bcrypt hash."""
    _require_bcrypt()
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        return False


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
