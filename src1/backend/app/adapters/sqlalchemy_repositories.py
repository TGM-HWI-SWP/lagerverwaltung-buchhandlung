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


class SqlAlchemyBookRepository(BookRepository):
    def __init__(self, db: Session):
        self._db = db

    def list(self) -> list[dm.Book]:
        rows = self._db.query(orm.Book).order_by(orm.Book.name.asc()).all()
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
        self._db.add(row)
        self._db.flush()
        return mappers.book_to_domain(row)

    def update(self, book: dm.Book) -> dm.Book:
        row = self._db.query(orm.Book).filter(orm.Book.id == book.id).first()
        if row is None:
            raise LookupError(f"Book {book.id} not found")
        mappers.book_apply(row, book)
        self._db.flush()
        return mappers.book_to_domain(row)

    def delete(self, book_id: str) -> bool:
        row = self._db.query(orm.Book).filter(orm.Book.id == book_id).first()
        if row is None:
            return False
        try:
            (
                self._db.query(orm.BookSupplier)
                .filter(orm.BookSupplier.book_id == book_id)
                .delete(synchronize_session=False)
            )
            self._db.delete(row)
            self._db.flush()
        except IntegrityError as exc:
            self._db.rollback()
            raise ValueError(
                "Das Buch kann nicht gelöscht werden, weil noch Bewegungen, Bestellungen oder Wareneingänge damit verknüpft sind."
            ) from exc
        return True


class SqlAlchemyMovementRepository(MovementRepository):
    def __init__(self, db: Session):
        self._db = db

    def list(self) -> list[dm.Movement]:
        rows = self._db.query(orm.Movement).order_by(orm.Movement.timestamp.desc()).all()
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
        ids = self._db.query(orm.Movement.id).all()
        max_num = 0
        for (mid,) in ids:
            match = re.fullmatch(r"M(\d+)", mid or "")
            if match:
                num = int(match.group(1))
                if num > max_num:
                    max_num = num
        return f"M{max_num + 1:03d}"


class SqlAlchemySupplierRepository(SupplierRepository):
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
        ids = self._db.query(orm.Supplier.id).all()
        max_num = 0
        for (supplier_id,) in ids:
            if supplier_id and supplier_id.startswith("S") and supplier_id[1:].isdigit():
                max_num = max(max_num, int(supplier_id[1:]))
        return f"S{max_num + 1:03d}"


class SqlAlchemyPurchaseOrderRepository(PurchaseOrderRepository):
    def __init__(self, db: Session):
        self._db = db

    def list(self) -> list[dm.PurchaseOrder]:
        rows = (
            self._db.query(orm.PurchaseOrder)
            .order_by(orm.PurchaseOrder.created_at.desc())
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


class SqlAlchemyIncomingDeliveryRepository(IncomingDeliveryRepository):
    def __init__(self, db: Session):
        self._db = db

    def list(self) -> list[dm.IncomingDelivery]:
        rows = (
            self._db.query(orm.IncomingDelivery)
            .order_by(orm.IncomingDelivery.received_at.desc())
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
        row = (
            self._db.query(orm.BookSupplier)
            .filter(
                orm.BookSupplier.book_id == link.book_id,
                orm.BookSupplier.supplier_id == link.supplier_id,
            )
            .first()
        )
        if row is None:
            row = orm.BookSupplier(
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
        else:
            row.supplier_sku = link.supplier_sku
            row.is_primary = link.is_primary
            row.last_purchase_price = link.last_purchase_price
            row.updated_at = link.updated_at
        self._db.flush()
        return mappers.book_supplier_link_to_domain(row)

    def delete_for_book(self, book_id: str) -> int:
        return (
            self._db.query(orm.BookSupplier)
            .filter(orm.BookSupplier.book_id == book_id)
            .delete(synchronize_session=False)
        )

    def stock_for_supplier(self, supplier_id: str) -> list[dm.SupplierStockEntry]:
        rows = (
            self._db.query(orm.Book, orm.BookSupplier)
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
                price=float(link.last_purchase_price or book.purchase_price),
            )
            for book, link in rows
        ]


class SqlAlchemyUnitOfWork(UnitOfWork):
    def __init__(self, db: Session):
        self._db = db
        self.books: BookRepository = SqlAlchemyBookRepository(db)
        self.movements: MovementRepository = SqlAlchemyMovementRepository(db)
        self.suppliers: SupplierRepository = SqlAlchemySupplierRepository(db)
        self.purchase_orders: PurchaseOrderRepository = SqlAlchemyPurchaseOrderRepository(db)
        self.incoming_deliveries: IncomingDeliveryRepository = SqlAlchemyIncomingDeliveryRepository(db)
        self.book_supplier_links: BookSupplierLinkRepository = SqlAlchemyBookSupplierLinkRepository(db)

    def commit(self) -> None:
        self._db.commit()

    def rollback(self) -> None:
        self._db.rollback()

    def flush(self) -> None:
        self._db.flush()
