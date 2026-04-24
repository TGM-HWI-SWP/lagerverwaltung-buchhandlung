from __future__ import annotations

from uuid import uuid4

from app.contracts.repositories import UnitOfWork
from app.core.time import utc_now_iso
from app.domain import models as dm


class BooksService:
    """Use-Cases rund ums Buch: CRUD + automatischer Sync des Book-Supplier-Links."""

    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def list_books(self) -> list[dm.Book]:
        return self._uow.books.list()                                           # durchreichen ans Repository

    def get_book(self, book_id: str) -> dm.Book | None:
        return self._uow.books.get(book_id)                                     # durchreichen ans Repository

    def create_book(self, book: dm.Book) -> dm.Book:
        created = self._uow.books.add(book)
        self._sync_supplier_link(created)                                       # supplier_id -> book_suppliers-Eintrag nachziehen
        self._uow.commit()                                                      # Insert + Link-Upsert in einer Transaktion
        return created

    def update_book(self, book_id: str, book: dm.Book) -> dm.Book | None:
        if self._uow.books.get(book_id) is None:                                # Existenz-Check vor Update -> None -> 404 im Controller
            return None
        book.id = book_id                                                       # id aus URL uebernehmen, nicht aus Payload (sonst umhaengbar)
        book.updated_at = utc_now_iso()                                         # Zeitstempel serverseitig setzen, nie vom Client
        updated = self._uow.books.update(book)
        self._sync_supplier_link(updated)
        self._uow.commit()
        return updated

    def delete_book(self, book_id: str) -> bool:
        deleted = self._uow.books.delete(book_id)
        if deleted:                                                             # nur committen, wenn das Buch wirklich weg ist
            self._uow.commit()
        return deleted

    def _sync_supplier_link(self, book: dm.Book) -> None:
        """Haelt den book_suppliers-Eintrag konsistent mit book.supplier_id (anlegen oder Preis/SKU updaten)."""
        supplier_id = (book.supplier_id or "").strip()
        if not supplier_id:                                                     # kein Lieferant gewaehlt -> nichts zu tun
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
                is_primary=primary is None,                                     # erster Link eines Buchs wird automatisch primary
                last_purchase_price=price,
                created_at=now,
                updated_at=now,
            )
        else:
            link = dm.BookSupplierLink(                                         # bestehenden Link aktualisieren - is_primary + created_at bewahren
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
