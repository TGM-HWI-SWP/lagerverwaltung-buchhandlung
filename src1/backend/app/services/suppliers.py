from __future__ import annotations

from uuid import uuid4

from app.contracts.repositories import UnitOfWork
from app.core.time import utc_now_iso
from app.domain import models as dm


class SupplierService:
    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def list_suppliers(self) -> list[dm.Supplier]:
        return self._uow.suppliers.list()

    def get_supplier(self, supplier_id: str) -> dm.Supplier | None:
        return self._uow.suppliers.get(supplier_id)

    def create_supplier(self, supplier: dm.Supplier) -> dm.Supplier:
        if not supplier.id:
            supplier.id = self._uow.suppliers.next_id()
        if not supplier.created_at:
            supplier.created_at = utc_now_iso()
        created = self._uow.suppliers.add(supplier)
        self._uow.commit()
        return created

    def list_purchase_orders(self) -> list[dm.PurchaseOrder]:
        return self._uow.purchase_orders.list()

    def create_purchase_order(self, order: dm.PurchaseOrder) -> dm.PurchaseOrder:
        supplier = self._uow.suppliers.get(order.supplier_id)
        if supplier is None:
            raise ValueError("Lieferant nicht gefunden")

        book = self._uow.books.get(order.book_id)
        if book is None:
            raise ValueError("Buch nicht gefunden")

        if self._uow.book_supplier_links.get_for(book.id, supplier.id) is None:
            self._sync_link(
                book_id=book.id,
                supplier_id=supplier.id,
                purchase_price=float(book.purchase_price),
                supplier_sku=book.sku,
            )

        status = order.status
        if order.delivered_quantity == order.quantity:
            status = "geliefert"
        elif order.delivered_quantity > 0 and status == "offen":
            status = "teilgeliefert"

        to_persist = dm.PurchaseOrder(
            id=order.id,
            supplier_id=supplier.id,
            supplier_name=order.supplier_name or supplier.name,
            book_id=book.id,
            book_name=order.book_name or book.name,
            book_sku=order.book_sku or book.sku,
            unit_price=order.unit_price,
            quantity=order.quantity,
            delivered_quantity=order.delivered_quantity,
            status=status,
            created_at=order.created_at or utc_now_iso(),
            delivered_at=order.delivered_at,
        )
        created = self._uow.purchase_orders.add(to_persist)
        self._uow.commit()
        return created

    def receive_purchase_order(self, order_id: str, quantity: int) -> dm.IncomingDelivery:
        order = self._uow.purchase_orders.get(order_id)
        if order is None:
            raise ValueError("Bestellung nicht gefunden")

        remaining = order.quantity - order.delivered_quantity
        if quantity > remaining:
            raise ValueError("Liefermenge ist größer als die offene Restmenge")

        now = utc_now_iso()
        delivery = dm.IncomingDelivery(
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
        created = self._uow.incoming_deliveries.add(delivery)

        order.delivered_quantity = order.delivered_quantity + quantity
        order.status = "geliefert" if order.delivered_quantity >= order.quantity else "teilgeliefert"
        order.delivered_at = now
        self._uow.purchase_orders.update(order)

        self._uow.commit()
        return created

    def list_incoming_deliveries(self) -> list[dm.IncomingDelivery]:
        return self._uow.incoming_deliveries.list()

    def book_incoming_delivery(
        self,
        delivery_id: str,
        performed_by: str = "system",
    ) -> dm.Movement:
        delivery = self._uow.incoming_deliveries.get(delivery_id)
        if delivery is None:
            raise ValueError("Wareneingang nicht gefunden")

        supplier = self._uow.suppliers.get(delivery.supplier_id)
        if supplier is None:
            raise ValueError("Lieferant nicht gefunden")

        book = self._uow.books.get(delivery.book_id)
        if book is None:
            raise ValueError("Buch nicht gefunden")

        now = utc_now_iso()
        book.quantity = book.quantity + delivery.quantity
        book.purchase_price = float(delivery.unit_price)
        book.supplier_id = delivery.supplier_id
        book.updated_at = now
        self._uow.books.update(book)
        self._sync_link(
            book_id=book.id,
            supplier_id=delivery.supplier_id,
            purchase_price=float(delivery.unit_price),
            supplier_sku=book.sku,
        )

        movement = dm.Movement(
            id=self._uow.movements.next_id(),
            book_id=book.id,
            book_name=book.name,
            quantity_change=delivery.quantity,
            movement_type="IN",
            reason=f"Bestellung von {supplier.name}",
            timestamp=now,
            performed_by=performed_by,
        )
        created = self._uow.movements.add(movement)
        self._uow.incoming_deliveries.delete(delivery.id)

        self._uow.commit()
        return created

    def get_supplier_stock(self, supplier_id: str) -> list[dm.SupplierStockEntry]:
        return self._uow.book_supplier_links.stock_for_supplier(supplier_id)

    def order_from_supplier(
        self,
        supplier_id: str,
        book_id: str,
        quantity: int,
        performed_by: str = "system",
    ) -> dm.Movement:
        supplier = self._uow.suppliers.get(supplier_id)
        if supplier is None:
            raise ValueError("Lieferant nicht gefunden")

        book = self._uow.books.get(book_id)
        if book is None:
            raise ValueError("Buch nicht gefunden")

        link = self._uow.book_supplier_links.get_for(book_id, supplier_id)
        if link is None:
            raise ValueError("Buch ist bei diesem Lieferanten nicht gelistet")

        now = utc_now_iso()
        book.quantity = book.quantity + quantity
        book.updated_at = now
        book.supplier_id = supplier_id
        self._uow.books.update(book)

        self._sync_link(
            book_id=book.id,
            supplier_id=supplier_id,
            purchase_price=float(link.last_purchase_price or book.purchase_price),
            supplier_sku=book.sku,
        )

        movement = dm.Movement(
            id=self._uow.movements.next_id(),
            book_id=book.id,
            book_name=book.name,
            quantity_change=quantity,
            movement_type="IN",
            reason=f"Bestellung von {supplier.name}",
            timestamp=now,
            performed_by=performed_by,
        )
        created = self._uow.movements.add(movement)
        self._uow.commit()
        return created

    def _sync_link(
        self,
        *,
        book_id: str,
        supplier_id: str,
        purchase_price: float,
        supplier_sku: str,
    ) -> None:
        supplier_id = (supplier_id or "").strip()
        if not supplier_id:
            return
        now = utc_now_iso()
        existing = self._uow.book_supplier_links.get_for(book_id, supplier_id)
        price = float(purchase_price or 0)
        if existing is None:
            primary = self._uow.book_supplier_links.primary_for(book_id)
            link = dm.BookSupplierLink(
                id=str(uuid4()),
                book_id=book_id,
                supplier_id=supplier_id,
                supplier_sku=supplier_sku or "",
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
                supplier_sku=supplier_sku or existing.supplier_sku or "",
                is_primary=existing.is_primary,
                last_purchase_price=price,
                created_at=existing.created_at,
                updated_at=now,
            )
        self._uow.book_supplier_links.upsert(link)
