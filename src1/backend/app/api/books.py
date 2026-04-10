from sqlalchemy.orm import Session

from app.adapters.sqlalchemy_repositories import SqlAlchemyBookRepository
from app.db.models import Book
from app.db.schemas import BookSchema
from app.services.books import BooksService


def _service(db: Session) -> BooksService:
    return BooksService(SqlAlchemyBookRepository(db))


def get_all_books(db: Session) -> list[Book]:
    return _service(db).list_books()


def get_book(db: Session, book_id: str) -> Book | None:
    return _service(db).get_book(book_id)


def create_book(db: Session, book: BookSchema) -> Book:
    return _service(db).create_book(book)


def update_book(db: Session, book_id: str, book: BookSchema) -> Book | None:
    return _service(db).update_book(book_id, book)


def delete_book(db: Session, book_id: str) -> bool:
    return _service(db).delete_book(book_id)
