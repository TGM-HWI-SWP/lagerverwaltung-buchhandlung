from sqlalchemy.orm import Session

from datetime import datetime, timezone
from uuid import uuid4

from app.db.models import Book
from app.db.schemas import BookSchema


def get_all_books(db: Session) -> list[Book]:
    """Alle Bücher abrufen."""
    return db.query(Book).order_by(Book.name.asc()).all()


def get_book(db: Session, book_id: str) -> Book | None:
    """Ein Buch per ID abrufen."""
    return db.query(Book).filter(Book.id == book_id).first()


def create_book(db: Session, book: BookSchema) -> Book:
    """Neues Buch anlegen."""
    payload = book.model_dump()
    now = datetime.now(timezone.utc).isoformat()
    payload["id"] = payload.get("id") or str(uuid4())
    payload["created_at"] = payload.get("created_at") or now
    payload["updated_at"] = payload.get("updated_at") or now
    db_book = Book(**payload)
    db.add(db_book)
    db.commit()
    db.refresh(db_book)
    return db_book


def update_book(db: Session, book_id: str, book: BookSchema) -> Book | None:
    """Buch aktualisieren."""
    db_book = get_book(db, book_id)
    if db_book is None:
        return None

    payload = book.model_dump()
    for key, value in payload.items():
        if key in {"id", "created_at"}:
            continue
        if value is not None:
            setattr(db_book, key, value)

    db_book.updated_at = datetime.now(timezone.utc).isoformat()

    db.commit()
    db.refresh(db_book)
    return db_book


def delete_book(db: Session, book_id: str) -> bool:
    """Buch löschen. Gibt True zurück wenn erfolgreich."""
    db_book = get_book(db, book_id)
    if db_book is None:
        return False

    db.delete(db_book)
    db.commit()
    return True
