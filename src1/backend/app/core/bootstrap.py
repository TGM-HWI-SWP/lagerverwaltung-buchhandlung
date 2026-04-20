from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from sqlalchemy import inspect, text

from app.api import suppliers
from app.core.migrations import ensure_schema
from app.core.time import utc_now_iso
from app.db import models_auth, models_commerce  # noqa: F401
from app.db.models import Base, Supplier
from app.db.schemas import SupplierSchema
from app.db.session import SessionLocal, engine


def _ensure_sqlite_schema() -> None:
    if engine.url.get_backend_name() != "sqlite":
        return

    with engine.begin() as conn:
        inspector = inspect(conn)
        if "books" not in inspector.get_table_names():
            return

        book_columns = {col["name"] for col in inspector.get_columns("books")}
        if "author" not in book_columns:
            conn.execute(text("ALTER TABLE books ADD COLUMN author VARCHAR DEFAULT '' NOT NULL"))

        table_names = set(inspector.get_table_names())

        if "staff_users" not in table_names:
            conn.execute(
                text(
                    """
                    CREATE TABLE staff_users (
                        id VARCHAR PRIMARY KEY,
                        username VARCHAR NOT NULL UNIQUE,
                        display_name VARCHAR NOT NULL,
                        role VARCHAR NOT NULL DEFAULT 'cashier',
                        pin_hash VARCHAR NOT NULL,
                        password_hash VARCHAR NOT NULL DEFAULT '',
                        is_active BOOLEAN NOT NULL DEFAULT 1,
                        CONSTRAINT ck_staff_users_pin_hash_non_empty CHECK (pin_hash <> '')
                    )
                    """
                )
            )

        staff_columns = {col["name"] for col in inspector.get_columns("staff_users")}
        if "avatar_image" not in staff_columns:
            conn.execute(text("ALTER TABLE staff_users ADD COLUMN avatar_image VARCHAR NOT NULL DEFAULT ''"))
        if "password_hash" not in staff_columns:
            conn.execute(text("ALTER TABLE staff_users ADD COLUMN password_hash VARCHAR NOT NULL DEFAULT ''"))

        if "book_suppliers" not in table_names:
            conn.execute(
                text(
                    """
                    CREATE TABLE book_suppliers (
                        id VARCHAR PRIMARY KEY,
                        book_id VARCHAR NOT NULL,
                        supplier_id VARCHAR NOT NULL,
                        supplier_sku VARCHAR NOT NULL DEFAULT '',
                        is_primary BOOLEAN NOT NULL DEFAULT 0,
                        last_purchase_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
                        created_at VARCHAR NOT NULL,
                        updated_at VARCHAR NOT NULL,
                        CONSTRAINT uq_book_suppliers_book_supplier UNIQUE (book_id, supplier_id),
                        FOREIGN KEY(book_id) REFERENCES books (id),
                        FOREIGN KEY(supplier_id) REFERENCES suppliers (id),
                        CONSTRAINT ck_book_suppliers_last_price_non_negative CHECK (last_purchase_price >= 0)
                    )
                    """
                )
            )

        if "activity_logs" not in table_names:
            conn.execute(
                text(
                    """
                    CREATE TABLE activity_logs (
                        id VARCHAR PRIMARY KEY,
                        timestamp VARCHAR NOT NULL DEFAULT (datetime('now', 'localtime')),
                        performed_by VARCHAR NOT NULL DEFAULT 'system',
                        action VARCHAR NOT NULL,
                        entity_type VARCHAR NOT NULL,
                        entity_id VARCHAR NOT NULL,
                        changes TEXT,
                        reason VARCHAR
                    )
                    """
                )
            )

        def _add_dt_column(table: str, old_col: str, new_col: str) -> None:
            cols = {c["name"] for c in inspector.get_columns(table)}
            if new_col in cols:
                return
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {new_col} DATETIME"))
            conn.execute(
                text(
                    f"UPDATE {table} SET {new_col} = {old_col} "
                    f"WHERE {new_col} IS NULL AND {old_col} IS NOT NULL"
                )
            )

        if "books" in table_names:
            _add_dt_column("books", "created_at", "created_at_dt")
            _add_dt_column("books", "updated_at", "updated_at_dt")
        if "movements" in table_names:
            _add_dt_column("movements", "timestamp", "timestamp_dt")
        if "suppliers" in table_names:
            _add_dt_column("suppliers", "created_at", "created_at_dt")
        if "purchase_orders" in table_names:
            _add_dt_column("purchase_orders", "created_at", "created_at_dt")
            _add_dt_column("purchase_orders", "delivered_at", "delivered_at_dt")
        if "incoming_deliveries" in table_names:
            _add_dt_column("incoming_deliveries", "received_at", "received_at_dt")
        if "book_suppliers" in table_names:
            _add_dt_column("book_suppliers", "created_at", "created_at_dt")
            _add_dt_column("book_suppliers", "updated_at", "updated_at_dt")
        if "activity_logs" in table_names:
            _add_dt_column("activity_logs", "timestamp", "timestamp_dt")

        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_books_supplier_id ON books (supplier_id)"))
        conn.execute(
            text("CREATE UNIQUE INDEX IF NOT EXISTS ix_books_sku_non_empty ON books (sku) WHERE sku <> ''")
        )
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_movements_book_id ON movements (book_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_purchase_orders_supplier_id ON purchase_orders (supplier_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_purchase_orders_book_id ON purchase_orders (book_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_incoming_deliveries_order_id ON incoming_deliveries (order_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_incoming_deliveries_book_id ON incoming_deliveries (book_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_book_suppliers_supplier_id ON book_suppliers (supplier_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_book_suppliers_book_id ON book_suppliers (book_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_activity_logs_timestamp ON activity_logs (timestamp DESC)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_activity_logs_entity ON activity_logs (entity_type, entity_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_activity_logs_performed_by ON activity_logs (performed_by)"))

        rows = conn.execute(
            text(
                """
                SELECT id, supplier_id, sku, purchase_price, created_at, updated_at
                FROM books
                WHERE supplier_id IS NOT NULL AND supplier_id <> ''
                """
            )
        ).fetchall()
        for row in rows:
            existing = conn.execute(
                text(
                    """
                    SELECT 1
                    FROM book_suppliers
                    WHERE book_id = :book_id AND supplier_id = :supplier_id
                    """
                ),
                {"book_id": row.id, "supplier_id": row.supplier_id},
            ).fetchone()
            if existing:
                continue
            conn.execute(
                text(
                    """
                    INSERT INTO book_suppliers (
                        id, book_id, supplier_id, supplier_sku, is_primary,
                        last_purchase_price, created_at, updated_at
                    )
                    VALUES (
                        :id, :book_id, :supplier_id, :supplier_sku, 1,
                        :last_purchase_price, :created_at, :updated_at
                    )
                    """
                ),
                {
                    "id": str(uuid4()),
                    "book_id": row.id,
                    "supplier_id": row.supplier_id,
                    "supplier_sku": row.sku or "",
                    "last_purchase_price": row.purchase_price,
                    "created_at": row.created_at,
                    "updated_at": row.updated_at,
                },
            )


def _seed_sqlite_database() -> None:
    if engine.url.get_backend_name() != "sqlite":
        return

    sql_file = Path(__file__).resolve().parents[1] / "db" / "buchhandlung.sql"
    if not sql_file.exists():
        return

    with engine.begin() as conn:
        book_count = conn.execute(text("SELECT COUNT(*) FROM books")).scalar()
        if book_count and book_count > 0:
            return

        sql = sql_file.read_text(encoding="utf-8")
        for statement in sql.split(";"):
            stmt = statement.strip()
            if stmt:
                conn.execute(text(stmt))


def _ensure_default_supplier_data() -> None:
    supplier_id = "S001"
    supplier_name = "Buchgroßhandel Wien GmbH"
    supplier_contact = "kontakt@bgh-wien.at"
    supplier_address = "Mariahilfer Straße 100, 1060 Wien"
    supplier_notes = "Hauptlieferant für alle Bücher"

    db = SessionLocal()
    try:
        exists = db.query(Supplier).filter(Supplier.id == supplier_id).first()
        if exists:
            return
        supplier = SupplierSchema(
            id=supplier_id,
            name=supplier_name,
            contact=supplier_contact,
            address=supplier_address,
            notes=supplier_notes,
            created_at=utc_now_iso(),
        )
        suppliers.create_supplier(db, supplier)
    finally:
        db.close()


def initialize_application() -> None:
    Base.metadata.create_all(bind=engine)
    _ensure_sqlite_schema()
    _seed_sqlite_database()
    _ensure_default_supplier_data()
    ensure_schema()


def get_database_health() -> dict[str, str | bool]:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"ok": True, "dialect": engine.url.get_backend_name()}
    except Exception as exc:  # pragma: no cover - defensive health reporting
        return {
            "ok": False,
            "dialect": engine.url.get_backend_name(),
            "error": str(exc),
        }
