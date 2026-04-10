from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.orm import Session

from app.contracts.repositories import BookRepository, MovementRepository
from app.db.models import Book, Movement
from app.db.schemas import MovementSchema


class InventoryService:
    """
    Handles inventory movements and stock validation.

    Note: We intentionally keep the stock-change rule here (not in the adapter),
    so persistence can be swapped without changing business behavior.
    """

    def __init__(self, *, db: Session, books: BookRepository, movements: MovementRepository):
        self._db = db
        self._books = books
        self._movements = movements

    def list_movements(self) -> list[Movement]:
        return self._movements.list()

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

        payload = movement.model_dump()
        payload["id"] = movement.id or str(uuid4())
        payload["movement_type"] = movement_type
        payload["quantity_change"] = quantity_delta
        payload["timestamp"] = movement.timestamp or datetime.now(timezone.utc).isoformat()
        payload["book_name"] = movement.book_name or book.name

        db_movement = Movement(**payload)

        book.quantity = next_quantity
        book.updated_at = datetime.now(timezone.utc).isoformat()

        # Ensure atomicity for "movement + book quantity change"
        self._db.add(db_movement)
        self._db.commit()
        self._db.refresh(db_movement)
        return db_movement

    def update_movement(self, movement_id: str, movement: MovementSchema) -> Movement | None:
        # Keeping current behavior: updates do NOT re-apply stock deltas.
        # If you want that, we would need a compensating movement model.
        return self._movements.update(movement_id, movement)

    def delete_movement(self, movement_id: str) -> bool:
        # Keeping current behavior: delete does NOT re-apply stock deltas.
        return self._movements.delete(movement_id)

