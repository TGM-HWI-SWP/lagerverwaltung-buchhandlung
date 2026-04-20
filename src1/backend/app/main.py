from pathlib import Path
import time
from uuid import uuid4

from fastapi import FastAPI, Depends, HTTPException                             # FastAPI-Framework
from fastapi.middleware.cors import CORSMiddleware                              # CORS-Middleware
from fastapi.responses import StreamingResponse                                 # Streaming für PDF
from sqlalchemy.orm import Session                                              # DB-Session
from sqlalchemy import func
from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError

import io                                                                       # PDF-Buffer
from datetime import datetime                                                   # Zeitstempel im PDF
import matplotlib                                                               # Plot-Library
matplotlib.use("Agg")                                                           # Headless-Backend
import matplotlib.pyplot as plt                                                 # Pyplot-API
from matplotlib.backends.backend_pdf import PdfPages                            # PDF-Export

from app.core.config import settings                                            # App-Konfiguration
# API-key auth was replaced by staff login tokens.
# ConflictError is handled by a global exception handler
from app.core.errors import install_error_handlers
from app.core.migrations import ensure_schema
from app.db.models import Base                                                  # DB-Modelle
from app.db import models_commerce  # noqa: F401  # Registriert Commerce-Tabellen im Metadata-Objekt.
from app.db.models import Book, Supplier
from app.db.models_auth import StaffUser
from app.db.session import SessionLocal, engine, get_db                         # DB-Verbindung
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
from app.api import books, inventory, suppliers, activity, auth as auth_api, commerce
from app.core.auth_staff import hash_password, hash_pin, require_admin, require_user
from app.core.time import utc_now_iso
from app.db.schemas_auth import (
    AdminLoginRequest,
    BootstrapAdminRequest,
    BootstrapStatusResponse,
    CashierPinLoginRequest,
    LoginRequest,
    LoginResponse,
    StaffUserCreateRequest,
    StaffUserSummary,
    StaffUserUpdateRequest,
    WhoAmIResponse,
)
from app.db.schemas_commerce import (
    CatalogProductCreateRequest,
    CatalogProductSchema,
    CatalogProductUpdateRequest,
    DiscountRuleCreateRequest,
    DiscountRuleSchema,
    PurchaseOrderCreateRequest,
    PurchaseOrderReceiveRequest,
    PurchaseOrderResponse,
    ReturnCreateRequest,
    ReturnOrderResponse,
    SaleCreateRequest,
    SaleOrderResponse,
    StockAdjustmentRequest,
    StockEntrySchema,
)


def _clamp_pagination(offset: int, limit: int, *, max_limit: int = 100) -> tuple[int, int]:
    offset = max(0, int(offset))
    limit = max(1, int(limit))
    limit = min(limit, max_limit)
    return offset, limit


