from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models_commerce import CatalogProduct, DiscountRule
from app.db.schemas_commerce import (
    CatalogProductCreateRequest,
    CatalogProductSchema,
    CatalogProductUpdateRequest,
    DiscountRuleCreateRequest,
    DiscountRuleSchema,
    PurchaseOrderCreateRequest,
    PurchaseOrderReceiveRequest,
    PurchaseOrderResponse,
    ReturnCreateRequest,
    ReturnOrderResponse,
    SaleCreateRequest,
    SaleOrderResponse,
    StockAdjustmentRequest,
    StockEntrySchema,
)
from app.services.commerce import CommerceService


def _service(db: Session) -> CommerceService:
    return CommerceService(db)


def list_catalog_products(db: Session, include_inactive: bool) -> list[CatalogProductSchema]:
    rows: list[CatalogProduct] = _service(db).list_catalog_products(include_inactive)
    return [
        CatalogProductSchema(
            id=row.id,
            sku=row.sku,
            title=row.title,
            author=row.author,
            description=row.description,
            category=row.category,
            is_active=bool(row.is_active),
        )
        for row in rows
    ]


def create_catalog_product(db: Session, payload: CatalogProductCreateRequest) -> CatalogProductSchema:
    row = _service(db).create_catalog_product(payload)
    return CatalogProductSchema(
        id=row.id,
        sku=row.sku,
        title=row.title,
        author=row.author,
        description=row.description,
        category=row.category,
        is_active=bool(row.is_active),
    )


def update_catalog_product(db: Session, product_id: str, payload: CatalogProductUpdateRequest) -> CatalogProductSchema:
    row = _service(db).update_catalog_product(product_id, payload)
    return CatalogProductSchema(
        id=row.id,
        sku=row.sku,
        title=row.title,
        author=row.author,
        description=row.description,
        category=row.category,
        is_active=bool(row.is_active),
    )


def list_stock(db: Session, include_zero: bool, warehouse_code: str | None) -> list[StockEntrySchema]:
    return _service(db).list_stock(include_zero=include_zero, warehouse_code=warehouse_code)


def adjust_stock(db: Session, payload: StockAdjustmentRequest, performed_by: str) -> StockEntrySchema:
    return _service(db).adjust_stock(payload, performed_by)


def list_discount_rules(db: Session, only_active: bool) -> list[DiscountRuleSchema]:
    rows: list[DiscountRule] = _service(db).list_discount_rules(only_active)
    return [
        DiscountRuleSchema(
            id=row.id,
            name=row.name,
            rule_type=row.rule_type,
            value_type=row.value_type,
            value=float(row.value),
            min_order_amount=float(row.min_order_amount),
            stackable=bool(row.stackable),
            is_active=bool(row.is_active),
        )
        for row in rows
    ]


def create_discount_rule(db: Session, payload: DiscountRuleCreateRequest) -> DiscountRuleSchema:
    row = _service(db).create_discount_rule(payload)
    return DiscountRuleSchema(
        id=row.id,
        name=row.name,
        rule_type=row.rule_type,
        value_type=row.value_type,
        value=float(row.value),
        min_order_amount=float(row.min_order_amount),
        stackable=bool(row.stackable),
        is_active=bool(row.is_active),
    )


def create_sale(db: Session, payload: SaleCreateRequest, cashier_user_id: str) -> SaleOrderResponse:
    return _service(db).create_sale(payload, cashier_user_id)


def create_return(db: Session, sales_order_id: str, payload: ReturnCreateRequest, processed_by_user_id: str) -> ReturnOrderResponse:
    return _service(db).create_return(sales_order_id, payload, processed_by_user_id)


def create_purchase_order(db: Session, payload: PurchaseOrderCreateRequest, user_id: str) -> PurchaseOrderResponse:
    return _service(db).create_purchase_order(payload, user_id)


def receive_purchase_order(db: Session, order_id: str, payload: PurchaseOrderReceiveRequest, user_id: str) -> PurchaseOrderResponse:
    return _service(db).receive_purchase_order(order_id, payload, user_id)


def list_purchase_orders(db: Session) -> list[PurchaseOrderResponse]:
    rows = _service(db).list_purchase_orders()
    return [
        PurchaseOrderResponse(
            id=row.id,
            order_number=row.order_number,
            supplier_id=row.supplier_id,
            status=row.status,
        )
        for row in rows
    ]
