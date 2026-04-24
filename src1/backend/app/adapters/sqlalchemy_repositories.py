from __future__ import annotations

import re

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.adapters import mappers
from app.contracts.repositories import (
    BookRepository,
    BookSupplierLinkRepository,
    IncomingDeliveryRepository,
    MovementRepository,
    PurchaseOrderRepository,
    SupplierRepository,
    UnitOfWork,
)
from app.db import models as orm
from app.domain import models as dm

# Konkrete SQLAlchemy-Implementierungen der Repository-Protokolle aus contracts/.
# Diese Schicht ist der einzige Ort, der SQL/ORM kennt - Services sehen nur die abstrakten Ports.
# flush() in add()/update() erzwingt SQL jetzt (fuer z.B. DB-generierte Defaults),
# committen tut aber nur der UnitOfWork am Ende des Use-Case.


class SqlAlchemyBookRepository(BookRepository):
    """SQLAlchemy-Adapter fuer BookRepository - CRUD inkl. kaskadiertem Loeschen der Supplier-Links."""

    def __init__(self, db: Session):
        self._db = db

    def list(self) -> list[dm.Book]:
        rows = self._db.query(orm.Book).order_by(orm.Book.name.asc()).all()     # alphabetisch fuer stabile UI
        return [mappers.book_to_domain(row) for row in rows]

    def get(self, book_id: str) -> dm.Book | None:
        row = self._db.query(orm.Book).filter(orm.Book.id == book_id).first()
        return mappers.book_to_domain(row) if row else None

    def add(self, book: dm.Book) -> dm.Book:
        row = orm.Book(
            id=book.id,
            name=book.name,
            author=book.author,
            description=book.description,
            purchase_price=book.purchase_price,
            sell_price=book.sell_price,
            quantity=book.quantity,
            sku=book.sku,
            category=book.category,
            supplier_id=book.supplier_id,
            created_at=book.created_at,
            updated_at=book.updated_at,
            notes=book.notes,
        )
        self._db.add(row)                                                       # Row im Session-Cache anmelden...
        self._db.flush()                                                        # ...und INSERT sofort absetzen (ohne commit)
        return mappers.book_to_domain(row)

    def update(self, book: dm.Book) -> dm.Book:
        row = self._db.query(orm.Book).filter(orm.Book.id == book.id).first()
        if row is None:
            raise LookupError(f"Book {book.id} not found")                      # sollte nie passieren - Service prueft vorher
        mappers.book_apply(row, book)                                           # Werte in die bestehende Row schreiben (ORM trackt dirty)
        self._db.flush()
        return mappers.book_to_domain(row)

    def delete(self, book_id: str) -> bool:
        row = self._db.query(orm.Book).filter(orm.Book.id == book_id).first()
        if row is None:
            return False
        try:
            (                                                                   # Kaskade von Hand: BookSupplier-Links zuerst weg...
                self._db.query(orm.BookSupplier)
                .filter(orm.BookSupplier.book_id == book_id)
                .delete(synchronize_session=False)                              # synchronize_session=False: schneller, nur erlaubt da wir gleich committen
            )
            self._db.delete(row)                                                # ...dann das Buch selbst
            self._db.flush()
        except IntegrityError as exc:                                           # verbleibende FKs (Movements/Orders/Deliveries) blocken das Loeschen
            self._db.rollback()
            raise ValueError(
                "Das Buch kann nicht gelöscht werden, weil noch Bewegungen, Bestellungen oder Wareneingänge damit verknüpft sind."
            ) from exc
        return True


