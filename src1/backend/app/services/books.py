from __future__ import annotations

from uuid import uuid4

from app.contracts.repositories import UnitOfWork
from app.core.time import utc_now_iso
from app.domain import models as dm


class BooksService:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def list_books(self) -> list[dm.Book]:
        return self._uow.books.list()

    def get_book(self, book_id: str) -> dm.Book | None:
        return self._uow.books.get(book_id)

    def create_book(self, book: dm.Book) -> dm.Book:
        created = self._uow.books.add(book)
        self._sync_supplier_link(created)
        self._uow.commit()
        return created

    def update_book(self, book_id: str, book: dm.Book) -> dm.Book | None:
        if self._uow.books.get(book_id) is None:
            return None
        book.id = book_id
        book.updated_at = utc_now_iso()
        updated = self._uow.books.update(book)
        self._sync_supplier_link(updated)
        self._uow.commit()
        return updated

    def delete_book(self, book_id: str) -> bool:
        deleted = self._uow.books.delete(book_id)
        if deleted:
            self._uow.commit()
        return deleted

    def _sync_supplier_link(self, book: dm.Book) -> None:
        supplier_id = (book.supplier_id or "").strip()
        if not supplier_id:
            return
        now = utc_now_iso()
        existing = self._uow.book_supplier_links.get_for(book.id, supplier_id)
        price = float(book.purchase_price or 0)
        if existing is None:
            primary = self._uow.book_supplier_links.primary_for(book.id)
            link = dm.BookSupplierLink(
                id=str(uuid4()),
                book_id=book.id,
                supplier_id=supplier_id,
                supplier_sku=book.sku or "",
                is_primary=primary is None,
                last_purchase_price=price,
                created_at=now,
                updated_at=now,
            )
        else:
            link = dm.BookSupplierLink(
                id=existing.id,
                book_id=existing.book_id,
                supplier_id=existing.supplier_id,
                supplier_sku=book.sku or existing.supplier_sku or "",
                is_primary=existing.is_primary,
                last_purchase_price=price,
                created_at=existing.created_at,
                updated_at=now,
            )
        self._uow.book_supplier_links.upsert(link)
