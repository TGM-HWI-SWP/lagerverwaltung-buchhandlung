from __future__ import annotations

from uuid import uuid4

from sqlalchemy.orm import Session

from app.adapters.sqlalchemy_repositories import next_movement_id, sync_book_supplier_link
from app.core.time import utc_now_iso
from app.db.models import Book, BookSupplier, IncomingDelivery, Movement, PurchaseOrder, Supplier
from app.db.schemas import PurchaseOrderSchema, SupplierOrderRequest, SupplierSchema


class SupplierService:
    def __init__(self, db: Session):
        self._db = db

    def list_suppliers(self) -> list[Supplier]:
        return self._db.query(Supplier).order_by(Supplier.name.asc()).all()

    def get_supplier(self, supplier_id: str) -> Supplier | None:
        return self._db.query(Supplier).filter(Supplier.id == supplier_id).first()

    def create_supplier(self, supplier_data: SupplierSchema) -> Supplier:
        ids = self._db.query(Supplier.id).all()
        max_num = 0
        for (supplier_id,) in ids:
            if supplier_id and supplier_id.startswith("S") and supplier_id[1:].isdigit():
                max_num = max(max_num, int(supplier_id[1:]))

        supplier = Supplier(
            id=supplier_data.id or f"S{max_num + 1:03d}",
            name=supplier_data.name,
            contact=supplier_data.contact,
            address=supplier_data.address,
            notes=supplier_data.notes,
            created_at=supplier_data.created_at or utc_now_iso(),
        )
        self._db.add(supplier)
        self._db.commit()
        self._db.refresh(supplier)
        return supplier

    def list_purchase_orders(self) -> list[PurchaseOrder]:
        return self._db.query(PurchaseOrder).order_by(PurchaseOrder.created_at.desc()).all()

    def create_purchase_order(self, order_data: PurchaseOrderSchema) -> PurchaseOrder:
        supplier = self._db.query(Supplier).filter(Supplier.id == order_data.supplier_id).first()
        if supplier is None:
            raise ValueError("Lieferant nicht gefunden")

        book = self._db.query(Book).filter(Book.id == order_data.book_id).first()
        if book is None:
            raise ValueError("Buch nicht gefunden")

        existing_link = (
            self._db.query(BookSupplier)
            .filter(BookSupplier.book_id == book.id, BookSupplier.supplier_id == supplier.id)
            .first()
        )
        if existing_link is None:
            sync_book_supplier_link(
                self._db,
                book_id=book.id,
                supplier_id=supplier.id,
                purchase_price=book.purchase_price,
                supplier_sku=book.sku or "",
            )

        status = order_data.status
        if order_data.delivered_quantity == order_data.quantity:
            status = "geliefert"
        elif order_data.delivered_quantity > 0 and status == "offen":
            status = "teilgeliefert"

        order = PurchaseOrder(
            id=order_data.id or f"PO-{uuid4().hex[:12].upper()}",
            supplier_id=supplier.id,
            supplier_name=order_data.supplier_name or supplier.name,
            book_id=book.id,
            book_name=order_data.book_name or book.name,
            book_sku=order_data.book_sku or (book.sku or ""),
            unit_price=order_data.unit_price,
            quantity=order_data.quantity,
            delivered_quantity=order_data.delivered_quantity,
            status=status,
            created_at=order_data.created_at or utc_now_iso(),
            delivered_at=order_data.delivered_at,
        )
        self._db.add(order)
        self._db.commit()
        self._db.refresh(order)
        return order

    def receive_purchase_order(self, order_id: str, quantity: int) -> IncomingDelivery:
        order = self._db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
        if order is None:
            raise ValueError("Bestellung nicht gefunden")

        remaining_quantity = int(order.quantity) - int(order.delivered_quantity)
        if quantity > remaining_quantity:
            raise ValueError("Liefermenge ist groesser als die offene Restmenge")

        now = utc_now_iso()
        delivery = IncomingDelivery(
            id=f"IN-{uuid4().hex[:12].upper()}",
            order_id=order.id,
            supplier_id=order.supplier_id,
            supplier_name=order.supplier_name,
            book_id=order.book_id,
            book_name=order.book_name,
            quantity=quantity,
            unit_price=float(order.unit_price),
            received_at=now,
        )
        self._db.add(delivery)

        next_delivered = int(order.delivered_quantity) + quantity
        order.delivered_quantity = next_delivered
        order.status = "geliefert" if next_delivered >= int(order.quantity) else "teilgeliefert"
        order.delivered_at = now

        self._db.commit()
        self._db.refresh(delivery)
        return delivery

    def list_incoming_deliveries(self) -> list[IncomingDelivery]:
        return self._db.query(IncomingDelivery).order_by(IncomingDelivery.received_at.desc()).all()

    def book_incoming_delivery(
        self,
        delivery_id: str,
        performed_by: str = "system",
    ) -> Movement:
        delivery = self._db.query(IncomingDelivery).filter(IncomingDelivery.id == delivery_id).first()
        if delivery is None:
            raise ValueError("Wareneingang nicht gefunden")

        supplier = self._db.query(Supplier).filter(Supplier.id == delivery.supplier_id).first()
        if supplier is None:
            raise ValueError("Lieferant nicht gefunden")

        book = self._db.query(Book).filter(Book.id == delivery.book_id).first()
        if book is None:
            raise ValueError("Buch nicht gefunden")

        now = utc_now_iso()
        book.quantity = int(book.quantity) + int(delivery.quantity)
        book.purchase_price = float(delivery.unit_price)
        book.supplier_id = delivery.supplier_id
        book.updated_at = now
        sync_book_supplier_link(
            self._db,
            book_id=book.id,
            supplier_id=delivery.supplier_id,
            purchase_price=float(delivery.unit_price),
            supplier_sku=book.sku or "",
        )

        movement = Movement(
            id=next_movement_id(self._db),
            book_id=book.id,
            book_name=book.name,
            quantity_change=int(delivery.quantity),
            movement_type="IN",
            reason=f"Bestellung von {supplier.name}",
            timestamp=now,
            performed_by=performed_by,
        )
        self._db.add(movement)
        self._db.delete(delivery)
        self._db.commit()
        self._db.refresh(movement)
        return movement

    def get_supplier_stock(self, supplier_id: str) -> list[dict]:
        books = (
            self._db.query(Book, BookSupplier)
            .join(BookSupplier, BookSupplier.book_id == Book.id)
            .filter(BookSupplier.supplier_id == supplier_id)
            .order_by(Book.name.asc())
            .all()
        )
        return [
            {
                "book_id": book.id,
                "book_name": book.name,
                "quantity": int(book.quantity),
                "price": float(link.last_purchase_price or book.purchase_price),
            }
            for book, link in books
        ]

    def order_from_supplier(
        self,
        supplier_id: str,
        order_data: SupplierOrderRequest,
    ) -> Movement:
        supplier = self._db.query(Supplier).filter(Supplier.id == supplier_id).first()
        if supplier is None:
            raise ValueError("Lieferant nicht gefunden")

        book = self._db.query(Book).filter(Book.id == order_data.book_id).first()
        if book is None:
            raise ValueError("Buch nicht gefunden")

        link = (
            self._db.query(BookSupplier)
            .filter(BookSupplier.book_id == order_data.book_id, BookSupplier.supplier_id == supplier_id)
            .first()
        )
        if link is None:
            raise ValueError("Buch ist bei diesem Lieferanten nicht gelistet")

        now = utc_now_iso()
        book.quantity = int(book.quantity) + order_data.quantity
        book.updated_at = now
        book.supplier_id = supplier_id

        sync_book_supplier_link(
            self._db,
            book_id=book.id,
            supplier_id=supplier_id,
            purchase_price=float(link.last_purchase_price or book.purchase_price),
            supplier_sku=book.sku or "",
        )

        movement = Movement(
            id=next_movement_id(self._db),
            book_id=book.id,
            book_name=book.name,
            quantity_change=order_data.quantity,
            movement_type="IN",
            reason=f"Bestellung von {supplier.name}",
            timestamp=now,
            performed_by=order_data.performed_by,
        )
        self._db.add(movement)
        self._db.commit()
        self._db.refresh(movement)
        return movement
