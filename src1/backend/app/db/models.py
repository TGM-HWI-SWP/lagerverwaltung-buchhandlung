from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Book(Base):
    __tablename__ = "books"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    author = Column(String, nullable=False, default="")
    description = Column(Text, nullable=False)
    purchase_price = Column(Float, nullable=False)
    sell_price = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    sku = Column(String, default="")
    category = Column(String, default="")
    supplier_id = Column(String, ForeignKey("suppliers.id"), default="")
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
    notes = Column(Text, nullable=True)


class Movement(Base):
    __tablename__ = "movements"

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


class SupplierStock(Base):
    __tablename__ = "supplier_stock"

    supplier_id = Column(String, ForeignKey("suppliers.id"), primary_key=True)  # Lieferant
    book_id = Column(String, ForeignKey("books.id"), primary_key=True)          # Buch
    quantity = Column(Integer, nullable=False, default=0)                       # Lager beim Lieferanten
    price = Column(Float, nullable=False, default=0.0)                          # Einkaufspreis pro Stueck