class SqlAlchemyMovementRepository(MovementRepository):
    """SQLAlchemy-Adapter fuer MovementRepository - Bewegungen sind append-only (siehe Service-Regel)."""

    def __init__(self, db: Session):
        self._db = db

    def list(self) -> list[dm.Movement]:
        rows = self._db.query(orm.Movement).order_by(orm.Movement.timestamp.desc()).all()  # neueste zuerst fuer Historie-UI
        return [mappers.movement_to_domain(row) for row in rows]

    def get(self, movement_id: str) -> dm.Movement | None:
        row = self._db.query(orm.Movement).filter(orm.Movement.id == movement_id).first()
        return mappers.movement_to_domain(row) if row else None

    def add(self, movement: dm.Movement) -> dm.Movement:
        row = orm.Movement(
            id=movement.id,
            book_id=movement.book_id,
            book_name=movement.book_name,
            quantity_change=movement.quantity_change,
            movement_type=movement.movement_type,
            reason=movement.reason,
            timestamp=movement.timestamp,
            performed_by=movement.performed_by,
        )
        self._db.add(row)
        self._db.flush()
        return mappers.movement_to_domain(row)

    def update(self, movement: dm.Movement) -> dm.Movement:
        row = self._db.query(orm.Movement).filter(orm.Movement.id == movement.id).first()
        if row is None:
            raise LookupError(f"Movement {movement.id} not found")
        mappers.movement_apply(row, movement)
        self._db.flush()
        return mappers.movement_to_domain(row)

    def delete(self, movement_id: str) -> bool:
        row = self._db.query(orm.Movement).filter(orm.Movement.id == movement_id).first()
        if row is None:
            return False
        self._db.delete(row)
        self._db.flush()
        return True

    def next_id(self) -> str:
        """Sucht die hoechste M<Zahl>-ID und gibt die naechste zurueck, z.B. M007 -> M008."""
        ids = self._db.query(orm.Movement.id).all()                             # holt ALLE IDs - bei grossen Tabellen ineffizient; fuer unser Volumen OK
        max_num = 0
        for (mid,) in ids:
            match = re.fullmatch(r"M(\d+)", mid or "")                          # ignoriert evtl. nicht-konforme IDs (z.B. Altdaten)
            if match:
                num = int(match.group(1))
                if num > max_num:
                    max_num = num
        return f"M{max_num + 1:03d}"                                            # :03d -> "001", "012", "123" (ab 1000 laenger - OK)


class SqlAlchemySupplierRepository(SupplierRepository):
    """SQLAlchemy-Adapter fuer SupplierRepository."""

    def __init__(self, db: Session):
        self._db = db

    def list(self) -> list[dm.Supplier]:
        rows = self._db.query(orm.Supplier).order_by(orm.Supplier.name.asc()).all()
        return [mappers.supplier_to_domain(row) for row in rows]

    def get(self, supplier_id: str) -> dm.Supplier | None:
        row = self._db.query(orm.Supplier).filter(orm.Supplier.id == supplier_id).first()
        return mappers.supplier_to_domain(row) if row else None

    def add(self, supplier: dm.Supplier) -> dm.Supplier:
        row = orm.Supplier(
            id=supplier.id,
            name=supplier.name,
            contact=supplier.contact,
            address=supplier.address,
            notes=supplier.notes,
            created_at=supplier.created_at,
        )
        self._db.add(row)
        self._db.flush()
        return mappers.supplier_to_domain(row)

    def next_id(self) -> str:
        """Analog zu Movement.next_id(), aber mit Prefix S (S001, S002, ...)."""
        ids = self._db.query(orm.Supplier.id).all()
        max_num = 0
        for (supplier_id,) in ids:
            if supplier_id and supplier_id.startswith("S") and supplier_id[1:].isdigit():  # simpler Parser statt Regex
                max_num = max(max_num, int(supplier_id[1:]))
        return f"S{max_num + 1:03d}"


