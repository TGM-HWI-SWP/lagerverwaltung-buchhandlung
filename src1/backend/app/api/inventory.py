from sqlalchemy.orm import Session
from datetime import datetime, timezone
from uuid import uuid4

from app.db.models import Book
from app.db.models import Movement
from app.db.schemas import MovementSchema


def get_all_movements(db: Session) -> list[Movement]:
    """Alle Lagerbewegungen abrufen."""
    return db.query(Movement).order_by(Movement.timestamp.desc()).all()


def get_movement(db: Session, movement_id: str) -> Movement | None:
    """Eine Lagerbewegung per ID abrufen."""
    return db.query(Movement).filter(Movement.id == movement_id).first()


def create_movement(db: Session, movement: MovementSchema) -> Movement:
    """Neue Lagerbewegung anlegen."""
    book = db.query(Book).filter(Book.id == movement.book_id).first()
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
    db.add(db_movement)
    db.commit()
    db.refresh(db_movement)
    return db_movement


def update_movement(db: Session, movement_id: str, movement: MovementSchema) -> Movement | None:
    """Lagerbewegung aktualisieren."""
    db_movement = get_movement(db, movement_id)
    if db_movement is None:
        return None

    payload = movement.model_dump()
    for key, value in payload.items():
        if key == "id":
            continue
        setattr(db_movement, key, value)

    db.commit()
    db.refresh(db_movement)
    return db_movement


def delete_movement(db: Session, movement_id: str) -> bool:
    """Lagerbewegung löschen. Gibt True zurück wenn erfolgreich."""
    db_movement = get_movement(db, movement_id)
    if db_movement is None:
        return False

    db.delete(db_movement)
    db.commit()
    return True
