import sqlite3
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SQL_FILE = ROOT / "app" / "db" / "buchhandlung.sql"


def execute_sql_file(conn: sqlite3.Connection) -> None:
    sql = SQL_FILE.read_text(encoding="utf-8")
    statements = [statement.strip() for statement in sql.split(";") if statement.strip()]
    for statement in statements:
        conn.execute(statement)
    conn.commit()


class SqliteSchemaTest(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = sqlite3.connect(":memory:")

    def tearDown(self) -> None:
        self.conn.close()

    def test_seed_sql_executes_on_fresh_database(self) -> None:
        execute_sql_file(self.conn)

        tables = {
            row[0]
            for row in self.conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }

        self.assertTrue(
            {
                "catalog_products",
                "warehouses",
                "stock_items",
                "stock_ledger_entries",
                "product_suppliers",
                "purchase_orders_v2",
                "sales_orders",
            }.issubset(tables)
        )

        counts = {
            "catalog_products": self.conn.execute("SELECT COUNT(*) FROM catalog_products").fetchone()[0],
            "warehouses": self.conn.execute("SELECT COUNT(*) FROM warehouses").fetchone()[0],
            "stock_items": self.conn.execute("SELECT COUNT(*) FROM stock_items").fetchone()[0],
            "product_suppliers": self.conn.execute("SELECT COUNT(*) FROM product_suppliers").fetchone()[0],
        }
        self.assertEqual(counts, {"catalog_products": 6, "warehouses": 3, "stock_items": 10, "product_suppliers": 7})

    def test_purchase_flow_tables_accept_multi_line_rows(self) -> None:
        execute_sql_file(self.conn)

        self.conn.execute(
            """
            INSERT INTO purchase_orders_v2 (
                id, order_number, supplier_id, created_by_user_id, status, notes, ordered_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "PO2-EXTRA",
                "PO2-20260421-EXTRA",
                "S001",
                "U-DEMO002",
                "ORDERED",
                "Testbestellung",
                "2026-04-21T09:00:00+00:00",
            ),
        )
        self.conn.execute(
            """
            INSERT INTO purchase_order_v2_lines (
                id, purchase_order_id, product_id, quantity, received_quantity, unit_cost
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            ("POL-EXTRA-1", "PO2-EXTRA", "CP001", 4, 1, 20.99),
        )
        self.conn.commit()

        order_row = self.conn.execute(
            "SELECT status FROM purchase_orders_v2 WHERE id = 'PO2-EXTRA'"
        ).fetchone()
        line_row = self.conn.execute(
            "SELECT quantity, received_quantity FROM purchase_order_v2_lines WHERE id = 'POL-EXTRA-1'"
        ).fetchone()

        self.assertEqual(order_row, ("ORDERED",))
        self.assertEqual(line_row, (4, 1))

    def test_constraints_block_invalid_price_and_duplicate_product_supplier_link(self) -> None:
        execute_sql_file(self.conn)

        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                """
                INSERT INTO product_prices (
                    id, product_id, price_type, amount, currency, valid_from, valid_to, priority, is_active, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "PR-BAD",
                    "CP001",
                    "standard",
                    -1,
                    "EUR",
                    None,
                    None,
                    0,
                    1,
                    "2026-04-21T09:00:00+00:00",
                ),
            )

        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                """
                INSERT INTO product_suppliers (
                    id, product_id, supplier_id, supplier_sku, is_primary,
                    last_purchase_price, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "PS-dup",
                    "CP001",
                    "S001",
                    "DUP",
                    0,
                    20.99,
                    "2026-04-21T09:00:00+00:00",
                    "2026-04-21T09:00:00+00:00",
                ),
            )


if __name__ == "__main__":
    unittest.main()
