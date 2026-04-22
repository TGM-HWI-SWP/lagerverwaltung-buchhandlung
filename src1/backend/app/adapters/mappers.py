from __future__ import annotations

from app.db import models as orm
from app.domain import models as dm


def book_to_domain(row: orm.Book) -> dm.Book:
    return dm.Book(
        id=row.id,
        name=row.name,
        author=row.author or "",
        description=row.description,
        purchase_price=float(row.purchase_price or 0),
        sell_price=float(row.sell_price or 0),
        quantity=int(row.quantity or 0),
        sku=row.sku or "",
        category=row.category or "",
        supplier_id=row.supplier_id or "",
        created_at=row.created_at,
        updated_at=row.updated_at,
        notes=row.notes,
    )


def book_apply(row: orm.Book, book: dm.Book) -> None:
    row.name = book.name
    row.author = book.author
    row.description = book.description
    row.purchase_price = book.purchase_price
    row.sell_price = book.sell_price
    row.quantity = book.quantity
    row.sku = book.sku
    row.category = book.category
    row.supplier_id = book.supplier_id
    row.created_at = book.created_at
    row.updated_at = book.updated_at
    row.notes = book.notes


def movement_to_domain(row: orm.Movement) -> dm.Movement:
    return dm.Movement(
        id=row.id,
        book_id=row.book_id,
        book_name=row.book_name,
        quantity_change=int(row.quantity_change),
        movement_type=row.movement_type,
        reason=row.reason,
        timestamp=row.timestamp,
        performed_by=row.performed_by or "system",
    )


def movement_apply(row: orm.Movement, movement: dm.Movement) -> None:
    row.book_id = movement.book_id
    row.book_name = movement.book_name
    row.quantity_change = movement.quantity_change
    row.movement_type = movement.movement_type
    row.reason = movement.reason
    row.timestamp = movement.timestamp
    row.performed_by = movement.performed_by


def supplier_to_domain(row: orm.Supplier) -> dm.Supplier:
    return dm.Supplier(
        id=row.id,
        name=row.name,
        contact=row.contact or "",
        address=row.address or "",
        notes=row.notes,
        created_at=row.created_at,
    )


def purchase_order_to_domain(row: orm.PurchaseOrder) -> dm.PurchaseOrder:
    return dm.PurchaseOrder(
        id=row.id,
        supplier_id=row.supplier_id,
        supplier_name=row.supplier_name,
        book_id=row.book_id,
        book_name=row.book_name,
        book_sku=row.book_sku or "",
        unit_price=float(row.unit_price or 0),
        quantity=int(row.quantity),
        delivered_quantity=int(row.delivered_quantity or 0),
        status=row.status,
        created_at=row.created_at,
        delivered_at=row.delivered_at,
    )


def purchase_order_apply(row: orm.PurchaseOrder, order: dm.PurchaseOrder) -> None:
    row.supplier_id = order.supplier_id
    row.supplier_name = order.supplier_name
    row.book_id = order.book_id
    row.book_name = order.book_name
    row.book_sku = order.book_sku
    row.unit_price = order.unit_price
    row.quantity = order.quantity
    row.delivered_quantity = order.delivered_quantity
    row.status = order.status
    row.created_at = order.created_at
    row.delivered_at = order.delivered_at


def incoming_delivery_to_domain(row: orm.IncomingDelivery) -> dm.IncomingDelivery:
    return dm.IncomingDelivery(
        id=row.id,
        order_id=row.order_id,
        supplier_id=row.supplier_id,
        supplier_name=row.supplier_name,
        book_id=row.book_id,
        book_name=row.book_name,
        quantity=int(row.quantity),
        unit_price=float(row.unit_price or 0),
        received_at=row.received_at,
    )


def book_supplier_link_to_domain(row: orm.BookSupplier) -> dm.BookSupplierLink:
    return dm.BookSupplierLink(
        id=row.id,
        book_id=row.book_id,
        supplier_id=row.supplier_id,
        supplier_sku=row.supplier_sku or "",
        is_primary=bool(row.is_primary),
        last_purchase_price=float(row.last_purchase_price or 0),
        created_at=row.created_at,
        updated_at=row.updated_at,
    )
