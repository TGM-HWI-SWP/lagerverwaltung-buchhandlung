from __future__ import annotations

from app.contracts.repositories import BookRepository
from app.db.models import Book
from app.db.schemas import BookSchema


class BooksService:
    def __init__(self, books: BookRepository):
        self._books = books

    def list_books(self) -> list[Book]:
        return self._books.list()

    def list_books_paginated(self, offset: int = 0, limit: int = 50) -> list[Book]:
        return self._books.list_paginated(offset=offset, limit=limit)

    def count_books(self) -> int:
        return self._books.count()

    def get_book(self, book_id: str) -> Book | None:
        return self._books.get(book_id)

    def create_book(self, book: BookSchema) -> Book:
        return self._books.create(book)

    def update_book(self, book_id: str, book: BookSchema) -> Book | None:
        return self._books.update(book_id, book)

    def delete_book(self, book_id: str) -> bool:
        return self._books.delete(book_id)
