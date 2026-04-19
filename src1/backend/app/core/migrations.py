from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.core.time import utc_now_iso
from app.db.models import Book
from app.db.models_commerce import CatalogProduct, DiscountRule, ProductPrice, StockItem, Warehouse
from app.db.session import SessionLocal, engine


def _ensure_migration_table() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS schema_migrations (
                    version VARCHAR PRIMARY KEY,
                    applied_at VARCHAR NOT NULL
                )
                """
            )
        )


def _applied_versions(conn) -> set[str]:
    rows = conn.execute(text("SELECT version FROM schema_migrations")).fetchall()
    return {str(row[0]) for row in rows}


def _mark_applied(conn, version: str) -> None:
    conn.execute(
        text("INSERT INTO schema_migrations (version, applied_at) VALUES (:version, :applied_at)"),
        {"version": version, "applied_at": utc_now_iso()},
    )


def _migration_20260419_001_backfill_catalog(session: Session) -> None:
    now = datetime.fromisoformat(utc_now_iso())
    warehouse = session.query(Warehouse).filter(Warehouse.code == "STORE").first()
    if not warehouse:
        warehouse = Warehouse(
            id="WH-STORE",
            code="STORE",
            name="Verkaufsfläche",
            is_active=True,
            created_at=now,
        )
        session.add(warehouse)
        session.flush()

    books = session.query(Book).all()
    for book in books:
        existing = session.query(CatalogProduct).filter(CatalogProduct.id == f"CP-{book.id}").first()
        if not existing:
            existing = CatalogProduct(
                id=f"CP-{book.id}",
                sku=(book.sku or f"SKU-{book.id}"),
                title=book.name,
                author=book.author or "",
                description=book.description or "",
                category=book.category or "",
                is_active=True,
                created_at=book.created_at or now,
                updated_at=book.updated_at or now,
            )
            session.add(existing)
            session.flush()

        price = session.query(ProductPrice).filter(ProductPrice.product_id == existing.id, ProductPrice.price_type == "standard").first()
        if not price:
            session.add(
                ProductPrice(
                    id=f"PR-{uuid4().hex[:12].upper()}",
                    product_id=existing.id,
                    price_type="standard",
                    amount=float(book.sell_price),
                    currency="EUR",
                    valid_from=None,
                    valid_to=None,
                    priority=0,
                    is_active=True,
                    created_at=now,
                )
            )

        stock = (
            session.query(StockItem)
            .filter(StockItem.product_id == existing.id, StockItem.warehouse_id == warehouse.id)
            .first()
        )
        if not stock:
            session.add(
                StockItem(
                    id=f"ST-{uuid4().hex[:12].upper()}",
                    warehouse_id=warehouse.id,
                    product_id=existing.id,
                    on_hand=max(0, int(book.quantity)),
                    reserved=0,
                    reorder_point=5,
                    updated_at=now,
                )
            )


def _migration_20260419_002_indexes() -> None:
    with engine.begin() as conn:
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_catalog_products_title ON catalog_products (title)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_items_product ON stock_items (product_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sales_orders_created_at ON sales_orders (created_at DESC)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_purchase_orders_v2_status ON purchase_orders_v2 (status)"))


def _migration_20260419_003_seed_discount_rules(session: Session) -> None:
    now = datetime.fromisoformat(utc_now_iso())
    if session.query(DiscountRule).count() > 0:
        return
    session.add(
        DiscountRule(
            id="DR-SEASONAL-10",
            name="Saisonrabatt 10%",
            rule_type="SEASONAL",
            value_type="PERCENT",
            value=10,
            min_order_amount=0,
            stackable=False,
            active_from=None,
            active_to=None,
            is_active=True,
            created_at=now,
        )
    )
    session.add(
        DiscountRule(
            id="DR-FIRST-5",
            name="Erstkundenrabatt 5%",
            rule_type="FIRST_CUSTOMER",
            value_type="PERCENT",
            value=5,
            min_order_amount=0,
            stackable=True,
            active_from=None,
            active_to=None,
            is_active=True,
            created_at=now,
        )
    )


def ensure_schema() -> None:
    _ensure_migration_table()

    with engine.begin() as conn:
        inspector = inspect(conn)
        if "schema_migrations" not in inspector.get_table_names():
            return
        applied = _applied_versions(conn)

    if "20260419_001_backfill_catalog" not in applied:
        session = SessionLocal()
        try:
            _migration_20260419_001_backfill_catalog(session)
            session.commit()
        finally:
            session.close()
        with engine.begin() as conn:
            _mark_applied(conn, "20260419_001_backfill_catalog")

    with engine.begin() as conn:
        applied = _applied_versions(conn)
    if "20260419_002_indexes" not in applied:
        _migration_20260419_002_indexes()
        with engine.begin() as conn:
            _mark_applied(conn, "20260419_002_indexes")

    with engine.begin() as conn:
        applied = _applied_versions(conn)
    if "20260419_003_seed_discount_rules" not in applied:
        session = SessionLocal()
        try:
            _migration_20260419_003_seed_discount_rules(session)
            session.commit()
        finally:
            session.close()
        with engine.begin() as conn:
            _mark_applied(conn, "20260419_003_seed_discount_rules")
