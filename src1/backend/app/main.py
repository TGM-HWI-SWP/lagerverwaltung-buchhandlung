from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, Depends, HTTPException                             # FastAPI-Framework
from fastapi.middleware.cors import CORSMiddleware                              # CORS-Middleware
from fastapi.responses import StreamingResponse                                 # Streaming für PDF
from sqlalchemy.orm import Session                                              # DB-Session
from sqlalchemy import func
from sqlalchemy import inspect, text

import io                                                                       # PDF-Buffer
from datetime import datetime                                                   # Zeitstempel im PDF
import matplotlib                                                               # Plot-Library
matplotlib.use("Agg")                                                           # Headless-Backend
import matplotlib.pyplot as plt                                                 # Pyplot-API
from matplotlib.backends.backend_pdf import PdfPages                            # PDF-Export

from app.core.config import settings                                            # App-Konfiguration
from app.db.models import Base                                                  # DB-Modelle
from app.db.models import Book
from app.db.session import engine, get_db                                       # DB-Verbindung
from app.db.schemas import (                                                    # Pydantic-Schemas
    BookSchema,
    MovementSchema,
    SupplierSchema,
    SupplierStockEntry,
    SupplierOrderRequest,
    PurchaseOrderSchema,
    ReceivePurchaseOrderRequest,
    IncomingDeliverySchema,
    BookIncomingDeliveryRequest,
)
from app.api import books, inventory, suppliers                                 # CRUD-Logik


Base.metadata.create_all(bind=engine)                                           # Tabellen erstellen


def _ensure_sqlite_schema():
    if not str(engine.url).startswith("sqlite"):
        return

    with engine.begin() as conn:
        inspector = inspect(conn)
        if "books" not in inspector.get_table_names():
            return

        book_columns = {col["name"] for col in inspector.get_columns("books")}
        if "author" not in book_columns:
            conn.execute(text("ALTER TABLE books ADD COLUMN author VARCHAR DEFAULT '' NOT NULL"))

        table_names = set(inspector.get_table_names())
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


def _ensure_default_supplier_data():
    """Stellt sicher, dass ein Standard-Lieferant inkl. Lagerdaten existiert."""
    supplier_id = "S001"
    supplier_name = "Buchgroßhandel Wien GmbH"
    supplier_contact = "kontakt@bgh-wien.at"
    supplier_address = "Mariahilfer Straße 100, 1060 Wien"
    supplier_notes = "Hauptlieferant für alle Bücher"

    with engine.begin() as conn:
        supplier_exists = conn.execute(
            text("SELECT COUNT(*) FROM suppliers WHERE id = :supplier_id"),
            {"supplier_id": supplier_id},
        ).scalar()

        if not supplier_exists:
            conn.execute(
                text(
                    """
                    INSERT INTO suppliers (id, name, contact, address, notes, created_at)
                    VALUES (:id, :name, :contact, :address, :notes, datetime('now', 'localtime'))
                    """
                ),
                {
                    "id": supplier_id,
                    "name": supplier_name,
                    "contact": supplier_contact,
                    "address": supplier_address,
                    "notes": supplier_notes,
                },
            )

def _seed_database():
    """Fügt Testdaten ein, wenn die Datenbank leer ist."""
    sql_file = Path(__file__).parent / "db" / "buchhadlung.sql"
    if not sql_file.exists():
        return
    with engine.connect() as conn:
        book_count = conn.execute(text("SELECT COUNT(*) FROM books")).scalar()
        if book_count and book_count > 0:
            return
        sql = sql_file.read_text(encoding="utf-8")
        for statement in sql.split(";"):
            stmt = statement.strip()
            if stmt:
                conn.execute(text(stmt))
        conn.commit()


_ensure_sqlite_schema()
_seed_database()
_ensure_default_supplier_data()

app = FastAPI(title=settings.app_name)                                          # App-Instanz

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],                                                                            # Frontend-URLs
    allow_credentials=True,                                                     # Cookies erlauben
    allow_methods=["*"],                                                        # Alle Methoden
    allow_headers=["*"],                                                        # Alle Header
)


