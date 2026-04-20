from __future__ import annotations

import json
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
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
    ProductSupplier,
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
from app.db.schemas import SupplierCreateRequest, SupplierSchema
from app.db.schemas_commerce import (
    AppliedDiscountResponse,
    CatalogProductCreateRequest,
    CatalogProductSchema,
    CatalogProductUpdateRequest,
    DiscountRuleCreateRequest,
    DiscountRuleSchema,
    ProductSupplierSchema,
    ProductSupplierUpsertRequest,
    PurchaseOrderCreateRequest,
    PurchaseOrderLineResponse,
    PurchaseOrderReceiveRequest,
    PurchaseOrderResponse,
    ReturnCreateRequest,
    ReturnOrderResponse,
    SaleCreateRequest,
    SaleLineResponse,
    SaleOrderResponse,
    StockAdjustmentRequest,
    StockEntrySchema,
    StockLedgerEntrySchema,
    WarehouseCreateRequest,
    WarehouseSchema,
    WarehouseUpdateRequest,
)
from app.services.activity_log import write_activity_log


def _money(value: Decimal | float | int) -> Decimal:
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class CommerceService:
    def __init__(self, db: Session):
        self._db = db

    def _now(self) -> datetime:
        return datetime.fromisoformat(utc_now_iso())

    def _warehouse_name(self, code: str) -> str:
        return {
            "STORE": "Verkaufsfläche",
            "BACK": "Lager hinten",
            "EVENT": "Eventlager",
        }.get(code, code.title())

    def _compose_address(
        self,
        street: str,
        house_number: str,
        postcode: str,
        city: str,
        state: str,
        country: str,
    ) -> str:
        line_one = " ".join(part for part in [street.strip(), house_number.strip()] if part)
        line_two = " ".join(part for part in [postcode.strip(), city.strip()] if part)
        line_three = ", ".join(part for part in [state.strip(), country.strip()] if part)
        return ", ".join(part for part in [line_one, line_two, line_three] if part)

    def _supplier_schema(self, supplier: Supplier) -> SupplierSchema:
        return SupplierSchema.model_validate(supplier)

    def _warehouse_schema(self, warehouse: Warehouse) -> WarehouseSchema:
        return WarehouseSchema(
            id=warehouse.id,
            code=warehouse.code,
            name=warehouse.name,
            location_display_name=warehouse.location_display_name or "",
            location_street=warehouse.location_street or "",
            location_house_number=warehouse.location_house_number or "",
            location_postcode=warehouse.location_postcode or "",
            location_city=warehouse.location_city or "",
            location_state=warehouse.location_state or "",
            location_country=warehouse.location_country or "",
            location_lat=warehouse.location_lat or "",
            location_lon=warehouse.location_lon or "",
            location_source=warehouse.location_source or "manual",
            location_source_id=warehouse.location_source_id or "",
            is_active=bool(warehouse.is_active),
            created_at=warehouse.created_at.isoformat() if warehouse.created_at else None,
        )

    def _ensure_warehouse(self, code: str = "STORE") -> Warehouse:
        normalized = code.strip().upper()
        warehouse = self._db.query(Warehouse).filter(Warehouse.code == normalized).first()
        if warehouse:
            return warehouse
        now = self._now()
        warehouse = Warehouse(
            id=f"WH-{uuid4().hex[:12].upper()}",
            code=normalized,
            name=self._warehouse_name(normalized),
            location_display_name=self._warehouse_name(normalized),
            location_city="Wien",
            location_country="Österreich",
            location_source="manual",
            is_active=True,
            created_at=now,
        )
        self._db.add(warehouse)
        self._db.flush()
        return warehouse

    def _get_price_row(self, product_id: str) -> ProductPrice | None:
        now = self._now()
        return (
            self._db.query(ProductPrice)
            .filter(
                ProductPrice.product_id == product_id,
                ProductPrice.is_active == True,  # noqa: E712
                ProductPrice.price_type == "standard",
                (ProductPrice.valid_from.is_(None) | (ProductPrice.valid_from <= now)),
                (ProductPrice.valid_to.is_(None) | (ProductPrice.valid_to >= now)),
            )
            .order_by(ProductPrice.priority.desc(), ProductPrice.created_at.desc())
            .first()
        )

    def _current_price(self, product_id: str) -> Decimal:
        row = self._get_price_row(product_id)
        if not row:
            raise ValueError("Aktiver Verkaufspreis fehlt")
        return _money(row.amount)

    def _set_standard_price(self, product_id: str, amount: float, now: datetime) -> None:
        row = (
            self._db.query(ProductPrice)
            .filter(ProductPrice.product_id == product_id, ProductPrice.price_type == "standard")
            .first()
        )
        if row:
            row.amount = _money(amount)
            row.is_active = True
            row.priority = 0
            row.currency = "EUR"
            return
        self._db.add(
            ProductPrice(
                id=f"PR-{uuid4().hex[:12].upper()}",
                product_id=product_id,
                price_type="standard",
                amount=_money(amount),
                currency="EUR",
                valid_from=None,
                valid_to=None,
                priority=0,
                is_active=True,
                created_at=now,
            )
        )

    def _product_reorder_point(self, product_id: str) -> int:
        stock = (
            self._db.query(StockItem)
            .join(Warehouse, Warehouse.id == StockItem.warehouse_id)
            .filter(StockItem.product_id == product_id, Warehouse.code == "STORE")
            .first()
        )
        if stock:
            return int(stock.reorder_point)
        fallback = self._db.query(StockItem).filter(StockItem.product_id == product_id).first()
        return int(fallback.reorder_point) if fallback else 0

    def _catalog_schema(self, product: CatalogProduct) -> CatalogProductSchema:
        return CatalogProductSchema(
            id=product.id,
            sku=product.sku,
            title=product.title,
            author=product.author or "",
            description=product.description or "",
            category=product.category or "",
            is_active=bool(product.is_active),
            selling_price=float(self._current_price(product.id)),
            reorder_point=self._product_reorder_point(product.id),
            created_at=product.created_at.isoformat() if product.created_at else None,
            updated_at=product.updated_at.isoformat() if product.updated_at else None,
        )

    def _stock_entry(self, stock: StockItem, product: CatalogProduct, warehouse: Warehouse) -> StockEntrySchema:
        return StockEntrySchema(
            product_id=product.id,
            sku=product.sku,
            title=product.title,
            warehouse_code=warehouse.code,
            on_hand=int(stock.on_hand),
            reserved=int(stock.reserved),
            reorder_point=int(stock.reorder_point),
            selling_price=float(self._current_price(product.id)),
        )

    def _ledger_entry(self, row: StockLedgerEntry, product: CatalogProduct, warehouse: Warehouse) -> StockLedgerEntrySchema:
        return StockLedgerEntrySchema(
            id=row.id,
            product_id=product.id,
            sku=product.sku,
            title=product.title,
            warehouse_code=warehouse.code,
            quantity_delta=int(row.quantity_delta),
            movement_type=row.movement_type,
            reference_type=row.reference_type,
            reference_id=row.reference_id,
            reason=row.reason,
            performed_by=row.performed_by,
            created_at=row.created_at.isoformat(),
        )

    def _po_line_response(self, line: PurchaseOrderV2Line, product_title: str) -> PurchaseOrderLineResponse:
        return PurchaseOrderLineResponse(
            line_id=line.id,
            product_id=line.product_id,
            product_title=product_title,
            quantity=int(line.quantity),
            received_quantity=int(line.received_quantity),
            remaining_quantity=max(0, int(line.quantity) - int(line.received_quantity)),
            unit_cost=float(line.unit_cost),
        )

    def _po_response(self, order: PurchaseOrderV2) -> PurchaseOrderResponse:
        supplier = self._db.query(Supplier).filter(Supplier.id == order.supplier_id).first()
        lines = self._db.query(PurchaseOrderV2Line).filter(PurchaseOrderV2Line.purchase_order_id == order.id).all()
        products = {
            product.id: product.title
            for product in self._db.query(CatalogProduct).filter(CatalogProduct.id.in_([line.product_id for line in lines])).all()
        } if lines else {}
        return PurchaseOrderResponse(
            id=order.id,
            order_number=order.order_number,
            supplier_id=order.supplier_id,
            supplier_name=supplier.name if supplier else order.supplier_id,
            status=order.status,
            ordered_at=order.ordered_at.isoformat(),
            received_at=order.received_at.isoformat() if order.received_at else None,
            lines=[self._po_line_response(line, products.get(line.product_id, line.product_id)) for line in lines],
        )

    def _sale_response(self, order: SalesOrder) -> SaleOrderResponse:
        lines = (
            self._db.query(SalesOrderLine)
            .filter(SalesOrderLine.sales_order_id == order.id)
            .order_by(SalesOrderLine.id.asc())
            .all()
        )
        discounts = (
            self._db.query(SalesOrderDiscount)
            .filter(SalesOrderDiscount.sales_order_id == order.id)
            .order_by(SalesOrderDiscount.id.asc())
            .all()
        )
        return SaleOrderResponse(
            order_id=order.id,
            order_number=order.order_number,
            warehouse_code=order.warehouse_code,
            status=order.status,
            created_at=order.created_at.isoformat(),
            subtotal=float(order.subtotal),
            discount_total=float(order.discount_total),
            total=float(order.total),
            lines=[
                SaleLineResponse(
                    line_id=line.id,
                    product_id=line.product_id,
                    product_name=line.product_name,
                    quantity=int(line.quantity),
                    unit_price=float(line.unit_price),
                    discount=float(line.line_discount),
                    total=float(line.line_total),
                )
                for line in lines
            ],
            discounts=[AppliedDiscountResponse(description=item.description, amount=float(item.amount)) for item in discounts],
        )

    def _audit(self, event_type: str, entity_type: str, entity_id: str, actor_user_id: str | None, payload: dict) -> None:
        now = self._now()
        serialized = json.dumps(payload, ensure_ascii=False)
        self._db.add(
            AuditEvent(
                id=f"AE-{uuid4().hex[:12].upper()}",
                event_type=event_type,
                entity_type=entity_type,
                entity_id=entity_id,
                actor_user_id=actor_user_id,
                payload=serialized,
                created_at=now,
            )
        )
        write_activity_log(
            self._db,
            action=event_type.upper(),
            entity_type=entity_type,
            entity_id=entity_id,
            performed_by=actor_user_id,
            changes=serialized,
            reason=event_type.replace("_", " "),
            timestamp=now,
        )

    def list_suppliers(self) -> list[Supplier]:
        return self._db.query(Supplier).order_by(Supplier.name.asc()).all()

    def create_supplier(self, payload: SupplierCreateRequest) -> SupplierSchema:
        ids = self._db.query(Supplier.id).all()
        max_num = 0
        for (supplier_id,) in ids:
            if supplier_id and supplier_id.startswith("S") and supplier_id[1:].isdigit():
                max_num = max(max_num, int(supplier_id[1:]))
        now = self._now()
        address = payload.address or self._compose_address(
            payload.location_street,
            payload.location_house_number,
            payload.location_postcode,
            payload.location_city,
            payload.location_state,
            payload.location_country,
        )
        supplier = Supplier(
            id=payload.id or f"S{max_num + 1:03d}",
            name=payload.name,
            contact=payload.contact,
            address=address,
            location_display_name=payload.location_display_name or address,
            location_street=payload.location_street,
            location_house_number=payload.location_house_number,
            location_postcode=payload.location_postcode,
            location_city=payload.location_city,
            location_state=payload.location_state,
            location_country=payload.location_country,
            location_lat=payload.location_lat,
            location_lon=payload.location_lon,
            location_source=payload.location_source or "manual",
            location_source_id=payload.location_source_id,
            notes=payload.notes,
            created_at=now,
        )
        self._db.add(supplier)
        self._audit("supplier_created", "supplier", supplier.id, None, {"name": supplier.name})
        self._db.commit()
        self._db.refresh(supplier)
        return self._supplier_schema(supplier)

    def list_catalog_products(self, include_inactive: bool) -> list[CatalogProductSchema]:
        q = self._db.query(CatalogProduct)
        if not include_inactive:
            q = q.filter(CatalogProduct.is_active == True)  # noqa: E712
        return [self._catalog_schema(row) for row in q.order_by(CatalogProduct.title.asc()).all()]

    def get_catalog_product(self, product_id: str) -> CatalogProductSchema:
        product = self._db.query(CatalogProduct).filter(CatalogProduct.id == product_id).first()
        if not product:
            raise ValueError("Katalogprodukt nicht gefunden")
        return self._catalog_schema(product)

    def create_catalog_product(self, payload: CatalogProductCreateRequest) -> CatalogProductSchema:
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
        self._set_standard_price(product.id, payload.selling_price, now)
        self._ensure_warehouse("STORE")
        self._audit("catalog_product_created", "catalog_product", product.id, None, {"sku": product.sku, "title": product.title})
        self._db.commit()
        self._db.refresh(product)
        return self._catalog_schema(product)

    def update_catalog_product(self, product_id: str, payload: CatalogProductUpdateRequest) -> CatalogProductSchema:
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
        if payload.selling_price is not None:
            self._set_standard_price(product.id, payload.selling_price, now)
        if payload.reorder_point is not None:
            rows = self._db.query(StockItem).filter(StockItem.product_id == product.id).all()
            if not rows:
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
            else:
                for row in rows:
                    row.reorder_point = payload.reorder_point
                    row.updated_at = now
        product.updated_at = now
        self._audit("catalog_product_updated", "catalog_product", product.id, None, {"title": product.title})
        self._db.commit()
        self._db.refresh(product)
        return self._catalog_schema(product)

    def delete_catalog_product(self, product_id: str) -> dict[str, str]:
        product = self._db.query(CatalogProduct).filter(CatalogProduct.id == product_id).first()
        if not product:
            raise ValueError("Katalogprodukt nicht gefunden")

        has_references = any(
            [
                self._db.query(StockLedgerEntry).filter(StockLedgerEntry.product_id == product.id).first(),
                self._db.query(PurchaseOrderV2Line).filter(PurchaseOrderV2Line.product_id == product.id).first(),
                self._db.query(SalesOrderLine).filter(SalesOrderLine.product_id == product.id).first(),
                self._db.query(ReturnOrderLine).filter(ReturnOrderLine.exchange_product_id == product.id).first(),
            ]
        )
        if has_references:
            product.is_active = False
            product.updated_at = self._now()
            self._audit("catalog_product_deactivated", "catalog_product", product.id, None, {"reason": "has references"})
            self._db.commit()
            return {"detail": "Produkt wurde deaktiviert, weil bereits Bewegungen oder Belege existieren."}

        self._db.query(ProductPrice).filter(ProductPrice.product_id == product.id).delete(synchronize_session=False)
        self._db.query(StockItem).filter(StockItem.product_id == product.id).delete(synchronize_session=False)
        self._db.query(ProductSupplier).filter(ProductSupplier.product_id == product.id).delete(synchronize_session=False)
        self._db.delete(product)
        self._audit("catalog_product_deleted", "catalog_product", product.id, None, {"sku": product.sku})
        self._db.commit()
        return {"detail": "Produkt wurde vollständig gelöscht."}

    def list_warehouses(self) -> list[WarehouseSchema]:
        return [self._warehouse_schema(row) for row in self._db.query(Warehouse).order_by(Warehouse.code.asc()).all()]

    def create_warehouse(self, payload: WarehouseCreateRequest) -> WarehouseSchema:
        existing = self._db.query(Warehouse).filter(Warehouse.code == payload.code).first()
        if existing:
            raise ValueError("Lagerort-Code ist bereits vergeben")
        now = self._now()
        warehouse = Warehouse(
            id=f"WH-{uuid4().hex[:12].upper()}",
            code=payload.code,
            name=payload.name,
            location_display_name=payload.location_display_name or payload.name,
            location_street=payload.location_street,
            location_house_number=payload.location_house_number,
            location_postcode=payload.location_postcode,
            location_city=payload.location_city,
            location_state=payload.location_state,
            location_country=payload.location_country,
            location_lat=payload.location_lat,
            location_lon=payload.location_lon,
            location_source=payload.location_source or "manual",
            location_source_id=payload.location_source_id,
            is_active=True,
            created_at=now,
        )
        self._db.add(warehouse)
        self._audit("warehouse_created", "warehouse", warehouse.id, None, {"code": warehouse.code, "name": warehouse.name})
        self._db.commit()
        return self._warehouse_schema(warehouse)

    def update_warehouse(self, warehouse_id: str, payload: WarehouseUpdateRequest) -> WarehouseSchema:
        warehouse = self._db.query(Warehouse).filter(Warehouse.id == warehouse_id).first()
        if not warehouse:
            raise ValueError("Lagerort nicht gefunden")
        if payload.name is not None:
            warehouse.name = payload.name.strip()
        if payload.location_display_name is not None:
            warehouse.location_display_name = payload.location_display_name
        if payload.location_street is not None:
            warehouse.location_street = payload.location_street
        if payload.location_house_number is not None:
            warehouse.location_house_number = payload.location_house_number
        if payload.location_postcode is not None:
            warehouse.location_postcode = payload.location_postcode
        if payload.location_city is not None:
            warehouse.location_city = payload.location_city
        if payload.location_state is not None:
            warehouse.location_state = payload.location_state
        if payload.location_country is not None:
            warehouse.location_country = payload.location_country
        if payload.location_lat is not None:
            warehouse.location_lat = payload.location_lat
        if payload.location_lon is not None:
            warehouse.location_lon = payload.location_lon
        if payload.location_source is not None:
            warehouse.location_source = payload.location_source
        if payload.location_source_id is not None:
            warehouse.location_source_id = payload.location_source_id
        if payload.is_active is not None:
            warehouse.is_active = payload.is_active
        self._audit("warehouse_updated", "warehouse", warehouse.id, None, {"code": warehouse.code, "name": warehouse.name})
        self._db.commit()
        return self._warehouse_schema(warehouse)

    def list_stock(self, include_zero: bool, warehouse_code: str | None, product_id: str | None = None) -> list[StockEntrySchema]:
        q = (
            self._db.query(StockItem, CatalogProduct, Warehouse)
            .join(CatalogProduct, CatalogProduct.id == StockItem.product_id)
            .join(Warehouse, Warehouse.id == StockItem.warehouse_id)
        )
        if not include_zero:
            q = q.filter(StockItem.on_hand > 0)
        if warehouse_code:
            q = q.filter(Warehouse.code == warehouse_code.upper())
        if product_id:
            q = q.filter(CatalogProduct.id == product_id)
        rows = q.order_by(Warehouse.code.asc(), CatalogProduct.title.asc()).all()
        return [self._stock_entry(stock, product, warehouse) for stock, product, warehouse in rows if product.is_active]

    def list_stock_ledger(
        self,
        *,
        warehouse_code: str | None = None,
        product_id: str | None = None,
        offset: int = 0,
        limit: int = 100,
    ) -> list[StockLedgerEntrySchema]:
        q = (
            self._db.query(StockLedgerEntry, CatalogProduct, Warehouse)
            .join(CatalogProduct, CatalogProduct.id == StockLedgerEntry.product_id)
            .join(Warehouse, Warehouse.id == StockLedgerEntry.warehouse_id)
        )
        if warehouse_code:
            q = q.filter(Warehouse.code == warehouse_code.upper())
        if product_id:
            q = q.filter(CatalogProduct.id == product_id)
        rows = (
            q.order_by(StockLedgerEntry.created_at.desc())
            .offset(offset)
            .limit(limit)
            .all()
        )
        return [self._ledger_entry(entry, product, warehouse) for entry, product, warehouse in rows]

    def adjust_stock(self, payload: StockAdjustmentRequest, performed_by: str) -> StockEntrySchema:
        product = self._db.query(CatalogProduct).filter(CatalogProduct.id == payload.product_id).first()
        if not product:
            raise ValueError("Katalogprodukt nicht gefunden")
        warehouse = self._ensure_warehouse(payload.warehouse_code)
        now = self._now()
        stock = (
            self._db.query(StockItem)
            .filter(StockItem.product_id == product.id, StockItem.warehouse_id == warehouse.id)
            .first()
        )
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
        self._audit("stock_adjusted", "stock_item", stock.id, performed_by, {"warehouse_code": warehouse.code, "delta": payload.quantity_delta, "reason": payload.reason})
        self._db.commit()
        return self._stock_entry(stock, product, warehouse)

    def list_product_suppliers(self, product_id: str) -> list[ProductSupplierSchema]:
        rows = (
            self._db.query(ProductSupplier, Supplier)
            .join(Supplier, Supplier.id == ProductSupplier.supplier_id)
            .filter(ProductSupplier.product_id == product_id)
            .order_by(ProductSupplier.is_primary.desc(), Supplier.name.asc())
            .all()
        )
        return [
            ProductSupplierSchema(
                supplier_id=supplier.id,
                supplier_name=supplier.name,
                supplier_sku=link.supplier_sku or "",
                is_primary=bool(link.is_primary),
                last_purchase_price=float(link.last_purchase_price),
            )
            for link, supplier in rows
        ]

    def upsert_product_suppliers(self, product_id: str, payload: ProductSupplierUpsertRequest) -> list[ProductSupplierSchema]:
        product = self._db.query(CatalogProduct).filter(CatalogProduct.id == product_id).first()
        if not product:
            raise ValueError("Katalogprodukt nicht gefunden")
        requested_ids = {link.supplier_id for link in payload.links}
        if requested_ids:
            found_ids = {row.id for row in self._db.query(Supplier).filter(Supplier.id.in_(requested_ids)).all()}
            missing = requested_ids - found_ids
            if missing:
                raise ValueError(f"Lieferant nicht gefunden: {', '.join(sorted(missing))}")
        now = self._now()
        self._db.query(ProductSupplier).filter(ProductSupplier.product_id == product.id).delete(synchronize_session=False)
        links = payload.links
        if links and not any(link.is_primary for link in links):
            links = [links[0].model_copy(update={"is_primary": True}), *links[1:]]
        for link in links:
            self._db.add(
                ProductSupplier(
                    id=f"PS-{uuid4().hex[:12].upper()}",
                    product_id=product.id,
                    supplier_id=link.supplier_id,
                    supplier_sku=link.supplier_sku,
                    is_primary=link.is_primary,
                    last_purchase_price=link.last_purchase_price,
                    created_at=now,
                    updated_at=now,
                )
            )
        self._audit("product_suppliers_updated", "catalog_product", product.id, None, {"supplier_ids": sorted(requested_ids)})
        self._db.commit()
        return self.list_product_suppliers(product.id)

    def list_discount_rules(self, only_active: bool) -> list[DiscountRuleSchema]:
        q = self._db.query(DiscountRule)
        if only_active:
            q = q.filter(DiscountRule.is_active == True)  # noqa: E712
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
            for row in q.order_by(DiscountRule.created_at.desc()).all()
        ]

    def create_discount_rule(self, payload: DiscountRuleCreateRequest) -> DiscountRuleSchema:
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
        self._audit("discount_rule_created", "discount_rule", row.id, None, {"name": row.name})
        self._db.commit()
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

    def _compute_rule_discount(self, subtotal: Decimal, rule: DiscountRule) -> Decimal:
        if subtotal < _money(rule.min_order_amount):
            return Decimal("0.00")
        if rule.value_type == "PERCENT":
            return _money(subtotal * (Decimal(rule.value) / Decimal("100")))
        return _money(rule.value)

    def list_purchase_orders(self) -> list[PurchaseOrderResponse]:
        rows = self._db.query(PurchaseOrderV2).order_by(PurchaseOrderV2.ordered_at.desc()).all()
        return [self._po_response(row) for row in rows]

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
            notes=payload.notes.strip(),
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
        self._audit("purchase_order_created", "purchase_order", order.id, user_id, {"supplier_id": supplier.id, "line_count": len(payload.lines)})
        self._db.commit()
        return self._po_response(order)

    def receive_purchase_order(self, order_id: str, payload: PurchaseOrderReceiveRequest, user_id: str) -> PurchaseOrderResponse:
        order = self._db.query(PurchaseOrderV2).filter(PurchaseOrderV2.id == order_id).first()
        if not order:
            raise ValueError("Bestellung nicht gefunden")
        warehouse = self._ensure_warehouse(payload.warehouse_code)
        now = self._now()
        requested = {line.line_id: line.receive_quantity for line in payload.lines}
        lines = self._db.query(PurchaseOrderV2Line).filter(PurchaseOrderV2Line.purchase_order_id == order.id).all()
        for line in lines:
            receive_qty = int(requested.get(line.id, 0))
            if receive_qty <= 0:
                continue
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
                    reference_type="purchase_order",
                    reference_id=order.id,
                    reason="Wareneingang",
                    performed_by=user_id,
                    created_at=now,
                )
            )
            supplier_link = (
                self._db.query(ProductSupplier)
                .filter(ProductSupplier.product_id == line.product_id, ProductSupplier.supplier_id == order.supplier_id)
                .first()
            )
            if supplier_link:
                supplier_link.last_purchase_price = line.unit_cost
                supplier_link.updated_at = now
            else:
                self._db.add(
                    ProductSupplier(
                        id=f"PS-{uuid4().hex[:12].upper()}",
                        product_id=line.product_id,
                        supplier_id=order.supplier_id,
                        supplier_sku="",
                        is_primary=False,
                        last_purchase_price=line.unit_cost,
                        created_at=now,
                        updated_at=now,
                    )
                )
        all_done = all(int(line.received_quantity) >= int(line.quantity) for line in lines)
        order.status = "RECEIVED" if all_done else "PARTIAL_RECEIVED"
        order.received_at = now if all_done else None
        self._audit("purchase_order_received", "purchase_order", order.id, user_id, {"warehouse_code": warehouse.code, "status": order.status})
        self._db.commit()
        return self._po_response(order)

    def list_sales_orders(self) -> list[SaleOrderResponse]:
        rows = self._db.query(SalesOrder).order_by(SalesOrder.created_at.desc()).all()
        return [self._sale_response(row) for row in rows]

    def create_sale(self, payload: SaleCreateRequest, cashier_user_id: str) -> SaleOrderResponse:
        if len(payload.lines) == 0:
            raise ValueError("Mindestens eine Verkaufsposition ist erforderlich")
        now = self._now()
        warehouse = self._ensure_warehouse(payload.warehouse_code)
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
                raise ValueError(f"Nicht genug Bestand für {product.title} in {warehouse.name}")
            unit_price = self._current_price(product.id)
            line_subtotal = _money(unit_price * item.quantity)
            subtotal += line_subtotal
            line_records.append({"product": product, "stock": stock, "quantity": int(item.quantity), "unit_price": unit_price, "line_subtotal": line_subtotal})
        rules = self._db.query(DiscountRule).filter(DiscountRule.is_active == True).all()  # noqa: E712
        discounts: list[tuple[str, Decimal, str | None]] = []
        for rule in rules:
            if rule.rule_type == "FIRST_CUSTOMER" and not payload.is_first_customer:
                continue
            amount = self._compute_rule_discount(subtotal, rule)
            if amount > 0:
                discounts.append((rule.name, amount, rule.id))
        if payload.custom_discount_amount > 0:
            discounts.append(("Individueller Rabatt", _money(payload.custom_discount_amount), None))
        discount_total = _money(sum((amount for _, amount, _ in discounts), Decimal("0.00"))) if discounts else Decimal("0.00")
        discount_total = min(discount_total, subtotal)
        order = SalesOrder(
            id=f"SO-{uuid4().hex[:12].upper()}",
            order_number=f"SO-{now.strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}",
            cashier_user_id=cashier_user_id,
            customer_reference=payload.customer_reference,
            warehouse_code=warehouse.code,
            is_first_customer=payload.is_first_customer,
            subtotal=float(subtotal),
            discount_total=float(discount_total),
            total=float(_money(subtotal - discount_total)),
            status="COMPLETED",
            created_at=now,
        )
        self._db.add(order)
        self._db.flush()
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
        for name, amount, rule_id in discounts:
            self._db.add(
                SalesOrderDiscount(
                    id=f"SD-{uuid4().hex[:12].upper()}",
                    sales_order_id=order.id,
                    rule_id=rule_id,
                    description=name,
                    amount=float(min(amount, subtotal)),
                )
            )
        self._audit("sales_order_created", "sales_order", order.id, cashier_user_id, {"warehouse_code": warehouse.code, "total": float(order.total)})
        self._db.commit()
        return self._sale_response(order)

    def create_return(self, sales_order_id: str, payload: ReturnCreateRequest, processed_by_user_id: str) -> ReturnOrderResponse:
        order = self._db.query(SalesOrder).filter(SalesOrder.id == sales_order_id).first()
        if not order:
            raise ValueError("Verkaufsauftrag nicht gefunden")
        warehouse = self._ensure_warehouse(order.warehouse_code)
        now = self._now()
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
        self._audit("return_order_created", "return_order", return_order.id, processed_by_user_id, {"sales_order_id": order.id, "refund_total": float(return_order.refund_total)})
        self._db.commit()
        return ReturnOrderResponse(return_id=return_order.id, return_number=return_order.return_number, refund_total=float(return_order.refund_total))
