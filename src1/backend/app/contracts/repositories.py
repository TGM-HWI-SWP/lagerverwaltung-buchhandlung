from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from sqlalchemy.orm import Session

from app.db.models import Book, Movement
from app.db.schemas import BookSchema, MovementSchema


class BookRepository(Protocol):
    def list(self) -> list[Book]: ...

    def list_paginated(self, offset: int = 0, limit: int = 50) -> list[Book]: ...

    def get(self, book_id: str) -> Book | None: ...

    def create(self, book: BookSchema) -> Book: ...

    def update(self, book_id: str, book: BookSchema) -> Book | None: ...

    def delete(self, book_id: str) -> bool: ...

    def count(self) -> int: ...


class MovementRepository(Protocol):
    def list(self) -> list[Movement]: ...

    def list_paginated(self, offset: int = 0, limit: int = 50) -> list[Movement]: ...

    def get(self, movement_id: str) -> Movement | None: ...

    def create(self, movement: MovementSchema) -> Movement: ...

    def update(self, movement_id: str, movement: MovementSchema) -> Movement | None: ...

    def delete(self, movement_id: str) -> bool: ...

    def count(self) -> int: ...


@dataclass(frozen=True)
class Repositories:
    """Simple container to wire repositories together per request."""

    db: Session
    books: BookRepository
    movements: MovementRepository
