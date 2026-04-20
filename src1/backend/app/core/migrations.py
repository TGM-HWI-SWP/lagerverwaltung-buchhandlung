from __future__ import annotations

from sqlalchemy import inspect, text

from app.db.session import engine


LOCATION_COLUMNS: dict[str, list[tuple[str, str]]] = {
    "suppliers": [
        ("location_display_name", "TEXT NOT NULL DEFAULT ''"),
        ("location_street", "TEXT NOT NULL DEFAULT ''"),
        ("location_house_number", "TEXT NOT NULL DEFAULT ''"),
        ("location_postcode", "TEXT NOT NULL DEFAULT ''"),
        ("location_city", "TEXT NOT NULL DEFAULT ''"),
        ("location_state", "TEXT NOT NULL DEFAULT ''"),
        ("location_country", "TEXT NOT NULL DEFAULT ''"),
        ("location_lat", "TEXT NOT NULL DEFAULT ''"),
        ("location_lon", "TEXT NOT NULL DEFAULT ''"),
        ("location_source", "TEXT NOT NULL DEFAULT 'manual'"),
        ("location_source_id", "TEXT NOT NULL DEFAULT ''"),
    ],
    "warehouses": [
        ("location_display_name", "TEXT NOT NULL DEFAULT ''"),
        ("location_street", "TEXT NOT NULL DEFAULT ''"),
        ("location_house_number", "TEXT NOT NULL DEFAULT ''"),
        ("location_postcode", "TEXT NOT NULL DEFAULT ''"),
        ("location_city", "TEXT NOT NULL DEFAULT ''"),
        ("location_state", "TEXT NOT NULL DEFAULT ''"),
        ("location_country", "TEXT NOT NULL DEFAULT ''"),
        ("location_lat", "TEXT NOT NULL DEFAULT ''"),
        ("location_lon", "TEXT NOT NULL DEFAULT ''"),
        ("location_source", "TEXT NOT NULL DEFAULT 'manual'"),
        ("location_source_id", "TEXT NOT NULL DEFAULT ''"),
    ],
}

INDEX_STATEMENTS = [
    "CREATE INDEX IF NOT EXISTS ix_catalog_products_title ON catalog_products (title)",
    "CREATE INDEX IF NOT EXISTS ix_product_prices_product_id ON product_prices (product_id)",
    "CREATE INDEX IF NOT EXISTS ix_stock_items_product_id ON stock_items (product_id)",
    "CREATE INDEX IF NOT EXISTS ix_stock_items_warehouse_id ON stock_items (warehouse_id)",
    "CREATE INDEX IF NOT EXISTS ix_stock_ledger_product_id ON stock_ledger_entries (product_id)",
    "CREATE INDEX IF NOT EXISTS ix_stock_ledger_warehouse_id ON stock_ledger_entries (warehouse_id)",
    "CREATE INDEX IF NOT EXISTS ix_stock_ledger_created_at ON stock_ledger_entries (created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_product_suppliers_product_id ON product_suppliers (product_id)",
    "CREATE INDEX IF NOT EXISTS ix_product_suppliers_supplier_id ON product_suppliers (supplier_id)",
    "CREATE INDEX IF NOT EXISTS ix_purchase_orders_v2_status ON purchase_orders_v2 (status)",
    "CREATE INDEX IF NOT EXISTS ix_purchase_order_v2_lines_order_id ON purchase_order_v2_lines (purchase_order_id)",
    "CREATE INDEX IF NOT EXISTS ix_sales_orders_created_at ON sales_orders (created_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_sales_order_lines_order_id ON sales_order_lines (sales_order_id)",
    "CREATE INDEX IF NOT EXISTS ix_activity_logs_timestamp ON activity_logs (timestamp DESC)",
    "CREATE INDEX IF NOT EXISTS ix_activity_logs_entity ON activity_logs (entity_type, entity_id)",
    "CREATE INDEX IF NOT EXISTS ix_audit_events_created_at ON audit_events (created_at DESC)",
]


def ensure_schema() -> None:
    with engine.begin() as conn:
        inspector = inspect(conn)
        existing_tables = set(inspector.get_table_names())

        for table_name, columns in LOCATION_COLUMNS.items():
            if table_name not in existing_tables:
                continue

            existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
            for column_name, column_sql in columns:
                if column_name in existing_columns:
                    continue
                conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_sql}"))

        for statement in INDEX_STATEMENTS:
            conn.execute(text(statement))
