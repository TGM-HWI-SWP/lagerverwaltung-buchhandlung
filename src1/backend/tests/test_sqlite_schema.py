import sqlite3
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SQL_FILE = ROOT / "app" / "db" / "buchhadlung.sql"


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
            {"books", "movements", "suppliers", "book_suppliers", "purchase_orders", "incoming_deliveries"}.issubset(
                tables
            )
        )

        book_columns = {
            row[1] for row in self.conn.execute("PRAGMA table_info(books)").fetchall()
        }
        self.assertIn("author", book_columns)

        counts = {
            "books": self.conn.execute("SELECT COUNT(*) FROM books").fetchone()[0],
            "movements": self.conn.execute("SELECT COUNT(*) FROM movements").fetchone()[0],
            "suppliers": self.conn.execute("SELECT COUNT(*) FROM suppliers").fetchone()[0],
            "book_suppliers": self.conn.execute("SELECT COUNT(*) FROM book_suppliers").fetchone()[0],
        }
        self.assertEqual(counts, {"books": 12, "movements": 10, "suppliers": 2, "book_suppliers": 15})

        second_supplier_link = self.conn.execute(
            """
            SELECT supplier_id, is_primary, last_purchase_price
            FROM book_suppliers
            WHERE book_id = 'B001'
            ORDER BY supplier_id
            """
        ).fetchall()
        self.assertEqual(second_supplier_link, [("S001", 1, 20.99), ("S002", 0, 21.49)])

    def test_purchase_flow_tables_accept_persistent_rows(self) -> None:
        execute_sql_file(self.conn)

        self.conn.execute(
            """
            INSERT INTO purchase_orders (
                id, supplier_id, supplier_name, book_id, book_name, book_sku,
                unit_price, quantity, delivered_quantity, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "PO-001",
                "S001",
                "Buchgrosshandel Wien GmbH",
                "B001",
                "Der Herr der Ringe",
                "ISBN-978-3-608-93981-2",
                20.99,
                5,
                2,
                "teilgeliefert",
                "2026-04-18T12:00:00+00:00",
            ),
        )
        self.conn.execute(
            """
            INSERT INTO incoming_deliveries (
                id, order_id, supplier_id, supplier_name, book_id, book_name,
                quantity, unit_price, received_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "IN-001",
                "PO-001",
                "S001",
                "Buchgrosshandel Wien GmbH",
                "B001",
                "Der Herr der Ringe",
                2,
                20.99,
                "2026-04-18T13:00:00+00:00",
            ),
        )
        self.conn.commit()

        order_row = self.conn.execute(
            "SELECT status, delivered_quantity FROM purchase_orders WHERE id = 'PO-001'"
        ).fetchone()
        delivery_row = self.conn.execute(
            "SELECT quantity, unit_price FROM incoming_deliveries WHERE id = 'IN-001'"
        ).fetchone()

        self.assertEqual(order_row, ("teilgeliefert", 2))
        self.assertEqual(delivery_row, (2, 20.99))

    def test_constraints_block_invalid_prices_and_duplicate_supplier_links(self) -> None:
        execute_sql_file(self.conn)

        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                """
                INSERT INTO books (
                    id, name, author, description, purchase_price, sell_price, quantity,
                    sku, category, supplier_id, created_at, updated_at, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "B999",
                    "Fehlerbuch",
                    "",
                    "Test",
                    -1,
                    10,
                    1,
                    "ERR-001",
                    "Test",
                    "S001",
                    "2026-04-18T12:00:00+00:00",
                    "2026-04-18T12:00:00+00:00",
                    None,
                ),
            )

        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                """
                INSERT INTO book_suppliers (
                    id, book_id, supplier_id, supplier_sku, is_primary,
                    last_purchase_price, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "BS999",
                    "B001",
                    "S001",
                    "DUP",
                    0,
                    20.99,
                    "2026-04-18T12:00:00+00:00",
                    "2026-04-18T12:00:00+00:00",
                ),
            )


if __name__ == "__main__":
    unittest.main()
