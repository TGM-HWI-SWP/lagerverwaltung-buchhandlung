from uuid import uuid4

from fastapi import FastAPI, Depends, HTTPException                             # FastAPI-Framework
from fastapi.middleware.cors import CORSMiddleware                              # CORS-Middleware
from fastapi.responses import JSONResponse, StreamingResponse                   # Streaming für PDF
from sqlalchemy.orm import Session                                              # DB-Session
from sqlalchemy import func

import io                                                                       # PDF-Buffer
from datetime import datetime                                                   # Zeitstempel im PDF
import matplotlib                                                               # Plot-Library
matplotlib.use("Agg")                                                           # Headless-Backend
import matplotlib.pyplot as plt                                                 # Pyplot-API
from matplotlib.backends.backend_pdf import PdfPages                            # PDF-Export

from app.core.config import settings                                            # App-Konfiguration
from app.core.bootstrap import get_database_health, initialize_application
from app.core.errors import install_error_handlers
from app.db.models import Book
from app.db.models_auth import StaffUser
from app.db.session import get_db                                               # DB-Verbindung
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
from app.api import books, inventory, suppliers, activity, auth as auth_api
from app.core.auth_staff import hash_password, hash_pin, require_admin, require_user
from app.db.schemas_auth import (
    AdminLoginRequest,
    BootstrapAdminRequest,
    BootstrapStatusResponse,
    CashierPinLoginRequest,
    LoginResponse,
    StaffUserCreateRequest,
    StaffUserSummary,
    StaffUserUpdateRequest,
    WhoAmIResponse,
)


def _staff_summary(row: StaffUser) -> StaffUserSummary:
    return StaffUserSummary(
        id=row.id,
        username=row.username,
        display_name=row.display_name,
        role=row.role,
        avatar_image=row.avatar_image or "",
    )


def _list_staff_users(db: Session, *, role: str | None = None) -> list[StaffUserSummary]:
    query = db.query(StaffUser).filter(StaffUser.is_active == True)  # noqa: E712
    if role is not None:
        query = query.filter(StaffUser.role == role)
    rows = query.order_by(StaffUser.role.desc(), StaffUser.display_name.asc()).all()
    return [_staff_summary(row) for row in rows]


def _clamp_pagination(offset: int, limit: int, *, max_limit: int = 100) -> tuple[int, int]:
    offset = max(0, int(offset))
    limit = max(1, int(limit))
    limit = min(limit, max_limit)
    return offset, limit

app = FastAPI(title=settings.app_name)                                          # App-Instanz

install_error_handlers(app)

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


@app.on_event("startup")
def startup() -> None:
    initialize_application()


