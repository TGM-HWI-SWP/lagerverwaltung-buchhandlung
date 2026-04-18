from sqlalchemy import Boolean, CheckConstraint, Column, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Book(Base):
    __tablename__ = "books"
    __table_args__ = (
        CheckConstraint("purchase_price >= 0", name="ck_books_purchase_price_non_negative"),
        CheckConstraint("sell_price >= 0", name="ck_books_sell_price_non_negative"),
        CheckConstraint("quantity >= 0", name="ck_books_quantity_non_negative"),
    )

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    author = Column(String, nullable=False, default="")
    description = Column(Text, nullable=False)
    purchase_price = Column(Numeric(10, 2), nullable=False)
    sell_price = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    sku = Column(String, default="")
    category = Column(String, default="")
    supplier_id = Column(String, ForeignKey("suppliers.id"), default="")
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
    notes = Column(Text, nullable=True)


class Movement(Base):
    __tablename__ = "movements"
    __table_args__ = (
        CheckConstraint("movement_type IN ('IN', 'OUT', 'CORRECTION')", name="ck_movements_type"),
    )

    id = Column(String, primary_key=True)
    book_id = Column(String, ForeignKey("books.id"), nullable=False)
    book_name = Column(String, nullable=False)
    quantity_change = Column(Integer, nullable=False)
    movement_type = Column(String, nullable=False)  # IN, OUT, CORRECTION
    reason = Column(Text, nullable=True)
    timestamp = Column(String, nullable=False)
    performed_by = Column(String, nullable=False, default="system")


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(String, primary_key=True)                   # Lieferanten-ID
    name = Column(String, nullable=False)                   # Firmenname
    contact = Column(String, default="")                    # E-Mail / Telefon
    address = Column(String, default="")                    # Anschrift
    notes = Column(Text, nullable=True)                     # Bemerkungen
    created_at = Column(String, nullable=False)             # Anlegedatum


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    __table_args__ = (
        CheckConstraint("unit_price >= 0", name="ck_purchase_orders_unit_price_non_negative"),
        CheckConstraint("quantity > 0", name="ck_purchase_orders_quantity_positive"),
        CheckConstraint("delivered_quantity >= 0", name="ck_purchase_orders_delivered_non_negative"),
        CheckConstraint("status IN ('offen', 'teilgeliefert', 'geliefert')", name="ck_purchase_orders_status"),
    )

    id = Column(String, primary_key=True)
    supplier_id = Column(String, ForeignKey("suppliers.id"), nullable=False)
    supplier_name = Column(String, nullable=False)
    book_id = Column(String, ForeignKey("books.id"), nullable=False)
    book_name = Column(String, nullable=False)
    book_sku = Column(String, default="")
    unit_price = Column(Numeric(10, 2), nullable=False, default=0)
    quantity = Column(Integer, nullable=False)
    delivered_quantity = Column(Integer, nullable=False, default=0)
    status = Column(String, nullable=False, default="offen")
    created_at = Column(String, nullable=False)
    delivered_at = Column(String, nullable=True)


class IncomingDelivery(Base):
    __tablename__ = "incoming_deliveries"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_incoming_deliveries_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_incoming_deliveries_unit_price_non_negative"),
    )

    id = Column(String, primary_key=True)
    order_id = Column(String, ForeignKey("purchase_orders.id"), nullable=False)
    supplier_id = Column(String, ForeignKey("suppliers.id"), nullable=False)
    supplier_name = Column(String, nullable=False)
    book_id = Column(String, ForeignKey("books.id"), nullable=False)
    book_name = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False, default=0)
    received_at = Column(String, nullable=False)


class BookSupplier(Base):
    __tablename__ = "book_suppliers"
    __table_args__ = (
        UniqueConstraint("book_id", "supplier_id", name="uq_book_suppliers_book_supplier"),
        CheckConstraint("last_purchase_price >= 0", name="ck_book_suppliers_last_price_non_negative"),
    )

    id = Column(String, primary_key=True)
    book_id = Column(String, ForeignKey("books.id"), nullable=False)
    supplier_id = Column(String, ForeignKey("suppliers.id"), nullable=False)
    supplier_sku = Column(String, nullable=False, default="")
    is_primary = Column(Boolean, nullable=False, default=False)
    last_purchase_price = Column(Numeric(10, 2), nullable=False, default=0)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
