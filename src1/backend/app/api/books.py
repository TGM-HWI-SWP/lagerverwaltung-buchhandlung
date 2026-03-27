from sqlalchemy.orm import Session

from app.db.models import Book
from app.db.schemas import BookSchema


def get_all_books(db: Session) -> list[Book]:
    """Alle Bücher abrufen."""
    pass


def get_book(db: Session, book_id: str) -> Book | None:
    """Ein Buch per ID abrufen."""
    pass


def create_book(db: Session, book: BookSchema) -> Book:
    """Neues Buch anlegen."""
    pass


def update_book(db: Session, book_id: str, book: BookSchema) -> Book | None:
    """Buch aktualisieren."""
    pass


def delete_book(db: Session, book_id: str) -> bool:
    """Buch löschen. Gibt True zurück wenn erfolgreich."""
    pass
