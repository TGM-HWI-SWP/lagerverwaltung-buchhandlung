from sqlalchemy.orm import Session

from app.adapters.schema_mappers import purchase_order_from_schema, supplier_from_schema
from app.api.deps import supplier_service
from app.db.schemas import PurchaseOrderSchema, SupplierSchema
from app.domain import models as dm


def get_all_suppliers(db: Session) -> list[dm.Supplier]:
    return supplier_service(db).list_suppliers()


def get_supplier(db: Session, supplier_id: str) -> dm.Supplier | None:
    return supplier_service(db).get_supplier(supplier_id)


def create_supplier(db: Session, supplier_data: SupplierSchema) -> dm.Supplier:
    return supplier_service(db).create_supplier(supplier_from_schema(supplier_data))


def get_all_purchase_orders(db: Session) -> list[dm.PurchaseOrder]:
    return supplier_service(db).list_purchase_orders()


def create_purchase_order(db: Session, order_data: PurchaseOrderSchema) -> dm.PurchaseOrder:
    return supplier_service(db).create_purchase_order(purchase_order_from_schema(order_data))


def receive_purchase_order(db: Session, order_id: str, quantity: int) -> dm.IncomingDelivery:
    return supplier_service(db).receive_purchase_order(order_id, quantity)


def get_all_incoming_deliveries(db: Session) -> list[dm.IncomingDelivery]:
    return supplier_service(db).list_incoming_deliveries()


def book_incoming_delivery(
    db: Session,
    delivery_id: str,
    performed_by: str = "system",
) -> dm.Movement:
    return supplier_service(db).book_incoming_delivery(delivery_id, performed_by)


def get_supplier_stock(db: Session, supplier_id: str) -> list[dm.SupplierStockEntry]:
    return supplier_service(db).get_supplier_stock(supplier_id)


def order_from_supplier(
    db: Session,
    supplier_id: str,
    book_id: str,
    quantity: int,
    performed_by: str = "system",
) -> dm.Movement:
    return supplier_service(db).order_from_supplier(
        supplier_id=supplier_id,
        book_id=book_id,
        quantity=quantity,
        performed_by=performed_by,
    )
