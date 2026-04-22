from __future__ import annotations

from uuid import uuid4

from app.core.time import utc_now_iso
from app.db import schemas
from app.domain import models as dm


def book_from_schema(payload: schemas.BookSchema, *, existing: dm.Book | None = None) -> dm.Book:
    now = utc_now_iso()
    created_at = payload.created_at or (existing.created_at if existing else now)
    return dm.Book(
        id=payload.id or (existing.id if existing else str(uuid4())),
        name=payload.name,
        author=payload.author,
        description=payload.description,
        purchase_price=float(payload.purchase_price),
        sell_price=float(payload.sell_price),
        quantity=int(payload.quantity),
        sku=payload.sku,
        category=payload.category,
        supplier_id=payload.supplier_id,
        created_at=created_at,
        updated_at=payload.updated_at or now,
        notes=payload.notes,
    )


def movement_from_schema(payload: schemas.MovementSchema) -> dm.Movement:
    return dm.Movement(
        id=payload.id or "",
        book_id=payload.book_id,
        book_name=payload.book_name or "",
        quantity_change=int(payload.quantity_change),
        movement_type=payload.movement_type.upper(),
        reason=payload.reason,
        timestamp=payload.timestamp or "",
        performed_by=payload.performed_by or "system",
    )


def supplier_from_schema(payload: schemas.SupplierSchema) -> dm.Supplier:
    return dm.Supplier(
        id=(payload.id or "").strip(),
        name=payload.name,
        contact=payload.contact,
        address=payload.address,
        notes=payload.notes,
        created_at=payload.created_at or utc_now_iso(),
    )


def purchase_order_from_schema(payload: schemas.PurchaseOrderSchema) -> dm.PurchaseOrder:
    return dm.PurchaseOrder(
        id=payload.id or f"PO-{uuid4().hex[:12].upper()}",
        supplier_id=payload.supplier_id,
        supplier_name=payload.supplier_name,
        book_id=payload.book_id,
        book_name=payload.book_name,
        book_sku=payload.book_sku,
        unit_price=float(payload.unit_price),
        quantity=int(payload.quantity),
        delivered_quantity=int(payload.delivered_quantity),
        status=payload.status,
        created_at=payload.created_at or utc_now_iso(),
        delivered_at=payload.delivered_at,
    )
