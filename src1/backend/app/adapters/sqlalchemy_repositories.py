from __future__ import annotations

import re
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.orm import Session

from app.contracts.repositories import BookRepository, MovementRepository
from app.db.models import Book, BookSupplier, Movement
from app.db.schemas import BookSchema, MovementSchema


def next_movement_id(db: Session) -> str:
    """Erzeugt die nächste chronologische M###-ID auf Basis der vorhandenen Movements."""
    ids = db.query(Movement.id).all()
    max_num = 0
    for (mid,) in ids:
        match = re.fullmatch(r"M(\d+)", mid or "")
        if match:
            num = int(match.group(1))
            if num > max_num:
                max_num = num
    return f"M{max_num + 1:03d}"


def sync_book_supplier_link(
    db: Session,
    *,
    book_id: str,
    supplier_id: str | None,
    purchase_price: float | int | None,
    supplier_sku: str = "",
) -> None:
    supplier_id = (supplier_id or "").strip()
    if not supplier_id:
        return

    now = datetime.now(timezone.utc).isoformat()
    link = (
        db.query(BookSupplier)
        .filter(BookSupplier.book_id == book_id, BookSupplier.supplier_id == supplier_id)
        .first()
    )
    price = float(purchase_price or 0)

    if link is None:
        existing_primary = (
            db.query(BookSupplier)
            .filter(BookSupplier.book_id == book_id, BookSupplier.is_primary.is_(True))
            .first()
        )
        link = BookSupplier(
            id=str(uuid4()),
            book_id=book_id,
            supplier_id=supplier_id,
            supplier_sku=supplier_sku or "",
            is_primary=existing_primary is None,
            last_purchase_price=price,
            created_at=now,
            updated_at=now,
        )
        db.add(link)
        return

    link.supplier_sku = supplier_sku or link.supplier_sku or ""
    link.last_purchase_price = price
    link.updated_at = now


class SqlAlchemyBookRepository(BookRepository):
    def __init__(self, db: Session):
        self._db = db

    def list(self) -> list[Book]:
        return self._db.query(Book).order_by(Book.name.asc()).all()

    def get(self, book_id: str) -> Book | None:
        return self._db.query(Book).filter(Book.id == book_id).first()

    def create(self, book: BookSchema) -> Book:
        payload = book.model_dump()
        now = datetime.now(timezone.utc).isoformat()
        payload["id"] = payload.get("id") or str(uuid4())
        payload["created_at"] = payload.get("created_at") or now
        payload["updated_at"] = payload.get("updated_at") or now

        db_book = Book(**payload)
        self._db.add(db_book)
        self._db.flush()
        sync_book_supplier_link(
            self._db,
            book_id=db_book.id,
            supplier_id=db_book.supplier_id,
            purchase_price=db_book.purchase_price,
            supplier_sku=db_book.sku or "",
        )
        self._db.commit()
        self._db.refresh(db_book)
        return db_book

    def update(self, book_id: str, book: BookSchema) -> Book | None:
        db_book = self.get(book_id)
        if db_book is None:
            return None

        payload = book.model_dump()
        for key, value in payload.items():
            if key in {"id", "created_at"}:
                continue
            if value is not None:
                setattr(db_book, key, value)

        db_book.updated_at = datetime.now(timezone.utc).isoformat()
        sync_book_supplier_link(
            self._db,
            book_id=db_book.id,
            supplier_id=db_book.supplier_id,
            purchase_price=db_book.purchase_price,
            supplier_sku=db_book.sku or "",
        )
        self._db.commit()
        self._db.refresh(db_book)
        return db_book

    def delete(self, book_id: str) -> bool:
        db_book = self.get(book_id)
        if db_book is None:
            return False
        (
            self._db.query(BookSupplier)
            .filter(BookSupplier.book_id == book_id)
            .delete(synchronize_session=False)
        )
        self._db.delete(db_book)
        self._db.commit()
        return True


class SqlAlchemyMovementRepository(MovementRepository):
    def __init__(self, db: Session):
        self._db = db

    def list(self) -> list[Movement]:
        return self._db.query(Movement).order_by(Movement.timestamp.desc()).all()

    def get(self, movement_id: str) -> Movement | None:
        return self._db.query(Movement).filter(Movement.id == movement_id).first()

    def create(self, movement: MovementSchema) -> Movement:
        payload = movement.model_dump()
        payload["id"] = movement.id or next_movement_id(self._db)
        payload["timestamp"] = movement.timestamp or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        db_movement = Movement(**payload)
        self._db.add(db_movement)
        self._db.commit()
        self._db.refresh(db_movement)
        return db_movement

    def update(self, movement_id: str, movement: MovementSchema) -> Movement | None:
        db_movement = self.get(movement_id)
        if db_movement is None:
            return None

        payload = movement.model_dump()
        for key, value in payload.items():
            if key == "id":
                continue
            setattr(db_movement, key, value)

        self._db.commit()
        self._db.refresh(db_movement)
        return db_movement

    def delete(self, movement_id: str) -> bool:
        db_movement = self.get(movement_id)
        if db_movement is None:
            return False
        self._db.delete(db_movement)
        self._db.commit()
        return True
