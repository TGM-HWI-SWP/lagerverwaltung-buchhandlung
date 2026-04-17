from fastapi import FastAPI, Depends, HTTPException                             # FastAPI-Framework
from fastapi.middleware.cors import CORSMiddleware                              # CORS-Middleware
from sqlalchemy.orm import Session                                              # DB-Session

from app.core.config import settings                                            # App-Konfiguration
from app.db.models import Base                                                  # DB-Modelle
from app.db.session import engine, get_db                                       # DB-Verbindung
from app.db.schemas import (                                                    # Pydantic-Schemas
    BookSchema,
    MovementSchema,
    SupplierSchema,
    SupplierStockEntry,
    SupplierOrderRequest,
)
from app.api import books, inventory, suppliers                                 # CRUD-Logik


Base.metadata.create_all(bind=engine)                                           # Tabellen erstellen

app = FastAPI(title=settings.app_name)                                          # App-Instanz

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],            # Frontend-URLs
    allow_credentials=True,                                                     # Cookies erlauben
    allow_methods=["*"],                                                        # Alle Methoden
    allow_headers=["*"],                                                        # Alle Header
)


# ── Books ──────────────────────────────────────────────


@app.get("/books", response_model=list[BookSchema])                             # Alle Buecher holen
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
    return books.create_book(db, book)


@app.put("/books/{book_id}", response_model=BookSchema)                         # Buch aktualisieren
def update_book(book_id: str, book: BookSchema, db: Session = Depends(get_db)):
    updated = books.update_book(db, book_id, book)
    if updated is None:                                                         # Nicht gefunden
        raise HTTPException(status_code=404, detail="Buch nicht gefunden")
    return updated


@app.delete("/books/{book_id}")                                                 # Buch loeschen
def delete_book(book_id: str, db: Session = Depends(get_db)):
    if not books.delete_book(db, book_id):                                      # Nicht gefunden
        raise HTTPException(status_code=404, detail="Buch nicht gefunden")
    return {"detail": "Buch gelöscht"}


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
    return inventory.create_movement(db, movement)


@app.put("/movements/{movement_id}", response_model=MovementSchema)             # Bewegung aktualisieren
def update_movement(movement_id: str, movement: MovementSchema, db: Session = Depends(get_db)):
    updated = inventory.update_movement(db, movement_id, movement)
    if updated is None:                                                         # Nicht gefunden
        raise HTTPException(status_code=404, detail="Bewegung nicht gefunden")
    return updated


@app.delete("/movements/{movement_id}")                                         # Bewegung loeschen
def delete_movement(movement_id: str, db: Session = Depends(get_db)):
    if not inventory.delete_movement(db, movement_id):                          # Nicht gefunden
        raise HTTPException(status_code=404, detail="Bewegung nicht gefunden")
    return {"detail": "Bewegung gelöscht"}


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
