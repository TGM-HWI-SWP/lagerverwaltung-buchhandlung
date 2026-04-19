from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

from app.core.exceptions import ConflictError


def install_error_handlers(app: FastAPI) -> None:
    """Install consistent API error handling.

    Keeps route handlers thin and ensures stable HTTP status codes.
    """

    @app.exception_handler(ConflictError)
    async def _handle_conflict(_: Request, exc: ConflictError) -> JSONResponse:
        return JSONResponse(status_code=409, content={"detail": str(exc)})

    @app.exception_handler(IntegrityError)
    async def _handle_integrity_error(_: Request, exc: IntegrityError) -> JSONResponse:
        # Avoid leaking raw SQL errors to clients.
        return JSONResponse(
            status_code=409,
            content={"detail": "Konflikt: Diese Aktion verletzt Datenbank-Constraints."},
        )
