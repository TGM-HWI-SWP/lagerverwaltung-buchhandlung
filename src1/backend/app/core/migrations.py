from __future__ import annotations

from sqlalchemy import text

from app.db.session import engine


def ensure_schema() -> None:
    with engine.begin() as conn:
        for statement in [
            "ALTER TABLE suppliers ADD COLUMN location_display_name TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE suppliers ADD COLUMN location_street TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE suppliers ADD COLUMN location_house_number TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE suppliers ADD COLUMN location_postcode TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE suppliers ADD COLUMN location_city TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE suppliers ADD COLUMN location_state TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE suppliers ADD COLUMN location_country TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE suppliers ADD COLUMN location_lat TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE suppliers ADD COLUMN location_lon TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE suppliers ADD COLUMN location_source TEXT NOT NULL DEFAULT 'manual'",
            "ALTER TABLE suppliers ADD COLUMN location_source_id TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE warehouses ADD COLUMN location_display_name TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE warehouses ADD COLUMN location_street TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE warehouses ADD COLUMN location_house_number TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE warehouses ADD COLUMN location_postcode TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE warehouses ADD COLUMN location_city TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE warehouses ADD COLUMN location_state TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE warehouses ADD COLUMN location_country TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE warehouses ADD COLUMN location_lat TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE warehouses ADD COLUMN location_lon TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE warehouses ADD COLUMN location_source TEXT NOT NULL DEFAULT 'manual'",
            "ALTER TABLE warehouses ADD COLUMN location_source_id TEXT NOT NULL DEFAULT ''",
        ]:
            try:
                conn.execute(text(statement))
            except Exception:
                pass
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_catalog_products_title ON catalog_products (title)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_product_prices_product_id ON product_prices (product_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_items_product_id ON stock_items (product_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_items_warehouse_id ON stock_items (warehouse_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_ledger_product_id ON stock_ledger_entries (product_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_ledger_warehouse_id ON stock_ledger_entries (warehouse_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_stock_ledger_created_at ON stock_ledger_entries (created_at DESC)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_product_suppliers_product_id ON product_suppliers (product_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_product_suppliers_supplier_id ON product_suppliers (supplier_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_purchase_orders_v2_status ON purchase_orders_v2 (status)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_purchase_order_v2_lines_order_id ON purchase_order_v2_lines (purchase_order_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sales_orders_created_at ON sales_orders (created_at DESC)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_sales_order_lines_order_id ON sales_order_lines (sales_order_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_activity_logs_timestamp ON activity_logs (timestamp DESC)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_activity_logs_entity ON activity_logs (entity_type, entity_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_events_created_at ON audit_events (created_at DESC)"))
