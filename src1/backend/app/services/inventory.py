from __future__ import annotations

from app.contracts.repositories import UnitOfWork
from app.core.time import utc_now_iso
from app.domain import models as dm


class InventoryService:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def list_movements(self) -> list[dm.Movement]:
        return self._uow.movements.list()

    def get_movement(self, movement_id: str) -> dm.Movement | None:
        return self._uow.movements.get(movement_id)

    def create_movement(self, movement: dm.Movement) -> dm.Movement:
        book = self._uow.books.get(movement.book_id)
        if book is None:
            raise ValueError("Buch für Lagerbewegung nicht gefunden")

        movement_type = movement.movement_type.upper()
        quantity_delta = movement.quantity_change
        if movement_type == "OUT":
            quantity_delta = -abs(quantity_delta)
        elif movement_type == "IN":
            quantity_delta = abs(quantity_delta)
        elif movement_type != "CORRECTION":
            raise ValueError("Ungültiger movement_type. Erlaubt: IN, OUT, CORRECTION")

        next_quantity = book.quantity + quantity_delta
        if next_quantity < 0:
            raise ValueError("Bestand kann nicht negativ werden")

        now = utc_now_iso()
        to_persist = dm.Movement(
            id=movement.id or self._uow.movements.next_id(),
            book_id=movement.book_id,
            book_name=movement.book_name or book.name,
            quantity_change=quantity_delta,
            movement_type=movement_type,
            reason=movement.reason,
            timestamp=movement.timestamp or now,
            performed_by=movement.performed_by or "system",
        )

        book.quantity = next_quantity
        book.updated_at = now
        self._uow.books.update(book)
        created = self._uow.movements.add(to_persist)
        self._uow.commit()
        return created

    def update_movement(self, movement_id: str, movement: dm.Movement) -> dm.Movement | None:
        existing = self._uow.movements.get(movement_id)
        if existing is None:
            return None
        raise ValueError(
            "Lagerbewegungen dürfen nicht nachträglich geändert werden. "
            "Bitte stattdessen eine ausgleichende Gegenbewegung erfassen."
        )

    def delete_movement(self, movement_id: str) -> bool:
        if self._uow.movements.get(movement_id) is None:
            return False
        raise ValueError(
            "Lagerbewegungen dürfen nicht gelöscht werden. "
            "Bitte stattdessen eine ausgleichende Gegenbewegung erfassen."
        )