class SqlAlchemyPurchaseOrderRepository(PurchaseOrderRepository):
    """SQLAlchemy-Adapter fuer PurchaseOrderRepository."""

    def __init__(self, db: Session):
        self._db = db

    def list(self) -> list[dm.PurchaseOrder]:
        rows = (
            self._db.query(orm.PurchaseOrder)
            .order_by(orm.PurchaseOrder.created_at.desc())                      # neueste Bestellung zuerst
            .all()
        )
        return [mappers.purchase_order_to_domain(row) for row in rows]

    def get(self, order_id: str) -> dm.PurchaseOrder | None:
        row = self._db.query(orm.PurchaseOrder).filter(orm.PurchaseOrder.id == order_id).first()
        return mappers.purchase_order_to_domain(row) if row else None

    def add(self, order: dm.PurchaseOrder) -> dm.PurchaseOrder:
        row = orm.PurchaseOrder(
            id=order.id,
            supplier_id=order.supplier_id,
            supplier_name=order.supplier_name,
            book_id=order.book_id,
            book_name=order.book_name,
            book_sku=order.book_sku,
            unit_price=order.unit_price,
            quantity=order.quantity,
            delivered_quantity=order.delivered_quantity,
            status=order.status,
            created_at=order.created_at,
            delivered_at=order.delivered_at,
        )
        self._db.add(row)
        self._db.flush()
        return mappers.purchase_order_to_domain(row)

    def update(self, order: dm.PurchaseOrder) -> dm.PurchaseOrder:
        row = self._db.query(orm.PurchaseOrder).filter(orm.PurchaseOrder.id == order.id).first()
        if row is None:
            raise LookupError(f"PurchaseOrder {order.id} not found")
        mappers.purchase_order_apply(row, order)
        self._db.flush()
        return mappers.purchase_order_to_domain(row)

    def delete(self, order_id: str) -> bool:
        deleted = self._db.query(orm.PurchaseOrder).filter(orm.PurchaseOrder.id == order_id).delete(synchronize_session=False)
        return bool(deleted)


class SqlAlchemyIncomingDeliveryRepository(IncomingDeliveryRepository):
    """SQLAlchemy-Adapter fuer IncomingDeliveryRepository - Eintraege leben nur bis zur Verbuchung."""

    def __init__(self, db: Session):
        self._db = db

    def list(self) -> list[dm.IncomingDelivery]:
        rows = (
            self._db.query(orm.IncomingDelivery)
            .order_by(orm.IncomingDelivery.received_at.desc())                  # zuletzt gemeldet zuerst
            .all()
        )
        return [mappers.incoming_delivery_to_domain(row) for row in rows]

    def get(self, delivery_id: str) -> dm.IncomingDelivery | None:
        row = (
            self._db.query(orm.IncomingDelivery)
            .filter(orm.IncomingDelivery.id == delivery_id)
            .first()
        )
        return mappers.incoming_delivery_to_domain(row) if row else None

    def add(self, delivery: dm.IncomingDelivery) -> dm.IncomingDelivery:
        row = orm.IncomingDelivery(
            id=delivery.id,
            order_id=delivery.order_id,
            supplier_id=delivery.supplier_id,
            supplier_name=delivery.supplier_name,
            book_id=delivery.book_id,
            book_name=delivery.book_name,
            quantity=delivery.quantity,
            unit_price=delivery.unit_price,
            received_at=delivery.received_at,
        )
        self._db.add(row)
        self._db.flush()
        return mappers.incoming_delivery_to_domain(row)

    def delete(self, delivery_id: str) -> bool:
        row = (
            self._db.query(orm.IncomingDelivery)
            .filter(orm.IncomingDelivery.id == delivery_id)
            .first()
        )
        if row is None:
            return False
        self._db.delete(row)
        self._db.flush()
        return True