@app.get("/")
def root():
    return {
        "message": "Buchhandlungsverwaltung Backend läuft",
        "health": "/health",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    database = get_database_health()
    payload = {
        "status": "ok" if database["ok"] else "degraded",
        "app": settings.app_name,
        "database": database,
    }
    if database["ok"]:
        return payload
    return JSONResponse(status_code=503, content=payload)


@app.post("/auth/admin-login", response_model=LoginResponse)
def auth_admin_login(payload: AdminLoginRequest, db: Session = Depends(get_db)):
    return auth_api.admin_login(db, payload)


@app.get("/auth/bootstrap-status", response_model=BootstrapStatusResponse)
def auth_bootstrap_status(db: Session = Depends(get_db)):
    admin_count = db.query(StaffUser).filter(StaffUser.role == "admin", StaffUser.is_active == True).count()  # noqa: E712
    return BootstrapStatusResponse(setup_required=admin_count == 0)


@app.post("/auth/bootstrap-admin", response_model=StaffUserSummary, status_code=201)
def auth_bootstrap_admin(payload: BootstrapAdminRequest, db: Session = Depends(get_db)):
    admin_count = db.query(StaffUser).filter(StaffUser.role == "admin", StaffUser.is_active == True).count()  # noqa: E712
    if admin_count > 0:
        raise HTTPException(status_code=409, detail="Admin ist bereits eingerichtet")

    username = payload.username.strip().lower()
    existing = db.query(StaffUser).filter(StaffUser.username == username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Benutzername bereits vergeben")

    created = StaffUser(
        id=f"U{uuid4().hex[:8].upper()}",
        username=username,
        display_name=payload.display_name.strip(),
        role="admin",
        pin_hash=hash_pin(payload.pin),
        password_hash=hash_password(payload.password),
        avatar_image=payload.avatar_image,
        is_active=True,
    )
    db.add(created)
    db.commit()
    db.refresh(created)
    return StaffUserSummary(
        id=created.id,
        username=created.username,
        display_name=created.display_name,
        role=created.role,
        avatar_image=created.avatar_image or "",
    )


@app.post("/auth/cashier-login", response_model=LoginResponse)
def auth_cashier_login(payload: CashierPinLoginRequest, db: Session = Depends(get_db)):
    return auth_api.cashier_pin_login(db, payload)


@app.get("/auth/me", response_model=WhoAmIResponse)
def auth_me(user=Depends(require_user)):
    return auth_api.whoami(user)


@app.get("/staff-users", response_model=list[StaffUserSummary])
def read_staff_users(
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    return _list_staff_users(db)


@app.get("/staff-users/cashier-list", response_model=list[StaffUserSummary])
def read_cashier_list(db: Session = Depends(get_db)):
    return _list_staff_users(db)


@app.get("/staff-users/admin-list", response_model=list[StaffUserSummary])
def read_admin_list(db: Session = Depends(get_db)):
    return _list_staff_users(db, role="admin")


@app.post("/staff-users", response_model=StaffUserSummary, status_code=201)
def create_staff_user(
    payload: StaffUserCreateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    username = payload.username.strip().lower()
    display_name = payload.display_name.strip()
    role = payload.role.strip().lower() if payload.role else "cashier"
    if role not in {"cashier", "admin"}:
        raise HTTPException(status_code=400, detail="Ungültige Rolle")
    if role == "admin" and len(payload.password.strip()) < 12:
        raise HTTPException(status_code=400, detail="Admin-Passwort muss mindestens 12 Zeichen haben")

    existing = db.query(StaffUser).filter(StaffUser.username == username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Benutzername bereits vergeben")

    created = StaffUser(
        id=f"U{uuid4().hex[:8].upper()}",
        username=username,
        display_name=display_name,
        role=role,
        pin_hash=hash_pin(payload.pin),
        password_hash=hash_password(payload.password) if role == "admin" else "",
        avatar_image=payload.avatar_image,
        is_active=True,
    )
    db.add(created)
    db.commit()
    db.refresh(created)
    return StaffUserSummary(
        id=created.id,
        username=created.username,
        display_name=created.display_name,
        role=created.role,
        avatar_image=created.avatar_image or "",
    )


@app.put("/staff-users/{user_id}", response_model=StaffUserSummary)
def update_staff_user(
    user_id: str,
    payload: StaffUserUpdateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    staff_user = db.query(StaffUser).filter(StaffUser.id == user_id).first()
    if not staff_user:
        raise HTTPException(status_code=404, detail="Mitarbeiter nicht gefunden")
    
    updates = {}
    if payload.display_name is not None:
        updates["display_name"] = payload.display_name.strip()
    if payload.pin is not None:
        updates["pin_hash"] = hash_pin(payload.pin)
    if payload.role is not None:
        role = payload.role.strip().lower()
        if role not in {"cashier", "admin"}:
            raise HTTPException(status_code=400, detail="Ungültige Rolle")
        updates["role"] = role
        if role == "admin" and not staff_user.password_hash:
            # Wenn Admin wird, aber kein Passwort hat, muss eins gesetzt werden
            raise HTTPException(
                status_code=400, 
                detail="Admin benötigt ein Passwort. Bitte setzen Sie ein Passwort mit dem Passwort-Feld."
            )
    if payload.password is not None:
        if payload.password.strip() and len(payload.password.strip()) >= 12:
            updates["password_hash"] = hash_password(payload.password)
        elif payload.password.strip() == "":
            updates["password_hash"] = ""
        else:
            raise HTTPException(status_code=400, detail="Admin-Passwort muss mindestens 12 Zeichen haben")
    if payload.avatar_image is not None:
        updates["avatar_image"] = payload.avatar_image
    if payload.is_active is not None:
        updates["is_active"] = payload.is_active
    
    for key, value in updates.items():
        setattr(staff_user, key, value)
    
    db.commit()
    db.refresh(staff_user)
    
    return _staff_summary(staff_user)


@app.delete("/staff-users/{user_id}")
def delete_staff_user(
    user_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    staff_user = db.query(StaffUser).filter(StaffUser.id == user_id).first()
    if not staff_user:
        raise HTTPException(status_code=404, detail="Mitarbeiter nicht gefunden")
    
    # Soft delete: is_active auf False setzen
    staff_user.is_active = False
    db.commit()
    
    return {"detail": "Mitarbeiter deaktiviert"}


# ── Test Data ──────────────────────────────────────────────


@app.post("/test-data/seed", status_code=201)
def seed_test_data(
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    """Lädt Demo-Daten für alle Bereiche (Bücher, Lager, Verkäufe, Lieferanten, Staff-User)."""
    try:
        from app.services.test_data import seed_all_test_data
        result = seed_all_test_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler beim Laden der Demo-Daten: {str(e)}")


@app.delete("/test-data/clear")
def clear_test_data(
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    """Löscht nur Demo-Daten (markierte Test-Einträge)."""
    try:
        from app.services.test_data import clear_all_test_data
        result = clear_all_test_data(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fehler beim Löschen der Demo-Daten: {str(e)}")


# ── Books ──────────────────────────────────────────────


@app.get("/books", response_model=list[BookSchema])  # Alle Bücher holen
def read_books(
    db: Session = Depends(get_db),
    offset: int = 0,
    limit: int = 50,
):
    offset, limit = _clamp_pagination(offset, limit)
    return books.get_all_books(db, offset=offset, limit=limit)


@app.get("/books/{book_id}", response_model=BookSchema)                         # Buch per ID holen
def read_book(book_id: str, db: Session = Depends(get_db)):
    book = books.get_book(db, book_id)
    if book is None:                                                            # Nicht gefunden
        raise HTTPException(status_code=404, detail="Buch nicht gefunden")
    return book


@app.post("/books", response_model=BookSchema, status_code=201)  # Buch anlegen
def create_book(
    book: BookSchema,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    try:
        return books.create_book(db, book)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/books/{book_id}", response_model=BookSchema)  # Buch aktualisieren
def update_book(
    book_id: str,
    book: BookSchema,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    try:
        updated = books.update_book(db, book_id, book)
        if updated is None:  # Nicht gefunden
            raise HTTPException(status_code=404, detail="Buch nicht gefunden")
        return updated
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/books/{book_id}")  # Buch löschen
def delete_book(
    book_id: str,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    try:
        if not books.delete_book(db, book_id):
            raise HTTPException(status_code=404, detail="Buch nicht gefunden")
        return {"detail": "Buch gelöscht"}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ── Movements ──────────────────────────────────────────


@app.get("/movements", response_model=list[MovementSchema])  # Alle Bewegungen holen
def read_movements(
    db: Session = Depends(get_db),
    offset: int = 0,
    limit: int = 50,
):
    offset, limit = _clamp_pagination(offset, limit)
    return inventory.get_all_movements(db, offset=offset, limit=limit)


@app.get("/movements/{movement_id}", response_model=MovementSchema)             # Bewegung per ID holen
def read_movement(movement_id: str, db: Session = Depends(get_db)):
    movement = inventory.get_movement(db, movement_id)
    if movement is None:                                                        # Nicht gefunden
        raise HTTPException(status_code=404, detail="Bewegung nicht gefunden")
    return movement


@app.post("/movements", response_model=MovementSchema, status_code=201)  # Bewegung anlegen
def create_movement(
    movement: MovementSchema,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    try:
        # Ensure movements are attributed to the logged-in staff user.
        movement = movement.model_copy(update={"performed_by": user.username})
        return inventory.create_movement(db, movement)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/movements/{movement_id}", status_code=409)  # Bewegung aktualisieren
def update_movement(
    movement_id: str,
    movement: MovementSchema,
    user=Depends(require_admin),
):
    raise HTTPException(
        status_code=409,
        detail="Lagerbewegungen sind unveränderlich. Bitte eine neue CORRECTION-Bewegung anlegen.",
    )


@app.delete("/movements/{movement_id}", status_code=409)  # Bewegung löschen
def delete_movement(
    movement_id: str,
    user=Depends(require_admin),
):
    raise HTTPException(
        status_code=409,
        detail="Lagerbewegungen sind unveränderlich und können nicht gelöscht werden.",
    )


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


@app.get("/suppliers", response_model=list[SupplierSchema])  # Alle Lieferanten
def read_suppliers(
    db: Session = Depends(get_db),
    offset: int = 0,
    limit: int = 50,
):
    offset, limit = _clamp_pagination(offset, limit)
    return suppliers.get_all_suppliers(db, offset=offset, limit=limit)


@app.get("/suppliers/{supplier_id}", response_model=SupplierSchema)  # Lieferant per ID
def read_supplier(supplier_id: str, db: Session = Depends(get_db)):
    supplier = suppliers.get_supplier(db, supplier_id)
    if supplier is None:
        raise HTTPException(status_code=404, detail="Lieferant nicht gefunden")
    return supplier


@app.get("/suppliers/{supplier_id}/stock", response_model=list[SupplierStockEntry])  # Lager des Lieferanten
def read_supplier_stock(supplier_id: str, db: Session = Depends(get_db)):
    if suppliers.get_supplier(db, supplier_id) is None:
        raise HTTPException(status_code=404, detail="Lieferant nicht gefunden")
    return suppliers.get_supplier_stock(db, supplier_id)


@app.post("/suppliers/{supplier_id}/order", response_model=MovementSchema, status_code=201)  # Bestellen
def order_from_supplier(
    supplier_id: str,
    order: SupplierOrderRequest,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    try:
        order = order.model_copy(update={"performed_by": user.username})
        return suppliers.order_from_supplier(
            db,
            supplier_id=supplier_id,
            book_id=order.book_id,
            quantity=order.quantity,
            performed_by=order.performed_by,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/suppliers", response_model=SupplierSchema, status_code=201)  # Lieferant anlegen
def create_supplier(
    supplier: SupplierSchema,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    return suppliers.create_supplier(db, supplier)


@app.get("/purchase-orders", response_model=list[PurchaseOrderSchema])
def read_purchase_orders(
    db: Session = Depends(get_db),
    offset: int = 0,
    limit: int = 50,
):
    offset, limit = _clamp_pagination(offset, limit)
    return suppliers.get_all_purchase_orders(db, offset=offset, limit=limit)


@app.post("/purchase-orders", response_model=PurchaseOrderSchema, status_code=201)
def create_purchase_order(
    order: PurchaseOrderSchema,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    try:
        return suppliers.create_purchase_order(db, order)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/purchase-orders/{order_id}/receive", response_model=IncomingDeliverySchema)
def receive_purchase_order(
    order_id: str,
    payload: ReceivePurchaseOrderRequest,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    try:
        return suppliers.receive_purchase_order(db, order_id, payload.quantity)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/incoming-deliveries", response_model=list[IncomingDeliverySchema])
def read_incoming_deliveries(
    db: Session = Depends(get_db),
    offset: int = 0,
    limit: int = 50,
):
    offset, limit = _clamp_pagination(offset, limit)
    return suppliers.get_all_incoming_deliveries(db, offset=offset, limit=limit)


@app.post("/incoming-deliveries/{delivery_id}/book", response_model=MovementSchema, status_code=201)
def book_incoming_delivery(
    delivery_id: str,
    payload: BookIncomingDeliveryRequest,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    try:
        return suppliers.book_incoming_delivery(db, delivery_id, performed_by=user.username)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ── Activity Logs ───────────────────────────────────────


@app.get("/activity-logs")
def read_activity_logs(
    db: Session = Depends(get_db),
    offset: int = 0,
    limit: int = 50,
    entity_type: str | None = None,
    entity_id: str | None = None,
    performed_by: str | None = None,
):
    """Audit log entries with optional filtering."""
    offset, limit = _clamp_pagination(offset, limit)
    logs = activity.get_activity_logs(
        db,
        offset=offset,
        limit=limit,
        entity_type=entity_type,
        entity_id=entity_id,
        performed_by=performed_by,
    )
    total = activity.count_activity_logs(
        db,
        entity_type=entity_type,
        entity_id=entity_id,
        performed_by=performed_by,
    )
    return {"total": total, "offset": offset, "limit": limit, "logs": logs}


# ── Export ──────────────────────────────────────────────


@app.get("/export/books")
def export_books(db: Session = Depends(get_db)):
    """Export all books as CSV."""
    import csv
    import io

    all_books = books.get_all_books(db)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "ID",
            "Name",
            "Author",
            "Description",
            "Purchase Price",
            "Selling Price",
            "Quantity",
            "SKU",
            "Category",
            "Supplier ID",
            "Created At",
            "Updated At",
            "Notes",
        ]
    )
    for b in all_books:
        writer.writerow(
            [
                b.id,
                b.name,
                b.author,
                b.description,
                b.purchase_price,
                b.sell_price,
                b.quantity,
                b.sku,
                b.category,
                b.supplier_id,
                b.created_at,
                b.updated_at,
                b.notes or "",
            ]
        )
    output.seek(0)

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="books.csv"'},
    )


@app.get("/export/movements")
def export_movements(db: Session = Depends(get_db)):
    """Export all movements as CSV."""
    import csv
    import io

    all_movements = inventory.get_all_movements(db)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "ID",
            "Book ID",
            "Book Name",
            "Quantity Change",
            "Movement Type",
            "Reason",
            "Timestamp",
            "Performed By",
        ]
    )
    for m in all_movements:
        writer.writerow(
            [
                m.id,
                m.book_id,
                m.book_name,
                m.quantity_change,
                m.movement_type,
                m.reason or "",
                m.timestamp,
                m.performed_by,
            ]
        )
    output.seek(0)

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="movements.csv"'},
    )


@app.get("/export/purchase-orders")
def export_purchase_orders(db: Session = Depends(get_db)):
    """Export all purchase orders as CSV."""
    import csv
    import io

    all_orders = suppliers.get_all_purchase_orders(db)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "ID",
            "Supplier ID",
            "Supplier Name",
            "Book ID",
            "Book Name",
            "Book SKU",
            "Unit Price",
            "Quantity",
            "Delivered Quantity",
            "Status",
            "Created At",
            "Delivered At",
        ]
    )
    for o in all_orders:
        writer.writerow(
            [
                o.id,
                o.supplier_id,
                o.supplier_name,
                o.book_id,
                o.book_name,
                o.book_sku or "",
                o.unit_price,
                o.quantity,
                o.delivered_quantity,
                o.status,
                o.created_at,
                o.delivered_at or "",
            ]
        )
    output.seek(0)

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="purchase_orders.csv"'},
    )
