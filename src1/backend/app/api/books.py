from sqlalchemy.orm import Session

from app.adapters.schema_mappers import book_from_schema
from app.api.deps import books_service
from app.db.schemas import BookSchema
from app.domain import models as dm


def get_all_books(db: Session) -> list[dm.Book]:
    return books_service(db).list_books()


def get_book(db: Session, book_id: str) -> dm.Book | None:
    return books_service(db).get_book(book_id)


def create_book(db: Session, book: BookSchema) -> dm.Book:
    return books_service(db).create_book(book_from_schema(book))


def update_book(db: Session, book_id: str, book: BookSchema) -> dm.Book | None:
    service = books_service(db)
    existing = service.get_book(book_id)
    if existing is None:
        return None
    return service.update_book(book_id, book_from_schema(book, existing=existing))


def delete_book(db: Session, book_id: str) -> bool:
    return books_service(db).delete_book(book_id)
