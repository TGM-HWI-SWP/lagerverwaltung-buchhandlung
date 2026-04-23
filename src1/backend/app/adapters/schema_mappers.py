from __future__ import annotations

from uuid import uuid4

from app.core.time import utc_now_iso
from app.db import schemas
from app.domain import models as dm

# Uebersetzer Pydantic-HTTP-Schema -> Domain-Dataclass.
# Richtung ist nur eine Seite (Schema -> Domain) - Domain -> Schema erledigt Pydantic selbst via
# `from_attributes=True` + `SomeSchema.model_validate(domain_obj)` auf Controller-Ebene.


def book_from_schema(payload: schemas.BookSchema, *, existing: dm.Book | None = None) -> dm.Book:
    """HTTP-Payload -> Domain-Buch. Bei Update uebernimmt `existing` id + created_at."""
    now = utc_now_iso()
    created_at = payload.created_at or (existing.created_at if existing else now)  # created_at nie ueberschreiben - aus DB oder jetzt
    return dm.Book(
        id=payload.id or (existing.id if existing else str(uuid4())),           # neue ID nur wenn weder Payload noch DB eine liefert
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
        updated_at=payload.updated_at or now,                                   # updated_at bei jedem Write neu (spaeter im Service nochmal gesetzt)
        notes=payload.notes,
    )


def movement_from_schema(payload: schemas.MovementSchema) -> dm.Movement:
    """HTTP-Payload -> Domain-Movement. ID und Timestamp leer lassen, Service ergaenzt."""
    return dm.Movement(
        id=payload.id or "",                                                    # leer -> Service vergibt M001/M002/...
        book_id=payload.book_id,
        book_name=payload.book_name or "",
        quantity_change=int(payload.quantity_change),
        movement_type=payload.movement_type.upper(),                            # robust gegen "in"/"In"/"IN"
        reason=payload.reason,
        timestamp=payload.timestamp or "",                                      # leer -> Service setzt now
        performed_by=payload.performed_by or "system",
    )


def supplier_from_schema(payload: schemas.SupplierSchema) -> dm.Supplier:
    """HTTP-Payload -> Domain-Lieferant."""
    return dm.Supplier(
        id=(payload.id or "").strip(),                                          # leer -> Service vergibt SXXX
        name=payload.name,
        contact=payload.contact,
        address=payload.address,
        notes=payload.notes,
        created_at=payload.created_at or utc_now_iso(),
    )


def purchase_order_from_schema(payload: schemas.PurchaseOrderSchema) -> dm.PurchaseOrder:
    """HTTP-Payload -> Domain-Bestellung. Generiert ID mit PO-Prefix, falls keine mitkommt."""
    return dm.PurchaseOrder(
        id=payload.id or f"PO-{uuid4().hex[:12].upper()}",                      # PO-Prefix trennt optisch von Movements/IncomingDeliveries
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
