from fastapi import Query
from sqlalchemy.orm import Session

from app.db.models import IncomingDelivery, Movement, PurchaseOrder, Supplier
from app.db.schemas import PurchaseOrderSchema, SupplierOrderRequest, SupplierSchema
from app.services.suppliers import SupplierService


def _service(db: Session) -> SupplierService:
    return SupplierService(db)


def get_all_suppliers(
    db: Session,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> list[Supplier]:
    return _service(db).list_suppliers_paginated(offset=offset, limit=limit)


def get_supplier(db: Session, supplier_id: str) -> Supplier | None:
    return _service(db).get_supplier(supplier_id)


def create_supplier(db: Session, supplier_data: SupplierSchema) -> Supplier:
    return _service(db).create_supplier(supplier_data)


def get_all_purchase_orders(
    db: Session,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> list[PurchaseOrder]:
    return _service(db).list_purchase_orders_paginated(offset=offset, limit=limit)


def create_purchase_order(db: Session, order_data: PurchaseOrderSchema) -> PurchaseOrder:
    return _service(db).create_purchase_order(order_data)


def receive_purchase_order(db: Session, order_id: str, quantity: int) -> IncomingDelivery:
    return _service(db).receive_purchase_order(order_id, quantity)


def get_all_incoming_deliveries(
    db: Session,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> list[IncomingDelivery]:
    return _service(db).list_incoming_deliveries_paginated(offset=offset, limit=limit)


def book_incoming_delivery(
    db: Session,
    delivery_id: str,
    performed_by: str = "system",
) -> Movement:
    return _service(db).book_incoming_delivery(delivery_id, performed_by)


def get_supplier_stock(db: Session, supplier_id: str) -> list[dict]:
    return _service(db).get_supplier_stock(supplier_id)


def order_from_supplier(
    db: Session,
    supplier_id: str,
    book_id: str,
    quantity: int,
    performed_by: str = "system",
) -> Movement:
    return _service(db).order_from_supplier(
        supplier_id,
        SupplierOrderRequest(
            book_id=book_id,
            quantity=quantity,
            performed_by=performed_by,
        ),
    )