def _initialize_database(retries: int = 20, delay_seconds: float = 1.5) -> None:
    """Wait for the DB to accept connections before running schema setup."""
    last_error: OperationalError | None = None
    for attempt in range(1, retries + 1):
        try:
            Base.metadata.create_all(bind=engine)                               # Tabellen erstellen
            ensure_schema()
            return
        except OperationalError as exc:
            last_error = exc
            if attempt == retries:
                break
            time.sleep(delay_seconds)
    assert last_error is not None
    raise last_error


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

        if "staff_users" not in table_names:
            conn.execute(
                text(
                    """
                    CREATE TABLE staff_users (
                        id VARCHAR PRIMARY KEY,
                        username VARCHAR NOT NULL UNIQUE,
                        display_name VARCHAR NOT NULL,
                        role VARCHAR NOT NULL DEFAULT 'cashier',
                        pin_hash VARCHAR NOT NULL,
                        password_hash VARCHAR NOT NULL DEFAULT '',
                        is_active BOOLEAN NOT NULL DEFAULT 1,
                        CONSTRAINT ck_staff_users_pin_hash_non_empty CHECK (pin_hash <> '')
                    )
                    """
                )
            )

        staff_columns = {col["name"] for col in inspector.get_columns("staff_users")}
        if "avatar_image" not in staff_columns:
            conn.execute(text("ALTER TABLE staff_users ADD COLUMN avatar_image VARCHAR NOT NULL DEFAULT ''"))
        if "password_hash" not in staff_columns:
            conn.execute(text("ALTER TABLE staff_users ADD COLUMN password_hash VARCHAR NOT NULL DEFAULT ''"))
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

        if "activity_logs" not in table_names:
            conn.execute(
                text(
                     """
                     CREATE TABLE activity_logs (
                         id VARCHAR PRIMARY KEY,
                         timestamp VARCHAR NOT NULL DEFAULT (datetime('now', 'localtime')),
                         performed_by VARCHAR NOT NULL DEFAULT 'system',
                         action VARCHAR NOT NULL,
                         entity_type VARCHAR NOT NULL,
                         entity_id VARCHAR NOT NULL,
                         changes TEXT,
                         reason VARCHAR
                     )
                     """
                )
            )

        # ---- DateTime migration (SQLite-safe)
        # SQLite can't ALTER COLUMN reliably. We add *_dt columns and backfill from existing
        # ISO timestamps stored as TEXT.
        def _add_dt_column(table: str, old_col: str, new_col: str) -> None:
            cols = {c["name"] for c in inspector.get_columns(table)}
            if new_col in cols:
                return
            conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {new_col} DATETIME"))
            conn.execute(
                text(
                    f"UPDATE {table} SET {new_col} = {old_col} "
                    f"WHERE {new_col} IS NULL AND {old_col} IS NOT NULL"
                )
            )

        if "books" in table_names:
            _add_dt_column("books", "created_at", "created_at_dt")
            _add_dt_column("books", "updated_at", "updated_at_dt")
        if "movements" in table_names:
            _add_dt_column("movements", "timestamp", "timestamp_dt")
        if "suppliers" in table_names:
            _add_dt_column("suppliers", "created_at", "created_at_dt")
        if "purchase_orders" in table_names:
            _add_dt_column("purchase_orders", "created_at", "created_at_dt")
            _add_dt_column("purchase_orders", "delivered_at", "delivered_at_dt")
        if "incoming_deliveries" in table_names:
            _add_dt_column("incoming_deliveries", "received_at", "received_at_dt")
        if "book_suppliers" in table_names:
            _add_dt_column("book_suppliers", "created_at", "created_at_dt")
            _add_dt_column("book_suppliers", "updated_at", "updated_at_dt")
        if "activity_logs" in table_names:
            _add_dt_column("activity_logs", "timestamp", "timestamp_dt")

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
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_activity_logs_timestamp ON activity_logs (timestamp DESC)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_activity_logs_entity ON activity_logs (entity_type, entity_id)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_activity_logs_performed_by ON activity_logs (performed_by)"))

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
    """Stellt sicher, dass ein Standard-Lieferant existiert."""
    supplier_id = "S001"
    supplier_name = "Buchgroßhandel Wien GmbH"
    supplier_contact = "kontakt@bgh-wien.at"
    supplier_address = "Mariahilfer Straße 100, 1060 Wien"
    supplier_notes = "Hauptlieferant für alle Bücher"

    db = SessionLocal()
    try:
        exists = db.query(Supplier).filter(Supplier.id == supplier_id).first()
        if exists:
            return
        supplier = SupplierSchema(
            id=supplier_id,
            name=supplier_name,
            contact=supplier_contact,
            address=supplier_address,
            notes=supplier_notes,
            created_at=utc_now_iso(),
        )
        suppliers.create_supplier(db, supplier)
    finally:
        db.close()

def _seed_database():
    """Fügt Testdaten ein, wenn die Datenbank leer ist."""
    if not str(engine.url).startswith("sqlite"):
        return
    sql_file = Path(__file__).parent / "db" / "buchhandlung.sql"
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


_initialize_database()
_ensure_sqlite_schema()
_seed_database()
_ensure_default_supplier_data()

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


@app.post("/auth/login", response_model=LoginResponse)
def auth_login(payload: LoginRequest, db: Session = Depends(get_db)):
    return auth_api.login(db, payload)


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
    rows = (
        db.query(StaffUser)
        .filter(StaffUser.is_active == True)  # noqa: E712
        .order_by(StaffUser.role.desc(), StaffUser.display_name.asc())
        .all()
    )
    return [
        StaffUserSummary(
            id=row.id,
            username=row.username,
            display_name=row.display_name,
            role=row.role,
            avatar_image=row.avatar_image or "",
        )
        for row in rows
    ]


