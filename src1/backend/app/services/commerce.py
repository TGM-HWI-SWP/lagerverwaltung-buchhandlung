from __future__ import annotations

from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
import json
from uuid import uuid4

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.time import utc_now_iso
from app.db.models import Supplier
from app.db.models_commerce import (
    AuditEvent,
    CatalogProduct,
    DiscountRule,
    ProductPrice,
    PurchaseOrderV2,
    PurchaseOrderV2Line,
    ReturnOrder,
    ReturnOrderLine,
    SalesOrder,
    SalesOrderDiscount,
    SalesOrderLine,
    StockItem,
    StockLedgerEntry,
    Warehouse,
)
from app.db.schemas_commerce import (
    AppliedDiscountResponse,
    CatalogProductCreateRequest,
    CatalogProductUpdateRequest,
    DiscountRuleCreateRequest,
    PurchaseOrderCreateRequest,
    PurchaseOrderReceiveRequest,
    PurchaseOrderResponse,
    ReturnCreateRequest,
    ReturnOrderResponse,
    SaleCreateRequest,
    SaleLineResponse,
    SaleOrderResponse,
    StockAdjustmentRequest,
    StockEntrySchema,
)
from app.services.activity_log import write_activity_log


def _money(value: Decimal | float | int) -> Decimal:
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class CommerceService:
    def __init__(self, db: Session):
        self._db = db

    def _now(self) -> datetime:
        return datetime.fromisoformat(utc_now_iso())

    def _ensure_warehouse(self, code: str = "STORE") -> Warehouse:
        warehouse = self._db.query(Warehouse).filter(Warehouse.code == code).first()
        if warehouse:
            return warehouse
        now = self._now()
        warehouse = Warehouse(
            id=f"WH-{uuid4().hex[:12].upper()}",
            code=code,
            name="Verkaufsfläche" if code == "STORE" else code,
            is_active=True,
            created_at=now,
        )
        self._db.add(warehouse)
        self._db.flush()
        return warehouse

    def list_catalog_products(self, include_inactive: bool) -> list[CatalogProduct]:
        q = self._db.query(CatalogProduct)
        if not include_inactive:
            q = q.filter(CatalogProduct.is_active == True)  # noqa: E712
        return q.order_by(CatalogProduct.title.asc()).all()

    def create_catalog_product(self, payload: CatalogProductCreateRequest) -> CatalogProduct:
        exists = self._db.query(CatalogProduct).filter(CatalogProduct.sku == payload.sku).first()
        if exists:
            raise ValueError("SKU ist bereits im Katalog vorhanden")

        now = self._now()
        product = CatalogProduct(
            id=f"CP-{uuid4().hex[:12].upper()}",
            sku=payload.sku,
            title=payload.title,
            author=payload.author,
            description=payload.description,
            category=payload.category,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        self._db.add(product)
        self._db.flush()

        self._db.add(
            ProductPrice(
                id=f"PR-{uuid4().hex[:12].upper()}",
                product_id=product.id,
                price_type="standard",
                amount=float(payload.selling_price),
                currency="EUR",
                valid_from=None,
                valid_to=None,
                priority=0,
                is_active=True,
                created_at=now,
            )
        )

        warehouse = self._ensure_warehouse("STORE")
        self._db.add(
            StockItem(
                id=f"ST-{uuid4().hex[:12].upper()}",
                warehouse_id=warehouse.id,
                product_id=product.id,
                on_hand=0,
                reserved=0,
                reorder_point=payload.reorder_point,
                updated_at=now,
            )
        )
        self._audit("catalog_product_created", "catalog_product", product.id, None, {"sku": product.sku, "title": product.title})
        self._db.commit()
        self._db.refresh(product)
        return product

    def update_catalog_product(self, product_id: str, payload: CatalogProductUpdateRequest) -> CatalogProduct:
        product = self._db.query(CatalogProduct).filter(CatalogProduct.id == product_id).first()
        if not product:
            raise ValueError("Katalogprodukt nicht gefunden")

        now = self._now()
        if payload.title is not None:
            product.title = payload.title.strip()
        if payload.author is not None:
            product.author = payload.author.strip()
        if payload.description is not None:
            product.description = payload.description.strip()
        if payload.category is not None:
            product.category = payload.category.strip()
        if payload.is_active is not None:
            product.is_active = payload.is_active
        if payload.reorder_point is not None:
            stock_rows = self._db.query(StockItem).filter(StockItem.product_id == product.id).all()
            for row in stock_rows:
                row.reorder_point = payload.reorder_point
                row.updated_at = now

        product.updated_at = now
        self._audit("catalog_product_updated", "catalog_product", product.id, None, {"title": product.title})
        self._db.commit()
        self._db.refresh(product)
        return product

    def list_stock(self, include_zero: bool, warehouse_code: str | None) -> list[StockEntrySchema]:
        q = (
            self._db.query(StockItem, CatalogProduct, Warehouse)
            .join(CatalogProduct, CatalogProduct.id == StockItem.product_id)
            .join(Warehouse, Warehouse.id == StockItem.warehouse_id)
            .filter(CatalogProduct.is_active == True)  # noqa: E712
        )
        if not include_zero:
            q = q.filter(StockItem.on_hand > 0)
        if warehouse_code:
            q = q.filter(Warehouse.code == warehouse_code)
        rows = q.order_by(CatalogProduct.title.asc()).all()
        return [
            StockEntrySchema(
                product_id=product.id,
                sku=product.sku,
                title=product.title,
                warehouse_code=warehouse.code,
                on_hand=int(stock.on_hand),
                reserved=int(stock.reserved),
                reorder_point=int(stock.reorder_point),
            )
            for stock, product, warehouse in rows
        ]

    def adjust_stock(self, payload: StockAdjustmentRequest, performed_by: str) -> StockEntrySchema:
        product = self._db.query(CatalogProduct).filter(CatalogProduct.id == payload.product_id).first()
        if not product:
            raise ValueError("Produkt nicht gefunden")

        warehouse = self._ensure_warehouse(payload.warehouse_code)
        stock = (
            self._db.query(StockItem)
            .filter(StockItem.product_id == product.id, StockItem.warehouse_id == warehouse.id)
            .first()
        )
        now = self._now()
        if not stock:
            stock = StockItem(
                id=f"ST-{uuid4().hex[:12].upper()}",
                warehouse_id=warehouse.id,
                product_id=product.id,
                on_hand=0,
                reserved=0,
                reorder_point=0,
                updated_at=now,
            )
            self._db.add(stock)
            self._db.flush()

        next_on_hand = int(stock.on_hand) + int(payload.quantity_delta)
        if next_on_hand < 0:
            raise ValueError("Bestand kann nicht negativ werden")

        stock.on_hand = next_on_hand
        stock.updated_at = now
        self._db.add(
            StockLedgerEntry(
                id=f"LG-{uuid4().hex[:12].upper()}",
                product_id=product.id,
                warehouse_id=warehouse.id,
                quantity_delta=int(payload.quantity_delta),
                movement_type="ADJUSTMENT",
                reference_type="manual_adjustment",
                reference_id="",
                reason=payload.reason,
                performed_by=performed_by,
                created_at=now,
            )
        )
        self._audit("stock_adjusted", "stock_item", stock.id, performed_by, {"delta": payload.quantity_delta, "reason": payload.reason})
        self._db.commit()

        return StockEntrySchema(
            product_id=product.id,
            sku=product.sku,
            title=product.title,
            warehouse_code=warehouse.code,
            on_hand=int(stock.on_hand),
            reserved=int(stock.reserved),
            reorder_point=int(stock.reorder_point),
        )

    def list_discount_rules(self, only_active: bool) -> list[DiscountRule]:
        q = self._db.query(DiscountRule)
        if only_active:
            q = q.filter(DiscountRule.is_active == True)  # noqa: E712
        return q.order_by(DiscountRule.created_at.desc()).all()

    def create_discount_rule(self, payload: DiscountRuleCreateRequest) -> DiscountRule:
        now = self._now()
        row = DiscountRule(
            id=f"DR-{uuid4().hex[:12].upper()}",
            name=payload.name,
            rule_type=payload.rule_type,
            value_type=payload.value_type,
            value=payload.value,
            min_order_amount=payload.min_order_amount,
            stackable=payload.stackable,
            active_from=None,
            active_to=None,
            is_active=True,
            created_at=now,
        )
        self._db.add(row)
        self._audit("discount_rule_created", "discount_rule", row.id, None, {"name": row.name, "type": row.rule_type})
        self._db.commit()
        self._db.refresh(row)
        return row

    def _current_price(self, product_id: str, now: datetime) -> Decimal:
        row = (
            self._db.query(ProductPrice)
            .filter(
                ProductPrice.product_id == product_id,
                ProductPrice.is_active == True,  # noqa: E712
                (ProductPrice.valid_from.is_(None) | (ProductPrice.valid_from <= now)),
                (ProductPrice.valid_to.is_(None) | (ProductPrice.valid_to >= now)),
            )
            .order_by(ProductPrice.priority.desc(), ProductPrice.created_at.desc())
            .first()
        )
        if not row:
            raise ValueError("Aktiver Verkaufspreis fehlt")
        return _money(row.amount)

    def _compute_rule_discount(self, subtotal: Decimal, rule: DiscountRule) -> Decimal:
        if subtotal < _money(rule.min_order_amount):
            return Decimal("0.00")
        if rule.value_type == "PERCENT":
            return _money(subtotal * (Decimal(rule.value) / Decimal("100")))
        return _money(rule.value)

    def create_sale(self, payload: SaleCreateRequest, cashier_user_id: str) -> SaleOrderResponse:
        if len(payload.lines) == 0:
            raise ValueError("Mindestens eine Verkaufsposition ist erforderlich")

        now = self._now()
        warehouse = self._ensure_warehouse("STORE")

        line_records: list[dict] = []
        subtotal = Decimal("0.00")

        for item in payload.lines:
            product = self._db.query(CatalogProduct).filter(CatalogProduct.id == item.product_id, CatalogProduct.is_active == True).first()  # noqa: E712
            if not product:
                raise ValueError(f"Produkt {item.product_id} ist nicht im aktiven Katalog")

            stock = (
                self._db.query(StockItem)
                .filter(StockItem.product_id == product.id, StockItem.warehouse_id == warehouse.id)
                .first()
            )
            if not stock or int(stock.on_hand) < int(item.quantity):
                raise ValueError(f"Nicht genug Bestand für {product.title}")

            unit_price = self._current_price(product.id, now)
            line_subtotal = _money(unit_price * item.quantity)
            subtotal += line_subtotal
            line_records.append(
                {
                    "product": product,
                    "stock": stock,
                    "quantity": int(item.quantity),
                    "unit_price": unit_price,
                    "line_subtotal": line_subtotal,
                }
            )

        rules = self._db.query(DiscountRule).filter(DiscountRule.is_active == True).all()  # noqa: E712
        candidates: list[tuple[str, Decimal, str | None]] = []
        for rule in rules:
            if rule.rule_type == "FIRST_CUSTOMER" and not payload.is_first_customer:
                continue
            amount = self._compute_rule_discount(subtotal, rule)
            if amount <= 0:
                continue
            candidates.append((rule.name, amount, rule.id))

        if payload.custom_discount_amount > 0:
            candidates.append(("Individueller Rabatt", _money(payload.custom_discount_amount), None))

        if candidates:
            capped = [(name, min(amount, subtotal), rid) for name, amount, rid in candidates]
            discount_total = _money(sum(amount for _, amount, _ in capped))
        else:
            capped = []
            discount_total = Decimal("0.00")

        if discount_total > subtotal:
            discount_total = subtotal

        order = SalesOrder(
            id=f"SO-{uuid4().hex[:12].upper()}",
            order_number=f"SO-{now.strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}",
            cashier_user_id=cashier_user_id,
            customer_reference=payload.customer_reference,
            is_first_customer=payload.is_first_customer,
            subtotal=float(subtotal),
            discount_total=float(discount_total),
            total=float(_money(subtotal - discount_total)),
            status="COMPLETED",
            created_at=now,
        )
        self._db.add(order)
        self._db.flush()

        line_responses: list[SaleLineResponse] = []
        discounts_responses: list[AppliedDiscountResponse] = []

        remaining_discount = discount_total
        for idx, data in enumerate(line_records):
            line_subtotal = data["line_subtotal"]
            if discount_total > 0:
                if idx == len(line_records) - 1:
                    line_discount = remaining_discount
                else:
                    share = line_subtotal / subtotal if subtotal > 0 else Decimal("0")
                    line_discount = _money(discount_total * share)
                    remaining_discount = _money(remaining_discount - line_discount)
            else:
                line_discount = Decimal("0.00")

            line_total = _money(line_subtotal - line_discount)
            db_line = SalesOrderLine(
                id=f"SL-{uuid4().hex[:12].upper()}",
                sales_order_id=order.id,
                product_id=data["product"].id,
                product_name=data["product"].title,
                quantity=data["quantity"],
                unit_price=float(data["unit_price"]),
                line_discount=float(line_discount),
                line_total=float(line_total),
            )
            self._db.add(db_line)
            self._db.flush()

            stock: StockItem = data["stock"]
            stock.on_hand = int(stock.on_hand) - data["quantity"]
            stock.updated_at = now

            self._db.add(
                StockLedgerEntry(
                    id=f"LG-{uuid4().hex[:12].upper()}",
                    product_id=data["product"].id,
                    warehouse_id=warehouse.id,
                    quantity_delta=-data["quantity"],
                    movement_type="SALE",
                    reference_type="sales_order",
                    reference_id=order.id,
                    reason="Verkauf",
                    performed_by=cashier_user_id,
                    created_at=now,
                )
            )

            line_responses.append(
                SaleLineResponse(
                    product_id=db_line.product_id,
                    product_name=db_line.product_name,
                    quantity=db_line.quantity,
                    unit_price=float(db_line.unit_price),
                    discount=float(db_line.line_discount),
                    total=float(db_line.line_total),
                )
            )

        for name, amount, rule_id in capped:
            self._db.add(
                SalesOrderDiscount(
                    id=f"SD-{uuid4().hex[:12].upper()}",
                    sales_order_id=order.id,
                    rule_id=rule_id,
                    description=name,
                    amount=float(amount),
                )
            )
            discounts_responses.append(AppliedDiscountResponse(description=name, amount=float(amount)))

        self._audit(
            "sales_order_created",
            "sales_order",
            order.id,
            cashier_user_id,
            {"subtotal": float(order.subtotal), "discount_total": float(order.discount_total), "total": float(order.total)},
        )
        self._db.commit()

        return SaleOrderResponse(
            order_id=order.id,
            order_number=order.order_number,
            subtotal=float(order.subtotal),
            discount_total=float(order.discount_total),
            total=float(order.total),
            lines=line_responses,
            discounts=discounts_responses,
        )

    def create_return(self, sales_order_id: str, payload: ReturnCreateRequest, processed_by_user_id: str) -> ReturnOrderResponse:
        order = self._db.query(SalesOrder).filter(SalesOrder.id == sales_order_id).first()
        if not order:
            raise ValueError("Verkaufsauftrag nicht gefunden")

        now = self._now()
        warehouse = self._ensure_warehouse("STORE")
        return_order = ReturnOrder(
            id=f"RT-{uuid4().hex[:12].upper()}",
            return_number=f"RT-{now.strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}",
            sales_order_id=order.id,
            processed_by_user_id=processed_by_user_id,
            reason=payload.reason,
            status="COMPLETED",
            refund_total=0,
            created_at=now,
        )
        self._db.add(return_order)
        self._db.flush()

        refund_total = Decimal("0.00")
        for req_line in payload.lines:
            sale_line = (
                self._db.query(SalesOrderLine)
                .filter(SalesOrderLine.id == req_line.sales_order_line_id, SalesOrderLine.sales_order_id == order.id)
                .first()
            )
            if not sale_line:
                raise ValueError("Retour-Position referenziert keine Verkaufsposition")

            already_returned = (
                self._db.query(func.coalesce(func.sum(ReturnOrderLine.quantity), 0))
                .filter(ReturnOrderLine.sales_order_line_id == sale_line.id)
                .scalar()
                or 0
            )
            available = int(sale_line.quantity) - int(already_returned)
            if req_line.quantity > available:
                raise ValueError("Retour-Menge übersteigt verfügbare Menge")

            refund_per_unit = _money(Decimal(sale_line.line_total) / Decimal(sale_line.quantity))
            line_refund = _money(refund_per_unit * req_line.quantity)
            refund_total += line_refund

            self._db.add(
                ReturnOrderLine(
                    id=f"RL-{uuid4().hex[:12].upper()}",
                    return_order_id=return_order.id,
                    sales_order_line_id=sale_line.id,
                    quantity=req_line.quantity,
                    refund_amount=float(line_refund),
                    exchange_product_id=req_line.exchange_product_id,
                    exchange_quantity=req_line.exchange_quantity,
                )
            )

            stock = (
                self._db.query(StockItem)
                .filter(StockItem.product_id == sale_line.product_id, StockItem.warehouse_id == warehouse.id)
                .first()
            )
            if not stock:
                stock = StockItem(
                    id=f"ST-{uuid4().hex[:12].upper()}",
                    warehouse_id=warehouse.id,
                    product_id=sale_line.product_id,
                    on_hand=0,
                    reserved=0,
                    reorder_point=0,
                    updated_at=now,
                )
                self._db.add(stock)
                self._db.flush()

            stock.on_hand = int(stock.on_hand) + int(req_line.quantity)
            stock.updated_at = now

            self._db.add(
                StockLedgerEntry(
                    id=f"LG-{uuid4().hex[:12].upper()}",
                    product_id=sale_line.product_id,
                    warehouse_id=warehouse.id,
                    quantity_delta=int(req_line.quantity),
                    movement_type="RETURN",
                    reference_type="return_order",
                    reference_id=return_order.id,
                    reason=payload.reason,
                    performed_by=processed_by_user_id,
                    created_at=now,
                )
            )

            if req_line.exchange_product_id and req_line.exchange_quantity > 0:
                exchange_stock = (
                    self._db.query(StockItem)
                    .filter(StockItem.product_id == req_line.exchange_product_id, StockItem.warehouse_id == warehouse.id)
                    .first()
                )
                if not exchange_stock or int(exchange_stock.on_hand) < int(req_line.exchange_quantity):
                    raise ValueError("Nicht genug Bestand für Umtauschprodukt")
                exchange_stock.on_hand = int(exchange_stock.on_hand) - int(req_line.exchange_quantity)
                exchange_stock.updated_at = now
                self._db.add(
                    StockLedgerEntry(
                        id=f"LG-{uuid4().hex[:12].upper()}",
                        product_id=req_line.exchange_product_id,
                        warehouse_id=warehouse.id,
                        quantity_delta=-int(req_line.exchange_quantity),
                        movement_type="EXCHANGE_OUT",
                        reference_type="return_order",
                        reference_id=return_order.id,
                        reason="Umtausch",
                        performed_by=processed_by_user_id,
                        created_at=now,
                    )
                )

        return_order.refund_total = float(_money(refund_total))
        returned_total = (
            self._db.query(func.coalesce(func.sum(ReturnOrderLine.quantity), 0))
            .join(ReturnOrder, ReturnOrder.id == ReturnOrderLine.return_order_id)
            .filter(ReturnOrder.sales_order_id == order.id)
            .scalar()
            or 0
        )
        sold_total = (
            self._db.query(func.coalesce(func.sum(SalesOrderLine.quantity), 0))
            .filter(SalesOrderLine.sales_order_id == order.id)
            .scalar()
            or 0
        )
        order.status = "RETURNED" if int(returned_total) >= int(sold_total) else "PARTIAL_RETURN"

        self._audit(
            "return_order_created",
            "return_order",
            return_order.id,
            processed_by_user_id,
            {"sales_order_id": order.id, "refund_total": float(return_order.refund_total)},
        )
        self._db.commit()

        return ReturnOrderResponse(
            return_id=return_order.id,
            return_number=return_order.return_number,
            refund_total=float(return_order.refund_total),
        )

    def create_purchase_order(self, payload: PurchaseOrderCreateRequest, user_id: str) -> PurchaseOrderResponse:
        supplier = self._db.query(Supplier).filter(Supplier.id == payload.supplier_id).first()
        if not supplier:
            raise ValueError("Lieferant nicht gefunden")
        if len(payload.lines) == 0:
            raise ValueError("Bestellung benötigt mindestens eine Position")

        now = self._now()
        order = PurchaseOrderV2(
            id=f"PO2-{uuid4().hex[:12].upper()}",
            order_number=f"PO2-{now.strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}",
            supplier_id=supplier.id,
            created_by_user_id=user_id,
            status="ORDERED",
            notes=payload.notes,
            ordered_at=now,
            received_at=None,
        )
        self._db.add(order)
        self._db.flush()

        for line in payload.lines:
            product = self._db.query(CatalogProduct).filter(CatalogProduct.id == line.product_id).first()
            if not product:
                raise ValueError("Katalogprodukt nicht gefunden")
            self._db.add(
                PurchaseOrderV2Line(
                    id=f"POL2-{uuid4().hex[:12].upper()}",
                    purchase_order_id=order.id,
                    product_id=product.id,
                    quantity=line.quantity,
                    received_quantity=0,
                    unit_cost=line.unit_cost,
                )
            )

        self._audit("purchase_order_v2_created", "purchase_order_v2", order.id, user_id, {"supplier_id": supplier.id})
        self._db.commit()
        return PurchaseOrderResponse(id=order.id, order_number=order.order_number, supplier_id=order.supplier_id, status=order.status)

    def list_purchase_orders(self) -> list[PurchaseOrderV2]:
        return self._db.query(PurchaseOrderV2).order_by(PurchaseOrderV2.ordered_at.desc()).all()

    def receive_purchase_order(self, order_id: str, payload: PurchaseOrderReceiveRequest, user_id: str) -> PurchaseOrderResponse:
        order = self._db.query(PurchaseOrderV2).filter(PurchaseOrderV2.id == order_id).first()
        if not order:
            raise ValueError("Bestellung nicht gefunden")

        warehouse = self._ensure_warehouse(payload.warehouse_code)
        now = self._now()

        requested = {line.line_id: line.receive_quantity for line in payload.lines}
        lines = self._db.query(PurchaseOrderV2Line).filter(PurchaseOrderV2Line.purchase_order_id == order.id).all()
        for line in lines:
            if line.id not in requested:
                continue
            receive_qty = int(requested[line.id])
            remaining = int(line.quantity) - int(line.received_quantity)
            if receive_qty > remaining:
                raise ValueError("Wareneingangsmenge überschreitet offene Menge")

            line.received_quantity = int(line.received_quantity) + receive_qty

            stock = (
                self._db.query(StockItem)
                .filter(StockItem.product_id == line.product_id, StockItem.warehouse_id == warehouse.id)
                .first()
            )
            if not stock:
                stock = StockItem(
                    id=f"ST-{uuid4().hex[:12].upper()}",
                    warehouse_id=warehouse.id,
                    product_id=line.product_id,
                    on_hand=0,
                    reserved=0,
                    reorder_point=0,
                    updated_at=now,
                )
                self._db.add(stock)
                self._db.flush()

            stock.on_hand = int(stock.on_hand) + receive_qty
            stock.updated_at = now

            self._db.add(
                StockLedgerEntry(
                    id=f"LG-{uuid4().hex[:12].upper()}",
                    product_id=line.product_id,
                    warehouse_id=warehouse.id,
                    quantity_delta=receive_qty,
                    movement_type="PURCHASE_RECEIPT",
                    reference_type="purchase_order_v2",
                    reference_id=order.id,
                    reason="Wareneingang",
                    performed_by=user_id,
                    created_at=now,
                )
            )

        all_done = all(int(line.received_quantity) >= int(line.quantity) for line in lines)
        order.status = "RECEIVED" if all_done else "PARTIAL_RECEIVED"
        if all_done:
            order.received_at = now

        self._audit("purchase_order_v2_received", "purchase_order_v2", order.id, user_id, {"status": order.status})
        self._db.commit()
        return PurchaseOrderResponse(id=order.id, order_number=order.order_number, supplier_id=order.supplier_id, status=order.status)

    def _audit(self, event_type: str, entity_type: str, entity_id: str, actor_user_id: str | None, payload: dict) -> None:
        now = self._now()
        self._db.add(
            AuditEvent(
                id=f"AE-{uuid4().hex[:12].upper()}",
                event_type=event_type,
                entity_type=entity_type,
                entity_id=entity_id,
                actor_user_id=actor_user_id,
                payload=json.dumps(payload, ensure_ascii=False),
                created_at=now,
            )
        )
        write_activity_log(
            self._db,
            action=event_type.upper(),
            entity_type=entity_type,
            entity_id=entity_id,
            performed_by=actor_user_id,
            changes=json.dumps(payload, ensure_ascii=False),
            reason=event_type.replace("_", " "),
            timestamp=now,
        )
