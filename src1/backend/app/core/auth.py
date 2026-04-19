from fastapi import Header, HTTPException, status

from app.core.config import settings


def verify_api_key(x_api_key: str | None = Header(default=None, alias="X-API-Key")) -> str:
    """
    Dependency that verifies the provided API key.

    Use as: `user: str = Depends(verify_api_key)`
    The returned string is the validated key (or the user identifier).
    """
    if not x_api_key:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="API-Key fehlt")

    if x_api_key != settings.admin_api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ungültiger oder fehlender API-Key",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    return x_api_key
