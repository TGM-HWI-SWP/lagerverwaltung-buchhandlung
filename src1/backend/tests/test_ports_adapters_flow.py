import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.adapters.sqlalchemy_repositories import SqlAlchemyUnitOfWork
from app.db.models import Base
from app.db.schemas import (
    BookSchema,
    MovementSchema,
    PurchaseOrderSchema,
    SupplierSchema,
)
from app.adapters.schema_mappers import (
    book_from_schema,
    movement_from_schema,
    purchase_order_from_schema,
    supplier_from_schema,
)
from app.services.books import BooksService
from app.services.inventory import InventoryService
from app.services.suppliers import SupplierService


class PortsAdaptersFlowTest(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)

    def _services(self, session):
        uow = SqlAlchemyUnitOfWork(session)
        return BooksService(uow), InventoryService(uow), SupplierService(uow)

    def test_book_crud_roundtrip_returns_domain_models(self) -> None:
        with self.Session() as session:
            books_svc, _, _ = self._services(session)
            created = books_svc.create_book(
                book_from_schema(
                    BookSchema(
                        id="B001",
                        name="Testbuch",
                        description="Ein Testbuch",
                        purchase_price=10.0,
                        sell_price=15.0,
                        quantity=3,
                    )
                )
            )
            self.assertEqual(created.id, "B001")
            self.assertEqual(created.quantity, 3)

            listed = books_svc.list_books()
            self.assertEqual([b.id for b in listed], ["B001"])

            updated = books_svc.update_book(
                "B001",
                book_from_schema(
                    BookSchema(
                        id="B001",
                        name="Testbuch (neu)",
                        description="geändert",
                        purchase_price=11.0,
                        sell_price=16.0,
                        quantity=3,
                    ),
                    existing=created,
                ),
            )
            self.assertIsNotNone(updated)
            self.assertEqual(updated.name, "Testbuch (neu)")

            self.assertTrue(books_svc.delete_book("B001"))
            self.assertEqual(books_svc.list_books(), [])

    def test_inventory_movement_adjusts_book_quantity(self) -> None:
        with self.Session() as session:
            books_svc, inv_svc, _ = self._services(session)
            books_svc.create_book(
                book_from_schema(
                    BookSchema(
                        id="B010",
                        name="Buch 10",
                        description="d",
                        purchase_price=5.0,
                        sell_price=7.0,
                        quantity=10,
                    )
                )
            )
            movement = inv_svc.create_movement(
                movement_from_schema(
                    MovementSchema(
                        book_id="B010",
                        quantity_change=3,
                        movement_type="OUT",
                    )
                )
            )
            self.assertEqual(movement.movement_type, "OUT")
            self.assertEqual(movement.quantity_change, -3)
            self.assertTrue(movement.id.startswith("M"))
            self.assertEqual(books_svc.get_book("B010").quantity, 7)

    def test_inventory_rejects_negative_stock(self) -> None:
        with self.Session() as session:
            books_svc, inv_svc, _ = self._services(session)
            books_svc.create_book(
                book_from_schema(
                    BookSchema(
                        id="B020",
                        name="Buch 20",
                        description="d",
                        purchase_price=5.0,
                        sell_price=7.0,
                        quantity=2,
                    )
                )
            )
            with self.assertRaises(ValueError):
                inv_svc.create_movement(
                    movement_from_schema(
                        MovementSchema(
                            book_id="B020",
                            quantity_change=5,
                            movement_type="OUT",
                        )
                    )
                )

    def test_supplier_purchase_flow_end_to_end(self) -> None:
        with self.Session() as session:
            books_svc, inv_svc, sup_svc = self._services(session)

            sup_svc.create_supplier(
                supplier_from_schema(
                    SupplierSchema(id="S001", name="Lieferant A")
                )
            )
            books_svc.create_book(
                book_from_schema(
                    BookSchema(
                        id="B030",
                        name="Buch 30",
                        description="d",
                        purchase_price=4.0,
                        sell_price=6.0,
                        quantity=0,
                        supplier_id="S001",
                    )
                )
            )

            order = sup_svc.create_purchase_order(
                purchase_order_from_schema(
                    PurchaseOrderSchema(
                        supplier_id="S001",
                        book_id="B030",
                        unit_price=4.0,
                        quantity=5,
                    )
                )
            )
            self.assertEqual(order.status, "offen")

            delivery = sup_svc.receive_purchase_order(order.id, 2)
            self.assertEqual(delivery.quantity, 2)

            refreshed = sup_svc.list_purchase_orders()[0]
            self.assertEqual(refreshed.status, "teilgeliefert")
            self.assertEqual(refreshed.delivered_quantity, 2)

            movement = sup_svc.book_incoming_delivery(delivery.id)
            self.assertEqual(movement.movement_type, "IN")
            self.assertEqual(movement.quantity_change, 2)
            self.assertEqual(books_svc.get_book("B030").quantity, 2)

            stock = sup_svc.get_supplier_stock("S001")
            self.assertEqual([e.book_id for e in stock], ["B030"])


if __name__ == "__main__":
    unittest.main()
