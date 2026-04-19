from __future__ import annotations

import html
from datetime import datetime

from sqlalchemy.orm import Session

from app.adapters.sqlalchemy_repositories import next_movement_id
from app.contracts.repositories import BookRepository, MovementRepository
from app.core.exceptions import ConflictError
from app.core.time import utc_now_iso
from app.db.models import Book, Movement
from app.db.schemas import MovementSchema


class InventoryService:
    """Handles inventory movements and stock validation."""

    def __init__(self, *, db: Session, books: BookRepository, movements: MovementRepository):
        self._db = db
        self._books = books
        self._movements = movements

    def list_movements(self) -> list[Movement]:
        return self._movements.list()

    def list_movements_paginated(self, offset: int = 0, limit: int = 50) -> list[Movement]:
        return self._movements.list_paginated(offset=offset, limit=limit)

    def count_movements(self) -> int:
        return self._movements.count()

    def get_movement(self, movement_id: str) -> Movement | None:
        return self._movements.get(movement_id)

    def create_movement(self, movement: MovementSchema) -> Movement:
        book = self._books.get(movement.book_id)
        if book is None:
            raise ValueError("Buch für Lagerbewegung nicht gefunden")

        movement_type = movement.movement_type.upper()
        quantity_delta = movement.quantity_change
        if movement_type == "OUT":
            quantity_delta = -abs(quantity_delta)
        elif movement_type in {"IN", "CORRECTION"}:
            quantity_delta = abs(quantity_delta) if movement_type == "IN" else quantity_delta
        else:
            raise ValueError("Ungültiger movement_type. Erlaubt: IN, OUT, CORRECTION")

        next_quantity = book.quantity + quantity_delta
        if next_quantity < 0:
            raise ValueError("Bestand kann nicht negativ werden")

        # Sanitize reason field to prevent XSS if rendered as HTML later
        reason = movement.reason
        if reason is not None:
            reason = html.escape(reason)

        payload = movement.model_dump()
        payload["id"] = movement.id or next_movement_id(self._db)
        payload["movement_type"] = movement_type
        payload["quantity_change"] = quantity_delta
        payload["timestamp"] = datetime.fromisoformat(movement.timestamp or utc_now_iso())
        payload["book_name"] = movement.book_name or book.name
        payload["reason"] = reason

        db_movement = Movement(**payload)

        book.quantity = next_quantity
        book.updated_at = datetime.fromisoformat(utc_now_iso())

        # Ensure atomicity for "movement + book quantity change"
        self._db.add(db_movement)
        self._db.commit()
        self._db.refresh(db_movement)
        return db_movement

    def update_movement(self, movement_id: str, movement: MovementSchema) -> Movement | None:
        raise ConflictError(
            "Lagerbewegungen können nach Erstellung nicht geändert werden (unveränderlich)"
        )

    def delete_movement(self, movement_id: str) -> bool:
        raise ConflictError(
            "Lagerbewegungen können nach Erstellung nicht gelöscht werden (unveränderlich)"
        )
