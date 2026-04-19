from __future__ import annotations

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.types import DateTime

from app.db.models import Base


class CatalogProduct(Base):
    __tablename__ = "catalog_products"
    __table_args__ = (
        UniqueConstraint("sku", name="uq_catalog_products_sku"),
    )

    id = Column(String, primary_key=True)
    sku = Column(String, nullable=False)
    title = Column(String, nullable=False)
    author = Column(String, nullable=False, default="")
    description = Column(Text, nullable=False, default="")
    category = Column(String, nullable=False, default="")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=False)


class ProductPrice(Base):
    __tablename__ = "product_prices"
    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_product_prices_amount_non_negative"),
        CheckConstraint("price_type IN ('standard', 'seasonal', 'custom')", name="ck_product_prices_type"),
    )

    id = Column(String, primary_key=True)
    product_id = Column(String, ForeignKey("catalog_products.id"), nullable=False)
    price_type = Column(String, nullable=False, default="standard")
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String, nullable=False, default="EUR")
    valid_from = Column(DateTime, nullable=True)
    valid_to = Column(DateTime, nullable=True)
    priority = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False)


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(String, primary_key=True)
    code = Column(String, nullable=False, unique=True)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False)


class StockItem(Base):
    __tablename__ = "stock_items"
    __table_args__ = (
        UniqueConstraint("warehouse_id", "product_id", name="uq_stock_items_warehouse_product"),
        CheckConstraint("on_hand >= 0", name="ck_stock_items_on_hand_non_negative"),
        CheckConstraint("reserved >= 0", name="ck_stock_items_reserved_non_negative"),
        CheckConstraint("reorder_point >= 0", name="ck_stock_items_reorder_non_negative"),
    )

    id = Column(String, primary_key=True)
    warehouse_id = Column(String, ForeignKey("warehouses.id"), nullable=False)
    product_id = Column(String, ForeignKey("catalog_products.id"), nullable=False)
    on_hand = Column(Integer, nullable=False, default=0)
    reserved = Column(Integer, nullable=False, default=0)
    reorder_point = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime, nullable=False)


class StockLedgerEntry(Base):
    __tablename__ = "stock_ledger_entries"
    __table_args__ = (
        CheckConstraint("quantity_delta <> 0", name="ck_stock_ledger_delta_non_zero"),
    )

    id = Column(String, primary_key=True)
    product_id = Column(String, ForeignKey("catalog_products.id"), nullable=False)
    warehouse_id = Column(String, ForeignKey("warehouses.id"), nullable=False)
    quantity_delta = Column(Integer, nullable=False)
    movement_type = Column(String, nullable=False)
    reference_type = Column(String, nullable=False, default="")
    reference_id = Column(String, nullable=False, default="")
    reason = Column(String, nullable=False, default="")
    performed_by = Column(String, nullable=False, default="system")
    created_at = Column(DateTime, nullable=False)


class DiscountRule(Base):
    __tablename__ = "discount_rules"
    __table_args__ = (
        CheckConstraint("value >= 0", name="ck_discount_rules_value_non_negative"),
        CheckConstraint("min_order_amount >= 0", name="ck_discount_rules_min_order_non_negative"),
        CheckConstraint("rule_type IN ('SEASONAL', 'FIRST_CUSTOMER', 'CUSTOM')", name="ck_discount_rules_type"),
        CheckConstraint("value_type IN ('PERCENT', 'FIXED')", name="ck_discount_rules_value_type"),
    )

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    rule_type = Column(String, nullable=False)
    value_type = Column(String, nullable=False)
    value = Column(Numeric(10, 2), nullable=False)
    min_order_amount = Column(Numeric(10, 2), nullable=False, default=0)
    stackable = Column(Boolean, nullable=False, default=False)
    active_from = Column(DateTime, nullable=True)
    active_to = Column(DateTime, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False)


class SalesOrder(Base):
    __tablename__ = "sales_orders"
    __table_args__ = (
        UniqueConstraint("order_number", name="uq_sales_orders_number"),
        CheckConstraint("subtotal >= 0", name="ck_sales_orders_subtotal_non_negative"),
        CheckConstraint("discount_total >= 0", name="ck_sales_orders_discount_non_negative"),
        CheckConstraint("total >= 0", name="ck_sales_orders_total_non_negative"),
    )

    id = Column(String, primary_key=True)
    order_number = Column(String, nullable=False)
    cashier_user_id = Column(String, ForeignKey("staff_users.id"), nullable=False)
    customer_reference = Column(String, nullable=False, default="")
    is_first_customer = Column(Boolean, nullable=False, default=False)
    subtotal = Column(Numeric(10, 2), nullable=False, default=0)
    discount_total = Column(Numeric(10, 2), nullable=False, default=0)
    total = Column(Numeric(10, 2), nullable=False, default=0)
    status = Column(String, nullable=False, default="COMPLETED")
    created_at = Column(DateTime, nullable=False)


