from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy.orm import Session

from app.db.models import Supplier, SupplierStock, Book, Movement


def get_all_suppliers(db: Session) -> list[Supplier]:
    """Alle Lieferanten abrufen."""
    return db.query(Supplier).order_by(Supplier.name.asc()).all()


def get_supplier(db: Session, supplier_id: str) -> Supplier | None:
    """Einen Lieferanten per ID abrufen."""
    return db.query(Supplier).filter(Supplier.id == supplier_id).first()


def get_supplier_stock(db: Session, supplier_id: str) -> list[dict]:
    """Lager des Lieferanten abrufen (Buecher mit Stueckzahl und Preis)."""
    rows = (
        db.query(SupplierStock, Book)
        .join(Book, Book.id == SupplierStock.book_id)
        .filter(SupplierStock.supplier_id == supplier_id)
        .order_by(Book.name.asc())
        .all()
    )
    return [
        {
            "book_id": stock.book_id,
            "book_name": book.name,
            "quantity": int(stock.quantity),
            "price": float(stock.price),
        }
        for stock, book in rows
    ]


def order_from_supplier(
    db: Session,
    supplier_id: str,
    book_id: str,
    quantity: int,
    performed_by: str = "system",
) -> Movement:
    """Bestellt Buecher beim Lieferanten und legt einen IN-Movement an."""
    if quantity <= 0:
        raise ValueError("Menge muss groesser als 0 sein")

    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if supplier is None:
        raise ValueError("Lieferant nicht gefunden")

    stock = (
        db.query(SupplierStock)
        .filter(SupplierStock.supplier_id == supplier_id, SupplierStock.book_id == book_id)
        .first()
    )
    if stock is None:
        raise ValueError("Buch ist beim Lieferanten nicht gelistet")
    if stock.quantity < quantity:
        raise ValueError(f"Lieferant hat nur {stock.quantity} Stueck verfuegbar")

    book = db.query(Book).filter(Book.id == book_id).first()
    if book is None:
        raise ValueError("Buch nicht gefunden")

    stock.quantity = int(stock.quantity) - quantity                             # Lieferantenlager reduzieren
    book.quantity = int(book.quantity) + quantity                               # Eigenes Lager erhoehen

    now = datetime.now(timezone.utc).isoformat()
    movement = Movement(
        id=str(uuid4()),
        book_id=book.id,
        book_name=book.name,
        quantity_change=quantity,
        movement_type="IN",
        reason=f"Bestellung von {supplier.name}",
        timestamp=now,
        performed_by=performed_by,
    )
    db.add(movement)

    book.updated_at = now                                                       # Aktualisierungszeit
    db.commit()
    db.refresh(movement)
    return movement
