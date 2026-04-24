from sqlalchemy import Boolean, CheckConstraint, Column, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import declarative_base

# SQLAlchemy-ORM-Tabellen an der DB-Kante.
# NICHT die Pydantic-Schemas (db/schemas.py) und NICHT die Domain-Dataclasses (domain/models.py).
# Aenderungen hier MUESSEN ggf. auch in main.py _ensure_sqlite_schema() nachgezogen werden.

Base = declarative_base()                                                       # gemeinsame Basisklasse, alle Tabellen erben davon


class Book(Base):
    """Buch-Stammdatensatz mit aktuellem Lagerbestand."""

    __tablename__ = "books"
    __table_args__ = (                                                          # DB-seitige Invarianten - doppelte Sicherung zu den Pydantic-Checks
        CheckConstraint("purchase_price >= 0", name="ck_books_purchase_price_non_negative"),
        CheckConstraint("sell_price >= 0", name="ck_books_sell_price_non_negative"),
        CheckConstraint("quantity >= 0", name="ck_books_quantity_non_negative"),
    )

    id = Column(String, primary_key=True)                                       # String-ID (UUID/SKU-aehnlich), keine Auto-Increment-Zahl
    name = Column(String, nullable=False)
    author = Column(String, nullable=False, default="")                         # in alten DBs fehlt die Spalte - wird in main.py nachgeruestet
    description = Column(Text, nullable=False)                                  # Text vs String: Text = unbegrenzte Laenge
    purchase_price = Column(Numeric(10, 2), nullable=False)                     # Numeric(10,2) fuer Geld - 2 Nachkommastellen exakt (keine Floats!)
    sell_price = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    sku = Column(String, default="")                                            # leer erlaubt - partieller Unique-Index in main.py
    category = Column(String, default="")
    supplier_id = Column(String, ForeignKey("suppliers.id"), default="")        # Primaer-Lieferant - Detail-Links liegen in BookSupplier
    created_at = Column(String, nullable=False)                                 # ISO-String statt DateTime - schwaecher typisiert, aber einfach
    updated_at = Column(String, nullable=False)
    notes = Column(Text, nullable=True)


class Movement(Base):
    """Append-only-Protokoll aller Lagerbewegungen (IN/OUT/CORRECTION)."""

    __tablename__ = "movements"
    __table_args__ = (
        CheckConstraint("movement_type IN ('IN', 'OUT', 'CORRECTION')", name="ck_movements_type"),  # Enum-Ersatz per CHECK
    )

    id = Column(String, primary_key=True)                                       # M001/M002/... vom Service vergeben
    book_id = Column(String, ForeignKey("books.id"), nullable=False)
    book_name = Column(String, nullable=False)                                  # Snapshot - bleibt auch wenn das Buch umbenannt/geloescht wird
    quantity_change = Column(Integer, nullable=False)                           # Vorzeichen = Richtung: OUT negativ, IN positiv
    movement_type = Column(String, nullable=False)  # IN, OUT, CORRECTION
    reason = Column(Text, nullable=True)
    timestamp = Column(String, nullable=False)
    performed_by = Column(String, nullable=False, default="system")


class Supplier(Base):
    """Lieferanten-Stammdatensatz."""

    __tablename__ = "suppliers"

    id = Column(String, primary_key=True)                   # Lieferanten-ID, Service vergibt S001/S002/...
    name = Column(String, nullable=False)                   # Firmenname
    contact = Column(String, default="")                    # E-Mail / Telefon
    address = Column(String, default="")                    # Anschrift
    notes = Column(Text, nullable=True)                     # Bemerkungen
    created_at = Column(String, nullable=False)             # Anlegedatum


class PurchaseOrder(Base):
    """Bestellung eines Buchs bei einem Lieferanten - laeuft ueber offen/teilgeliefert/geliefert."""

    __tablename__ = "purchase_orders"
    __table_args__ = (
        CheckConstraint("unit_price >= 0", name="ck_purchase_orders_unit_price_non_negative"),
        CheckConstraint("quantity > 0", name="ck_purchase_orders_quantity_positive"),             # Null-Bestellungen verbieten
        CheckConstraint("delivered_quantity >= 0", name="ck_purchase_orders_delivered_non_negative"),
        CheckConstraint("status IN ('offen', 'teilgeliefert', 'geliefert')", name="ck_purchase_orders_status"),  # Enum-Ersatz
    )

    id = Column(String, primary_key=True)
    supplier_id = Column(String, ForeignKey("suppliers.id"), nullable=False)
    supplier_name = Column(String, nullable=False)                              # Snapshot zum Bestell-Zeitpunkt
    book_id = Column(String, ForeignKey("books.id"), nullable=False)
    book_name = Column(String, nullable=False)                                  # Snapshot zum Bestell-Zeitpunkt
    book_sku = Column(String, default="")
    unit_price = Column(Numeric(10, 2), nullable=False, default=0)
    quantity = Column(Integer, nullable=False)
    delivered_quantity = Column(Integer, nullable=False, default=0)             # Service haelt das konsistent mit IncomingDelivery
    status = Column(String, nullable=False, default="offen")
    created_at = Column(String, nullable=False)
    delivered_at = Column(String, nullable=True)                                # null bis zur ersten Lieferung


class IncomingDelivery(Base):
    """Gemeldeter Wareneingang - lebt nur bis zur Verbuchung, dann geloescht."""

    __tablename__ = "incoming_deliveries"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_incoming_deliveries_quantity_positive"),
        CheckConstraint("unit_price >= 0", name="ck_incoming_deliveries_unit_price_non_negative"),
    )

    id = Column(String, primary_key=True)                                       # IN-XXXX-Prefix vom Service
    order_id = Column(String, ForeignKey("purchase_orders.id"), nullable=False)
    supplier_id = Column(String, ForeignKey("suppliers.id"), nullable=False)
    supplier_name = Column(String, nullable=False)
    book_id = Column(String, ForeignKey("books.id"), nullable=False)
    book_name = Column(String, nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False, default=0)
    received_at = Column(String, nullable=False)


class BookSupplier(Base):
    """N:M-Link Buch <-> Lieferant mit letztem Einkaufspreis pro Kombination."""

    __tablename__ = "book_suppliers"
    __table_args__ = (
        UniqueConstraint("book_id", "supplier_id", name="uq_book_suppliers_book_supplier"),      # pro Paar nur ein Link
        CheckConstraint("last_purchase_price >= 0", name="ck_book_suppliers_last_price_non_negative"),
    )

    id = Column(String, primary_key=True)                                       # UUID
    book_id = Column(String, ForeignKey("books.id"), nullable=False)
    supplier_id = Column(String, ForeignKey("suppliers.id"), nullable=False)
    supplier_sku = Column(String, nullable=False, default="")                   # Lieferant-eigene Artikelnummer (kann von books.sku abweichen)
    is_primary = Column(Boolean, nullable=False, default=False)                 # genau ein Link pro Buch sollte is_primary=True sein
    last_purchase_price = Column(Numeric(10, 2), nullable=False, default=0)     # wird bei jedem Wareneingang aktualisiert
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