class SalesOrderLine(Base):
    __tablename__ = "sales_order_lines"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_sales_order_lines_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_sales_order_lines_unit_price_non_negative"),
        CheckConstraint("line_discount >= 0", name="ck_sales_order_lines_discount_non_negative"),
        CheckConstraint("line_total >= 0", name="ck_sales_order_lines_total_non_negative"),
    )

    id = Column(String, primary_key=True)
    sales_order_id = Column(String, ForeignKey("sales_orders.id"), nullable=False)
    product_id = Column(String, ForeignKey("catalog_products.id"), nullable=False)
    product_name = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    line_discount = Column(Numeric(10, 2), nullable=False, default=0)
    line_total = Column(Numeric(10, 2), nullable=False, default=0)


class SalesOrderDiscount(Base):
    __tablename__ = "sales_order_discounts"
    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_sales_order_discounts_amount_non_negative"),
    )

    id = Column(String, primary_key=True)
    sales_order_id = Column(String, ForeignKey("sales_orders.id"), nullable=False)
    rule_id = Column(String, ForeignKey("discount_rules.id"), nullable=True)
    description = Column(String, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False, default=0)


class ReturnOrder(Base):
    __tablename__ = "return_orders"
    __table_args__ = (
        UniqueConstraint("return_number", name="uq_return_orders_number"),
        CheckConstraint("refund_total >= 0", name="ck_return_orders_refund_non_negative"),
    )

    id = Column(String, primary_key=True)
    return_number = Column(String, nullable=False)
    sales_order_id = Column(String, ForeignKey("sales_orders.id"), nullable=False)
    processed_by_user_id = Column(String, ForeignKey("staff_users.id"), nullable=False)
    reason = Column(String, nullable=False, default="")
    status = Column(String, nullable=False, default="COMPLETED")
    refund_total = Column(Numeric(10, 2), nullable=False, default=0)
    created_at = Column(DateTime, nullable=False)


class ReturnOrderLine(Base):
    __tablename__ = "return_order_lines"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_return_order_lines_quantity_positive"),
        CheckConstraint("refund_amount >= 0", name="ck_return_order_lines_refund_non_negative"),
        CheckConstraint("exchange_quantity >= 0", name="ck_return_order_lines_exchange_qty_non_negative"),
    )

    id = Column(String, primary_key=True)
    return_order_id = Column(String, ForeignKey("return_orders.id"), nullable=False)
    sales_order_line_id = Column(String, ForeignKey("sales_order_lines.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    refund_amount = Column(Numeric(10, 2), nullable=False, default=0)
    exchange_product_id = Column(String, ForeignKey("catalog_products.id"), nullable=True)
    exchange_quantity = Column(Integer, nullable=False, default=0)


class PurchaseOrderV2(Base):
    __tablename__ = "purchase_orders_v2"
    __table_args__ = (
        UniqueConstraint("order_number", name="uq_purchase_orders_v2_number"),
    )

    id = Column(String, primary_key=True)
    order_number = Column(String, nullable=False)
    supplier_id = Column(String, ForeignKey("suppliers.id"), nullable=False)
    created_by_user_id = Column(String, ForeignKey("staff_users.id"), nullable=False)
    status = Column(String, nullable=False, default="ORDERED")
    notes = Column(String, nullable=False, default="")
    ordered_at = Column(DateTime, nullable=False)
    received_at = Column(DateTime, nullable=True)


class PurchaseOrderV2Line(Base):
    __tablename__ = "purchase_order_v2_lines"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_purchase_order_v2_lines_qty_positive"),
        CheckConstraint("received_quantity >= 0", name="ck_purchase_order_v2_lines_received_non_negative"),
        CheckConstraint("unit_cost >= 0", name="ck_purchase_order_v2_lines_cost_non_negative"),
    )

    id = Column(String, primary_key=True)
    purchase_order_id = Column(String, ForeignKey("purchase_orders_v2.id"), nullable=False)
    product_id = Column(String, ForeignKey("catalog_products.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    received_quantity = Column(Integer, nullable=False, default=0)
    unit_cost = Column(Numeric(10, 2), nullable=False, default=0)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id = Column(String, primary_key=True)
    event_type = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_id = Column(String, nullable=False)
    actor_user_id = Column(String, ForeignKey("staff_users.id"), nullable=True)
    payload = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime, nullable=False)