@app.get("/staff-users/cashier-list", response_model=list[StaffUserSummary])
def read_cashier_list(db: Session = Depends(get_db)):
    rows = (
        db.query(StaffUser)
        .filter(StaffUser.is_active == True)  # noqa: E712
        .order_by(StaffUser.display_name.asc())
        .all()
    )
    return [
        StaffUserSummary(
            id=row.id,
            username=row.username,
            display_name=row.display_name,
            role=row.role,
            avatar_image=row.avatar_image or "",
        )
        for row in rows
    ]


@app.get("/staff-users/admin-list", response_model=list[StaffUserSummary])
def read_admin_list(db: Session = Depends(get_db)):
    rows = (
        db.query(StaffUser)
        .filter(StaffUser.is_active == True, StaffUser.role == "admin")  # noqa: E712
        .order_by(StaffUser.display_name.asc())
        .all()
    )
    return [
        StaffUserSummary(
            id=row.id,
            username=row.username,
            display_name=row.display_name,
            role=row.role,
            avatar_image=row.avatar_image or "",
        )
        for row in rows
    ]


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
    
    return StaffUserSummary(
        id=staff_user.id,
        username=staff_user.username,
        display_name=staff_user.display_name,
        role=staff_user.role,
        avatar_image=staff_user.avatar_image or "",
    )


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


# ── Commerce v2 (Katalog, Bestand, Verkauf, Retouren) ─────────────


@app.get("/catalog/products", response_model=list[CatalogProductSchema])
def read_catalog_products(
    include_inactive: bool = False,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    return commerce.list_catalog_products(db, include_inactive)


@app.post("/catalog/products", response_model=CatalogProductSchema, status_code=201)
def create_catalog_product(
    payload: CatalogProductCreateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    try:
        return commerce.create_catalog_product(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/catalog/products/{product_id}", response_model=CatalogProductSchema)
def update_catalog_product(
    product_id: str,
    payload: CatalogProductUpdateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    try:
        return commerce.update_catalog_product(db, product_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/inventory/stock", response_model=list[StockEntrySchema])
def read_stock_entries(
    include_zero: bool = False,
    warehouse_code: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    return commerce.list_stock(db, include_zero=include_zero, warehouse_code=warehouse_code)


@app.post("/inventory/stock-adjustments", response_model=StockEntrySchema)
def create_stock_adjustment(
    payload: StockAdjustmentRequest,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    try:
        return commerce.adjust_stock(db, payload, performed_by=user.username)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/discount-rules", response_model=list[DiscountRuleSchema])
def read_discount_rules(
    only_active: bool = True,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    return commerce.list_discount_rules(db, only_active=only_active)


@app.post("/discount-rules", response_model=DiscountRuleSchema, status_code=201)
def create_discount_rule(
    payload: DiscountRuleCreateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    try:
        return commerce.create_discount_rule(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/sales/orders", response_model=SaleOrderResponse, status_code=201)
def create_sales_order(
    payload: SaleCreateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    try:
        return commerce.create_sale(db, payload, cashier_user_id=user.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/sales/orders/{sales_order_id}/returns", response_model=ReturnOrderResponse, status_code=201)
def create_sales_return(
    sales_order_id: str,
    payload: ReturnCreateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    try:
        return commerce.create_return(db, sales_order_id, payload, processed_by_user_id=user.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/purchase-orders-v2", response_model=PurchaseOrderResponse, status_code=201)
def create_purchase_order_v2(
    payload: PurchaseOrderCreateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    try:
        return commerce.create_purchase_order(db, payload, user_id=user.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/purchase-orders-v2", response_model=list[PurchaseOrderResponse])
def read_purchase_orders_v2(
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    return commerce.list_purchase_orders(db)


@app.post("/purchase-orders-v2/{order_id}/receive", response_model=PurchaseOrderResponse)
def receive_purchase_order_v2(
    order_id: str,
    payload: PurchaseOrderReceiveRequest,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    try:
        return commerce.receive_purchase_order(db, order_id, payload, user_id=user.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


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