class SqlAlchemyBookSupplierLinkRepository(BookSupplierLinkRepository):
    """SQLAlchemy-Adapter fuer BookSupplierLinkRepository - N:M-Link Buch <-> Lieferant."""

    def __init__(self, db: Session):
        self._db = db

    def get_for(self, book_id: str, supplier_id: str) -> dm.BookSupplierLink | None:
        row = (
            self._db.query(orm.BookSupplier)
            .filter(
                orm.BookSupplier.book_id == book_id,
                orm.BookSupplier.supplier_id == supplier_id,
            )
            .first()
        )
        return mappers.book_supplier_link_to_domain(row) if row else None

    def primary_for(self, book_id: str) -> dm.BookSupplierLink | None:
        row = (
            self._db.query(orm.BookSupplier)
            .filter(
                orm.BookSupplier.book_id == book_id,
                orm.BookSupplier.is_primary.is_(True),
            )
            .first()
        )
        return mappers.book_supplier_link_to_domain(row) if row else None

    def upsert(self, link: dm.BookSupplierLink) -> dm.BookSupplierLink:
        """INSERT wenn neu, sonst UPDATE der wechselhaften Felder - id/created_at/is_primary bleiben."""
        row = (
            self._db.query(orm.BookSupplier)
            .filter(                                                            # anhand (book_id, supplier_id), nicht per PK
                orm.BookSupplier.book_id == link.book_id,
                orm.BookSupplier.supplier_id == link.supplier_id,
            )
            .first()
        )
        if row is None:
            row = orm.BookSupplier(                                             # neuer Link
                id=link.id,
                book_id=link.book_id,
                supplier_id=link.supplier_id,
                supplier_sku=link.supplier_sku,
                is_primary=link.is_primary,
                last_purchase_price=link.last_purchase_price,
                created_at=link.created_at,
                updated_at=link.updated_at,
            )
            self._db.add(row)
        else:                                                                   # bestehenden Link updaten - NICHT id/book_id/supplier_id/created_at anfassen
            row.supplier_sku = link.supplier_sku
            row.is_primary = link.is_primary
            row.last_purchase_price = link.last_purchase_price
            row.updated_at = link.updated_at
        self._db.flush()
        return mappers.book_supplier_link_to_domain(row)

    def delete_for_book(self, book_id: str) -> int:
        """Loescht alle Links eines Buchs - Bulk-Delete ohne Einzel-Objekt-Tracking."""
        return (
            self._db.query(orm.BookSupplier)
            .filter(orm.BookSupplier.book_id == book_id)
            .delete(synchronize_session=False)                                  # schneller als Row-weise, aber Session-Cache wird nicht aktualisiert
        )

    def stock_for_supplier(self, supplier_id: str) -> list[dm.SupplierStockEntry]:
        """Liefert alle Buecher dieses Lieferanten mit aktuellem Bestand und zuletzt gezahltem Preis."""
        rows = (
            self._db.query(orm.Book, orm.BookSupplier)                          # Tupel-Query: beide Tabellen zusammen
            .join(orm.BookSupplier, orm.BookSupplier.book_id == orm.Book.id)
            .filter(orm.BookSupplier.supplier_id == supplier_id)
            .order_by(orm.Book.name.asc())
            .all()
        )
        return [
            dm.SupplierStockEntry(
                book_id=book.id,
                book_name=book.name,
                quantity=int(book.quantity),
                price=float(link.last_purchase_price or book.purchase_price),   # Link-Preis bevorzugt, Buch-Preis als Fallback
            )
            for book, link in rows
        ]


class SqlAlchemyUnitOfWork(UnitOfWork):
    """Buendelt alle Repositories auf derselben Session, damit ein Use-Case eine einzige Transaktion hat."""

    def __init__(self, db: Session):
        self._db = db
        # Alle Repos teilen SICH die gleiche Session -> commit() auf UoW committet alles gemeinsam.
        self.books: BookRepository = SqlAlchemyBookRepository(db)
        self.movements: MovementRepository = SqlAlchemyMovementRepository(db)
        self.suppliers: SupplierRepository = SqlAlchemySupplierRepository(db)
        self.purchase_orders: PurchaseOrderRepository = SqlAlchemyPurchaseOrderRepository(db)
        self.incoming_deliveries: IncomingDeliveryRepository = SqlAlchemyIncomingDeliveryRepository(db)
        self.book_supplier_links: BookSupplierLinkRepository = SqlAlchemyBookSupplierLinkRepository(db)

    def commit(self) -> None:
        self._db.commit()                                                       # persistiert alles seit dem letzten commit/rollback

    def rollback(self) -> None:
        self._db.rollback()                                                     # verwirft alle noch offenen Aenderungen

    def flush(self) -> None:
        self._db.flush()                                                        # schickt SQL jetzt - ohne zu committen (fuer Zwischenergebnisse)
