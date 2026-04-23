from __future__ import annotations

from uuid import uuid4

from app.contracts.repositories import UnitOfWork
from app.core.time import utc_now_iso
from app.domain import models as dm


class SupplierService:
    """Use-Cases rund um Lieferanten: Stammdaten, Bestellungen, Wareneingaenge, Verbuchen."""

    def __init__(self, uow: UnitOfWork):
        self._uow = uow

    def list_suppliers(self) -> list[dm.Supplier]:
        return self._uow.suppliers.list()

    def get_supplier(self, supplier_id: str) -> dm.Supplier | None:
        return self._uow.suppliers.get(supplier_id)

    def create_supplier(self, supplier: dm.Supplier) -> dm.Supplier:
        """Legt einen Lieferanten an, vergibt S001/S002/... falls keine id kommt."""
        if not supplier.id:
            supplier.id = self._uow.suppliers.next_id()                         # Auto-ID SXXX, wenn Client keine schickt
        if not supplier.created_at:
            supplier.created_at = utc_now_iso()                                 # Zeitstempel serverseitig, nie vom Client
        created = self._uow.suppliers.add(supplier)
        self._uow.commit()
        return created

    def list_purchase_orders(self) -> list[dm.PurchaseOrder]:
        return self._uow.purchase_orders.list()

    def create_purchase_order(self, order: dm.PurchaseOrder) -> dm.PurchaseOrder:
        """Legt Bestellung an, stellt Buch-Lieferanten-Link sicher, leitet Status aus Liefermenge ab."""
        supplier = self._uow.suppliers.get(order.supplier_id)
        if supplier is None:
            raise ValueError("Lieferant nicht gefunden")

        book = self._uow.books.get(order.book_id)
        if book is None:
            raise ValueError("Buch nicht gefunden")

        if self._uow.book_supplier_links.get_for(book.id, supplier.id) is None:  # Buch muss beim Lieferanten gelistet sein...
            self._sync_link(                                                    # ...fehlt der Link, wird er hier nachgezogen
                book_id=book.id,
                supplier_id=supplier.id,
                purchase_price=float(book.purchase_price),
                supplier_sku=book.sku,
            )

        status = order.status                                                   # Status aus Mengen ableiten, Client-Status nur Fallback
        if order.delivered_quantity == order.quantity:
            status = "geliefert"
        elif order.delivered_quantity > 0 and status == "offen":
            status = "teilgeliefert"

        to_persist = dm.PurchaseOrder(
            id=order.id,
            supplier_id=supplier.id,
            supplier_name=order.supplier_name or supplier.name,                 # Snapshot des Namens - bleibt auch wenn Lieferant spaeter umbenannt wird
            book_id=book.id,
            book_name=order.book_name or book.name,                             # Snapshot des Buchnamens - historische Integritaet
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
        """Meldet einen Wareneingang zu einer Bestellung - noch NICHT ins Lager gebucht (das macht book_incoming_delivery)."""
        order = self._uow.purchase_orders.get(order_id)
        if order is None:
            raise ValueError("Bestellung nicht gefunden")

        remaining = order.quantity - order.delivered_quantity                   # offene Restmenge der Bestellung
        if quantity > remaining:
            raise ValueError("Liefermenge ist größer als die offene Restmenge")

        now = utc_now_iso()
        delivery = dm.IncomingDelivery(
            id=f"IN-{uuid4().hex[:12].upper()}",                                # IN-Prefix trennt optisch von Bestell-/Movement-IDs
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
        order.status = "geliefert" if order.delivered_quantity >= order.quantity else "teilgeliefert"  # Status automatisch aus Mengen
        order.delivered_at = now
        self._uow.purchase_orders.update(order)

        self._uow.commit()                                                      # Delivery + Order-Update gemeinsam committen (atomar)
        return created

    def list_incoming_deliveries(self) -> list[dm.IncomingDelivery]:
        return self._uow.incoming_deliveries.list()

    def book_incoming_delivery(
        self,
        delivery_id: str,
        performed_by: str = "system",
    ) -> dm.Movement:
        """Bucht einen gemeldeten Wareneingang ins Lager: Bestand rauf, Movement rein, Delivery weg."""
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
        book.quantity = book.quantity + delivery.quantity                       # Lagerbestand um Liefermenge erhoehen
        book.purchase_price = float(delivery.unit_price)                        # letzten Einkaufspreis aus Lieferung uebernehmen
        book.supplier_id = delivery.supplier_id                                 # Primaer-Lieferant aktualisieren (zuletzt geliefert = primaer)
        book.updated_at = now
        self._uow.books.update(book)
        self._sync_link(                                                        # Link-Preis aktualisieren bzw. Link anlegen falls neu
            book_id=book.id,
            supplier_id=delivery.supplier_id,
            purchase_price=float(delivery.unit_price),
            supplier_sku=book.sku,
        )

        movement = dm.Movement(                                                 # Protokolleintrag fuer Audit/Historie
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
        self._uow.incoming_deliveries.delete(delivery.id)                       # Pending-Delivery aufloesen - Verbuchung = Ende ihrer Existenz

        self._uow.commit()                                                      # 4 Writes in einer Transaktion - alles oder nichts
        return created

    def get_supplier_stock(self, supplier_id: str) -> list[dm.SupplierStockEntry]:
        return self._uow.book_supplier_links.stock_for_supplier(supplier_id)    # Buecher dieses Lieferanten mit Bestand/Preis

    def order_from_supplier(
        self,
        supplier_id: str,
        book_id: str,
        quantity: int,
        performed_by: str = "system",
    ) -> dm.Movement:
        """Vor Release deaktiviert - der regulaere Bestellfluss ist create_purchase_order -> receive -> book."""
        raise ValueError(                                                       # Shortcut umging den Audit-Fluss, darum bis auf weiteres gesperrt
            "Direkte Lagerbuchungen über 'order_from_supplier' sind vor Release deaktiviert. "
            "Bitte den regulären Bestellfluss über /purchase-orders, /receive und /incoming-deliveries/book verwenden."
        )

    def _sync_link(
        self,
        *,
        book_id: str,
        supplier_id: str,
        purchase_price: float,
        supplier_sku: str,
    ) -> None:
        """Legt einen Book-Supplier-Link an oder aktualisiert Preis/SKU (entspricht BooksService._sync_supplier_link)."""
        supplier_id = (supplier_id or "").strip()
        if not supplier_id:                                                     # leere supplier_id -> nichts zu tun
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
                is_primary=primary is None,                                     # erster Link wird automatisch primary
                last_purchase_price=price,
                created_at=now,
                updated_at=now,
            )
        else:
            link = dm.BookSupplierLink(                                         # bestehenden Link aktualisieren - is_primary + created_at bewahren
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
