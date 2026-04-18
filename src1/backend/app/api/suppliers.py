from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.adapters.sqlalchemy_repositories import next_movement_id, sync_book_supplier_link
from app.db.models import (
    Supplier,
    Book,
    BookSupplier,
    Movement,
    PurchaseOrder,
    IncomingDelivery,
)


def get_all_suppliers(db: Session) -> list[Supplier]:
    """Alle Lieferanten abrufen."""
    return db.query(Supplier).order_by(Supplier.name.asc()).all()


def get_supplier(db: Session, supplier_id: str) -> Supplier | None:
    """Einen Lieferanten per ID abrufen."""
    return db.query(Supplier).filter(Supplier.id == supplier_id).first()


def create_supplier(db: Session, supplier_data) -> Supplier:
    """Neuen Lieferanten anlegen."""
    ids = db.query(Supplier.id).all()
    max_num = 0
    for (supplier_id,) in ids:
        if supplier_id and supplier_id.startswith("S") and supplier_id[1:].isdigit():
            max_num = max(max_num, int(supplier_id[1:]))

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    supplier = Supplier(
        id=supplier_data.id or f"S{max_num + 1:03d}",
        name=supplier_data.name,
        contact=supplier_data.contact,
        address=supplier_data.address,
        notes=supplier_data.notes,
        created_at=supplier_data.created_at or now,
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


def get_all_purchase_orders(db: Session) -> list[PurchaseOrder]:
    return db.query(PurchaseOrder).order_by(PurchaseOrder.created_at.desc()).all()


def create_purchase_order(db: Session, order_data) -> PurchaseOrder:
    supplier = db.query(Supplier).filter(Supplier.id == order_data.supplier_id).first()
    if supplier is None:
        raise ValueError("Lieferant nicht gefunden")

    book = db.query(Book).filter(Book.id == order_data.book_id).first()
    if book is None:
        raise ValueError("Buch nicht gefunden")
    if (
        db.query(BookSupplier)
        .filter(BookSupplier.book_id == book.id, BookSupplier.supplier_id == supplier.id)
        .first()
        is None
    ):
        sync_book_supplier_link(
            db,
            book_id=book.id,
            supplier_id=supplier.id,
            purchase_price=book.purchase_price,
            supplier_sku=book.sku or "",
        )

    quantity = int(order_data.quantity)
    if quantity <= 0:
        raise ValueError("Menge muss groesser als 0 sein")

    delivered_quantity = int(order_data.delivered_quantity or 0)
    if delivered_quantity < 0:
        raise ValueError("Gelieferte Menge darf nicht negativ sein")
    if delivered_quantity > quantity:
        raise ValueError("Gelieferte Menge darf nicht groesser als Bestellmenge sein")

    unit_price = float(order_data.unit_price)
    if unit_price < 0:
        raise ValueError("Preis darf nicht negativ sein")

    created_at = order_data.created_at or datetime.now(timezone.utc).isoformat()
    status = order_data.status or "offen"
    if delivered_quantity == quantity:
        status = "geliefert"
    elif delivered_quantity > 0 and status == "offen":
        status = "teilgeliefert"

    order = PurchaseOrder(
        id=order_data.id or f"PO-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}",
        supplier_id=supplier.id,
        supplier_name=order_data.supplier_name or supplier.name,
        book_id=book.id,
        book_name=order_data.book_name or book.name,
        book_sku=order_data.book_sku or (book.sku or ""),
        unit_price=unit_price,
        quantity=quantity,
        delivered_quantity=delivered_quantity,
        status=status,
        created_at=created_at,
        delivered_at=order_data.delivered_at,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def receive_purchase_order(db: Session, order_id: str, quantity: int) -> IncomingDelivery:
    order = db.query(PurchaseOrder).filter(PurchaseOrder.id == order_id).first()
    if order is None:
        raise ValueError("Bestellung nicht gefunden")

    if quantity <= 0:
        raise ValueError("Liefermenge muss groesser als 0 sein")

    remaining_quantity = int(order.quantity) - int(order.delivered_quantity)
    if quantity > remaining_quantity:
        raise ValueError("Liefermenge ist groesser als die offene Restmenge")

    now = datetime.now(timezone.utc).isoformat()
    delivery = IncomingDelivery(
        id=f"IN-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S%f')}",
        order_id=order.id,
        supplier_id=order.supplier_id,
        supplier_name=order.supplier_name,
        book_id=order.book_id,
        book_name=order.book_name,
        quantity=quantity,
        unit_price=float(order.unit_price),
        received_at=now,
    )
    db.add(delivery)

    next_delivered = int(order.delivered_quantity) + quantity
    order.delivered_quantity = next_delivered
    order.status = "geliefert" if next_delivered >= int(order.quantity) else "teilgeliefert"
    order.delivered_at = now

    db.commit()
    db.refresh(delivery)
    return delivery


def get_all_incoming_deliveries(db: Session) -> list[IncomingDelivery]:
    return db.query(IncomingDelivery).order_by(IncomingDelivery.received_at.desc()).all()


def book_incoming_delivery(
    db: Session,
    delivery_id: str,
    performed_by: str = "system",
) -> Movement:
    delivery = db.query(IncomingDelivery).filter(IncomingDelivery.id == delivery_id).first()
    if delivery is None:
        raise ValueError("Wareneingang nicht gefunden")

    supplier = db.query(Supplier).filter(Supplier.id == delivery.supplier_id).first()
    if supplier is None:
        raise ValueError("Lieferant nicht gefunden")

    book = db.query(Book).filter(Book.id == delivery.book_id).first()
    if book is None:
        raise ValueError("Buch nicht gefunden")

    now = datetime.now(timezone.utc).isoformat()
    book.quantity = int(book.quantity) + int(delivery.quantity)
    book.purchase_price = float(delivery.unit_price)
    book.supplier_id = delivery.supplier_id
    book.updated_at = now
    sync_book_supplier_link(
        db,
        book_id=book.id,
        supplier_id=delivery.supplier_id,
        purchase_price=float(delivery.unit_price),
        supplier_sku=book.sku or "",
    )

    movement = Movement(
        id=next_movement_id(db),
        book_id=book.id,
        book_name=book.name,
        quantity_change=int(delivery.quantity),
        movement_type="IN",
        reason=f"Bestellung von {supplier.name}",
        timestamp=now,
        performed_by=performed_by,
    )
    db.add(movement)
    db.delete(delivery)
    db.commit()
    db.refresh(movement)
    return movement


def get_supplier_stock(db: Session, supplier_id: str) -> list[dict]:
    """Buecher des Lieferanten mit Einkaufspreis zurueckgeben."""
    books = (
        db.query(Book, BookSupplier)
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
    db: Session,
    supplier_id: str,
    book_id: str,
    quantity: int,
    performed_by: str = "system",
) -> Movement:
    """Bestellt Buecher beim Lieferanten und legt einen IN-Movement an."""
    if quantity <= 0:
        raise ValueError("Menge muss groesser als 0 sein")

    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if supplier is None:
        raise ValueError("Lieferant nicht gefunden")

    book = db.query(Book).filter(Book.id == book_id).first()
    if book is None:
        raise ValueError("Buch nicht gefunden")
    link = (
        db.query(BookSupplier)
        .filter(BookSupplier.book_id == book_id, BookSupplier.supplier_id == supplier_id)
        .first()
    )
    if link is None:
        raise ValueError("Buch ist bei diesem Lieferanten nicht gelistet")

    book.quantity = int(book.quantity) + quantity

    now = datetime.now(timezone.utc).isoformat()
    movement = Movement(
        id=next_movement_id(db),
        book_id=book.id,
        book_name=book.name,
        quantity_change=quantity,
        movement_type="IN",
        reason=f"Bestellung von {supplier.name}",
        timestamp=now,
        performed_by=performed_by,
    )
    db.add(movement)

    sync_book_supplier_link(
        db,
        book_id=book.id,
        supplier_id=supplier_id,
        purchase_price=float(link.last_purchase_price or book.purchase_price),
        supplier_sku=book.sku or "",
    )
    book.supplier_id = supplier_id
    book.updated_at = now
    db.commit()
    db.refresh(movement)
    return movement