@app.get("/")
def root():
    return {
        "message": "Buchhandlungsverwaltung Backend läuft",
        "health": "/health",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok", "app": settings.app_name}


# ── Books ──────────────────────────────────────────────


@app.get("/books", response_model=list[BookSchema])                             # Alle Bücher holen
def read_books(db: Session = Depends(get_db)):
    return books.get_all_books(db)


@app.get("/books/{book_id}", response_model=BookSchema)                         # Buch per ID holen
def read_book(book_id: str, db: Session = Depends(get_db)):
    book = books.get_book(db, book_id)
    if book is None:                                                            # Nicht gefunden
        raise HTTPException(status_code=404, detail="Buch nicht gefunden")
    return book


@app.post("/books", response_model=BookSchema, status_code=201)                 # Buch anlegen
def create_book(book: BookSchema, db: Session = Depends(get_db)):
    try:
        return books.create_book(db, book)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/books/{book_id}", response_model=BookSchema)                         # Buch aktualisieren
def update_book(book_id: str, book: BookSchema, db: Session = Depends(get_db)):
    try:
        updated = books.update_book(db, book_id, book)
        if updated is None:                                                     # Nicht gefunden
            raise HTTPException(status_code=404, detail="Buch nicht gefunden")
        return updated
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/books/{book_id}")                                                 # Buch löschen
def delete_book(book_id: str, db: Session = Depends(get_db)):
    try:
        if not books.delete_book(db, book_id):                                  # Nicht gefunden
            raise HTTPException(status_code=404, detail="Buch nicht gefunden")
        return {"detail": "Buch gelöscht"}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ── Movements ──────────────────────────────────────────


@app.get("/movements", response_model=list[MovementSchema])                     # Alle Bewegungen holen
def read_movements(db: Session = Depends(get_db)):
    return inventory.get_all_movements(db)


@app.get("/movements/{movement_id}", response_model=MovementSchema)             # Bewegung per ID holen
def read_movement(movement_id: str, db: Session = Depends(get_db)):
    movement = inventory.get_movement(db, movement_id)
    if movement is None:                                                        # Nicht gefunden
        raise HTTPException(status_code=404, detail="Bewegung nicht gefunden")
    return movement


@app.post("/movements", response_model=MovementSchema, status_code=201)         # Bewegung anlegen
def create_movement(movement: MovementSchema, db: Session = Depends(get_db)):
    try:
        return inventory.create_movement(db, movement)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/movements/{movement_id}", response_model=MovementSchema)             # Bewegung aktualisieren
def update_movement(movement_id: str, movement: MovementSchema, db: Session = Depends(get_db)):
    try:
        updated = inventory.update_movement(db, movement_id, movement)
        if updated is None:                                                     # Nicht gefunden
            raise HTTPException(status_code=404, detail="Bewegung nicht gefunden")
        return updated
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/movements/{movement_id}")                                         # Bewegung löschen
def delete_movement(movement_id: str, db: Session = Depends(get_db)):
    if not inventory.delete_movement(db, movement_id):                          # Nicht gefunden
        raise HTTPException(status_code=404, detail="Bewegung nicht gefunden")
    return {"detail": "Bewegung gelöscht"}


# ── Inventory ──────────────────────────────────────────


@app.get("/inventory")                                                          # Lager-Übersicht
def inventory_summary(db: Session = Depends(get_db)):
    total_titles = db.query(func.count(Book.id)).scalar() or 0
    total_units = db.query(func.coalesce(func.sum(Book.quantity), 0)).scalar() or 0
    low_stock = db.query(Book).filter(Book.quantity <= 5).order_by(Book.quantity.asc()).all()
    return {
        "total_titles": total_titles,
        "total_units": int(total_units),
        "low_stock_books": [BookSchema.model_validate(book).model_dump() for book in low_stock],
    }


# ── Reports ────────────────────────────────────────────


@app.get("/reports/inventory-pdf")                                              # PDF-Report
def inventory_pdf(db: Session = Depends(get_db)):
    rows = (                                                                    # Bestand pro Kategorie
        db.query(Book.category, func.coalesce(func.sum(Book.quantity), 0))
        .group_by(Book.category)
        .all()
    )
    data = [(cat or "Ohne Kategorie", int(qty)) for cat, qty in rows if int(qty) > 0]
    if not data:                                                                # Leerer Bestand
        data = [("Keine Daten", 1)]

    labels = [d[0] for d in data]
    sizes = [d[1] for d in data]

    buffer = io.BytesIO()
    with PdfPages(buffer) as pdf:
        fig, ax = plt.subplots(figsize=(8.27, 11.69))                           # A4-Hochformat
        ax.pie(sizes, labels=labels, autopct="%1.1f%%", startangle=90)
        ax.axis("equal")
        timestamp = datetime.now().strftime("%d.%m.%Y %H:%M")
        fig.suptitle(f"Lagerbestand nach Kategorien\nStand: {timestamp}", fontsize=14)
        pdf.savefig(fig)
        plt.close(fig)

    buffer.seek(0)
    headers = {"Content-Disposition": 'attachment; filename="lagerbestand.pdf"'}
    return StreamingResponse(buffer, media_type="application/pdf", headers=headers)


# ── Suppliers ──────────────────────────────────────────


@app.get("/suppliers", response_model=list[SupplierSchema])                     # Alle Lieferanten
def read_suppliers(db: Session = Depends(get_db)):
    return suppliers.get_all_suppliers(db)


@app.get("/suppliers/{supplier_id}", response_model=SupplierSchema)             # Lieferant per ID
def read_supplier(supplier_id: str, db: Session = Depends(get_db)):
    supplier = suppliers.get_supplier(db, supplier_id)
    if supplier is None:                                                        # Nicht gefunden
        raise HTTPException(status_code=404, detail="Lieferant nicht gefunden")
    return supplier


@app.post("/suppliers", response_model=SupplierSchema, status_code=201)         # Lieferant anlegen
def create_supplier(supplier: SupplierSchema, db: Session = Depends(get_db)):
    return suppliers.create_supplier(db, supplier)


@app.get("/suppliers/{supplier_id}/stock", response_model=list[SupplierStockEntry])  # Lager des Lieferanten
def read_supplier_stock(supplier_id: str, db: Session = Depends(get_db)):
    if suppliers.get_supplier(db, supplier_id) is None:                         # Existenz pruefen
        raise HTTPException(status_code=404, detail="Lieferant nicht gefunden")
    return suppliers.get_supplier_stock(db, supplier_id)


@app.post("/suppliers/{supplier_id}/order", response_model=MovementSchema, status_code=201)  # Bestellen
def order_from_supplier(
    supplier_id: str,
    order: SupplierOrderRequest,
    db: Session = Depends(get_db),
):
    try:
        return suppliers.order_from_supplier(
            db,
            supplier_id=supplier_id,
            book_id=order.book_id,
            quantity=order.quantity,
            performed_by=order.performed_by,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/purchase-orders", response_model=list[PurchaseOrderSchema])
def read_purchase_orders(db: Session = Depends(get_db)):
    return suppliers.get_all_purchase_orders(db)


@app.post("/purchase-orders", response_model=PurchaseOrderSchema, status_code=201)
def create_purchase_order(order: PurchaseOrderSchema, db: Session = Depends(get_db)):
    try:
        return suppliers.create_purchase_order(db, order)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/purchase-orders/{order_id}/receive", response_model=IncomingDeliverySchema, status_code=201)
def receive_purchase_order(
    order_id: str,
    payload: ReceivePurchaseOrderRequest,
    db: Session = Depends(get_db),
):
    try:
        return suppliers.receive_purchase_order(db, order_id, payload.quantity)
    except ValueError as exc:
        detail = str(exc)
        status = 404 if "nicht gefunden" in detail else 400
        raise HTTPException(status_code=status, detail=detail) from exc


@app.delete("/purchase-orders/{order_id}", status_code=204)
def delete_purchase_order(order_id: str, db: Session = Depends(get_db)):
    try:
        suppliers.delete_purchase_order(db, order_id)
    except ValueError as exc:
        detail = str(exc)
        status = 404 if "nicht gefunden" in detail else 400
        raise HTTPException(status_code=status, detail=detail) from exc


@app.get("/incoming-deliveries", response_model=list[IncomingDeliverySchema])
def read_incoming_deliveries(db: Session = Depends(get_db)):
    return suppliers.get_all_incoming_deliveries(db)


@app.post("/incoming-deliveries/{delivery_id}/book", response_model=MovementSchema, status_code=201)
def book_incoming_delivery(
    delivery_id: str,
    payload: BookIncomingDeliveryRequest,
    db: Session = Depends(get_db),
):
    try:
        return suppliers.book_incoming_delivery(db, delivery_id, payload.performed_by)
    except ValueError as exc:
        detail = str(exc)
        status = 404 if "nicht gefunden" in detail else 400
        raise HTTPException(status_code=status, detail=detail) from exc
