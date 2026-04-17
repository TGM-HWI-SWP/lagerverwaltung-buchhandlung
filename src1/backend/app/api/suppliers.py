from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.adapters.sqlalchemy_repositories import next_movement_id
from app.db.models import Supplier, Book, Movement


def get_all_suppliers(db: Session) -> list[Supplier]:
    """Alle Lieferanten abrufen."""
    return db.query(Supplier).order_by(Supplier.name.asc()).all()


def get_supplier(db: Session, supplier_id: str) -> Supplier | None:
    """Einen Lieferanten per ID abrufen."""
    return db.query(Supplier).filter(Supplier.id == supplier_id).first()


def get_supplier_stock(db: Session, supplier_id: str) -> list[dict]:
    """Buecher des Lieferanten mit Einkaufspreis zurueckgeben."""
    books = (
        db.query(Book)
        .filter(Book.supplier_id == supplier_id)
        .order_by(Book.name.asc())
        .all()
    )
    return [
        {
            "book_id": book.id,
            "book_name": book.name,
            "quantity": int(book.quantity),
            "price": float(book.purchase_price),
        }
        for book in books
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

    book = db.query(Book).filter(Book.id == book_id).first()
    if book is None:
        raise ValueError("Buch nicht gefunden")
    if book.supplier_id != supplier_id:
        raise ValueError("Buch ist bei diesem Lieferanten nicht gelistet")

    book.quantity = int(book.quantity) + quantity

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    movement = Movement(
        id=next_movement_id(db),
        book_id=book.id,
        book_name=book.name,
        quantity_change=quantity,
        movement_type="IN",
        reason=f"Bestellung von {supplier.name}",
        timestamp=now,
        performed_by=performed_by,
    )
    db.add(movement)

    book.updated_at = now
    db.commit()
    db.refresh(movement)
    return movement
