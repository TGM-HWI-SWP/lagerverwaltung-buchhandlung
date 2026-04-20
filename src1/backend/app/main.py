import csv
import io
from datetime import datetime
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api import activity, auth as auth_api
from app.core.auth_staff import hash_password, hash_pin, require_admin, require_user
from app.core.bootstrap import get_database_health, initialize_application
from app.core.config import settings
from app.core.errors import install_error_handlers
from app.db.models import Supplier
from app.db.models_auth import StaffUser
from app.db.models_commerce import CatalogProduct, PurchaseOrderV2Line, SalesOrder, StockItem, StockLedgerEntry, Warehouse
from app.db.schemas import SupplierCreateRequest, SupplierSchema
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
from app.db.schemas_commerce import (
    CatalogProductCreateRequest,
    CatalogProductSchema,
    CatalogProductUpdateRequest,
    ProductSupplierSchema,
    ProductSupplierUpsertRequest,
    PurchaseOrderCreateRequest,
    PurchaseOrderResponse,
    PurchaseOrderReceiveRequest,
    ReturnCreateRequest,
    ReturnOrderResponse,
    SaleCreateRequest,
    SaleOrderResponse,
    StockAdjustmentRequest,
    StockEntrySchema,
    StockLedgerEntrySchema,
    WarehouseCreateRequest,
    WarehouseSchema,
    WarehouseUpdateRequest,
)
from app.db.session import get_db
from app.services.commerce import CommerceService


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
    return [_staff_summary(row) for row in query.order_by(StaffUser.role.desc(), StaffUser.display_name.asc()).all()]


def _service(db: Session) -> CommerceService:
    return CommerceService(db)


app = FastAPI(title=settings.app_name)

install_error_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
    return _staff_summary(created)


@app.post("/auth/cashier-login", response_model=LoginResponse)
def auth_cashier_login(payload: CashierPinLoginRequest, db: Session = Depends(get_db)):
    return auth_api.cashier_pin_login(db, payload)


@app.get("/auth/me", response_model=WhoAmIResponse)
def auth_me(user=Depends(require_user)):
    return auth_api.whoami(user)


@app.get("/staff-users", response_model=list[StaffUserSummary])
def read_staff_users(db: Session = Depends(get_db), user=Depends(require_admin)):
    return _list_staff_users(db)


@app.get("/staff-users/cashier-list", response_model=list[StaffUserSummary])
def read_cashier_list(db: Session = Depends(get_db)):
    return [
        StaffUserSummary(
            id=row.id,
            username="",
            display_name=row.display_name,
            role=row.role,
            avatar_image=row.avatar_image or "",
        )
        for row in db.query(StaffUser)
        .filter(StaffUser.is_active == True, StaffUser.role == "cashier")  # noqa: E712
        .order_by(StaffUser.display_name.asc())
        .all()
    ]


@app.post("/staff-users", response_model=StaffUserSummary, status_code=201)
def create_staff_user(
    payload: StaffUserCreateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    username = payload.username.strip().lower()
    role = payload.role.strip().lower() if payload.role else "cashier"
    if role not in {"cashier", "admin"}:
        raise HTTPException(status_code=400, detail="Ungültige Rolle")
    existing = db.query(StaffUser).filter(StaffUser.username == username).first()
    if existing:
        raise HTTPException(status_code=409, detail="Benutzername bereits vergeben")
    created = StaffUser(
        id=f"U{uuid4().hex[:8].upper()}",
        username=username,
        display_name=payload.display_name.strip(),
        role=role,
        pin_hash=hash_pin(payload.pin),
        password_hash=hash_password(payload.password) if role == "admin" else "",
        avatar_image=payload.avatar_image,
        is_active=True,
    )
    db.add(created)
    db.commit()
    db.refresh(created)
    return _staff_summary(created)


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
    if payload.display_name is not None:
        staff_user.display_name = payload.display_name.strip()
    if payload.pin is not None:
        staff_user.pin_hash = hash_pin(payload.pin)
    if payload.role is not None:
        role = payload.role.strip().lower()
        if role not in {"cashier", "admin"}:
            raise HTTPException(status_code=400, detail="Ungültige Rolle")
        staff_user.role = role
    if payload.password is not None:
        staff_user.password_hash = hash_password(payload.password) if payload.password.strip() else ""
    if payload.avatar_image is not None:
        staff_user.avatar_image = payload.avatar_image
    db.commit()
    db.refresh(staff_user)
    return _staff_summary(staff_user)


@app.delete("/staff-users/{user_id}")
def delete_staff_user(user_id: str, db: Session = Depends(get_db), user=Depends(require_admin)):
    staff_user = db.query(StaffUser).filter(StaffUser.id == user_id).first()
    if not staff_user:
        raise HTTPException(status_code=404, detail="Mitarbeiter nicht gefunden")
    staff_user.is_active = False
    db.commit()
    return {"detail": "Mitarbeiter deaktiviert"}


@app.get("/catalog-products", response_model=list[CatalogProductSchema])
def read_catalog_products(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    return _service(db).list_catalog_products(include_inactive)


@app.get("/catalog-products/{product_id}", response_model=CatalogProductSchema)
def read_catalog_product(product_id: str, db: Session = Depends(get_db), user=Depends(require_user)):
    try:
        return _service(db).get_catalog_product(product_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/catalog-products", response_model=CatalogProductSchema, status_code=201)
def create_catalog_product(
    payload: CatalogProductCreateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    try:
        return _service(db).create_catalog_product(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/catalog-products/{product_id}", response_model=CatalogProductSchema)
def update_catalog_product(
    product_id: str,
    payload: CatalogProductUpdateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    try:
        return _service(db).update_catalog_product(product_id, payload)
    except ValueError as exc:
        status_code = 404 if "nicht gefunden" in str(exc) else 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@app.delete("/catalog-products/{product_id}")
def delete_catalog_product(product_id: str, db: Session = Depends(get_db), user=Depends(require_admin)):
    try:
        return _service(db).delete_catalog_product(product_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/warehouses", response_model=list[WarehouseSchema])
def read_warehouses(db: Session = Depends(get_db), user=Depends(require_user)):
    return _service(db).list_warehouses()


@app.post("/warehouses", response_model=WarehouseSchema, status_code=201)
def create_warehouse(payload: WarehouseCreateRequest, db: Session = Depends(get_db), user=Depends(require_admin)):
    try:
        return _service(db).create_warehouse(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.put("/warehouses/{warehouse_id}", response_model=WarehouseSchema)
def update_warehouse(
    warehouse_id: str,
    payload: WarehouseUpdateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    try:
        return _service(db).update_warehouse(warehouse_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/stock-items", response_model=list[StockEntrySchema])
def read_stock_items(
    include_zero: bool = Query(True),
    warehouse_code: str | None = None,
    product_id: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    return _service(db).list_stock(include_zero=include_zero, warehouse_code=warehouse_code, product_id=product_id)


@app.post("/stock-adjustments", response_model=StockEntrySchema)
def create_stock_adjustment(
    payload: StockAdjustmentRequest,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    try:
        return _service(db).adjust_stock(payload, performed_by=user.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/stock-ledger", response_model=list[StockLedgerEntrySchema])
def read_stock_ledger(
    warehouse_code: str | None = None,
    product_id: str | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    return _service(db).list_stock_ledger(warehouse_code=warehouse_code, product_id=product_id, offset=offset, limit=limit)


@app.get("/suppliers", response_model=list[SupplierSchema])
def read_suppliers(db: Session = Depends(get_db), user=Depends(require_user)):
    return _service(db).list_suppliers()


@app.post("/suppliers", response_model=SupplierSchema, status_code=201)
def create_supplier(payload: SupplierCreateRequest, db: Session = Depends(get_db), user=Depends(require_admin)):
    try:
        return _service(db).create_supplier(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/product-suppliers/{product_id}", response_model=list[ProductSupplierSchema])
def read_product_suppliers(product_id: str, db: Session = Depends(get_db), user=Depends(require_user)):
    return _service(db).list_product_suppliers(product_id)


@app.put("/product-suppliers/{product_id}", response_model=list[ProductSupplierSchema])
def update_product_suppliers(
    product_id: str,
    payload: ProductSupplierUpsertRequest,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    try:
        return _service(db).upsert_product_suppliers(product_id, payload)
    except ValueError as exc:
        status_code = 404 if "nicht gefunden" in str(exc) else 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc


@app.get("/purchase-orders", response_model=list[PurchaseOrderResponse])
def read_purchase_orders(db: Session = Depends(get_db), user=Depends(require_user)):
    return _service(db).list_purchase_orders()


@app.post("/purchase-orders", response_model=PurchaseOrderResponse, status_code=201)
def create_purchase_order(
    payload: PurchaseOrderCreateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    try:
        return _service(db).create_purchase_order(payload, user.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/purchase-orders/{order_id}/receive", response_model=PurchaseOrderResponse)
def receive_purchase_order(
    order_id: str,
    payload: PurchaseOrderReceiveRequest,
    db: Session = Depends(get_db),
    user=Depends(require_admin),
):
    try:
        return _service(db).receive_purchase_order(order_id, payload, user.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/sales-orders", response_model=list[SaleOrderResponse])
def read_sales_orders(db: Session = Depends(get_db), user=Depends(require_user)):
    return _service(db).list_sales_orders()


@app.post("/sales-orders", response_model=SaleOrderResponse, status_code=201)
def create_sales_order(payload: SaleCreateRequest, db: Session = Depends(get_db), user=Depends(require_user)):
    try:
        return _service(db).create_sale(payload, user.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/sales-orders/{order_id}/returns", response_model=ReturnOrderResponse, status_code=201)
def create_sales_return(
    order_id: str,
    payload: ReturnCreateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    try:
        return _service(db).create_return(order_id, payload, user.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/activity-logs")
def read_activity_logs(
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    entity_type: str | None = None,
    entity_id: str | None = None,
    performed_by: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_user),
):
    logs = activity.get_activity_logs(
        db,
        offset=offset,
        limit=limit,
        entity_type=entity_type,
        entity_id=entity_id,
        performed_by=performed_by,
    )
    total = activity.count_activity_logs(db, entity_type=entity_type, entity_id=entity_id, performed_by=performed_by)
    return {"total": total, "offset": offset, "limit": limit, "logs": logs}


@app.get("/reports/stock-pdf")
def stock_pdf(db: Session = Depends(get_db), user=Depends(require_user)):
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.backends.backend_pdf import PdfPages
    except ImportError as exc:
        raise HTTPException(status_code=503, detail="PDF-Export ist auf diesem System nicht verfügbar") from exc

    rows = (
        db.query(Warehouse.code, func.coalesce(func.sum(StockItem.on_hand), 0))
        .join(StockItem, StockItem.warehouse_id == Warehouse.id)
        .group_by(Warehouse.code)
        .order_by(Warehouse.code.asc())
        .all()
    )
    labels = [row[0] for row in rows] or ["Keine Daten"]
    values = [int(row[1]) for row in rows] or [0]
    buffer = io.BytesIO()
    with PdfPages(buffer) as pdf:
        fig, ax = plt.subplots(figsize=(8, 4.8))
        ax.bar(labels, values, color=["#2563eb", "#0f766e", "#ea580c"][: len(labels)])
        ax.set_title(f"Bestand je Lagerort ({datetime.now().strftime('%d.%m.%Y %H:%M')})")
        ax.set_ylabel("Stück")
        ax.set_xlabel("Lagerort")
        ax.grid(axis="y", linestyle="--", alpha=0.3)
        pdf.savefig(fig, bbox_inches="tight")
        plt.close(fig)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="stock-report.pdf"'},
    )


@app.get("/export/catalog-products")
def export_catalog_products(db: Session = Depends(get_db), user=Depends(require_user)):
    rows = _service(db).list_catalog_products(include_inactive=True)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Product ID", "SKU", "Title", "Author", "Category", "Selling Price", "Reorder Point", "Active"])
    for row in rows:
        writer.writerow([row.id, row.sku, row.title, row.author, row.category, row.selling_price, row.reorder_point, row.is_active])
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="catalog-products.csv"'},
    )


@app.get("/export/stock-ledger")
def export_stock_ledger(db: Session = Depends(get_db), user=Depends(require_user)):
    rows = _service(db).list_stock_ledger(limit=1000)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Entry ID", "Product ID", "SKU", "Title", "Warehouse", "Delta", "Movement Type", "Reference Type", "Reference ID", "Reason", "Performed By", "Created At"])
    for row in rows:
        writer.writerow([row.id, row.product_id, row.sku, row.title, row.warehouse_code, row.quantity_delta, row.movement_type, row.reference_type, row.reference_id, row.reason, row.performed_by, row.created_at])
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="stock-ledger.csv"'},
    )


@app.get("/export/purchase-orders")
def export_purchase_orders(db: Session = Depends(get_db), user=Depends(require_user)):
    rows = _service(db).list_purchase_orders()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Order ID", "Order Number", "Supplier ID", "Supplier Name", "Status", "Ordered At", "Received At", "Line ID", "Product ID", "Product Title", "Quantity", "Received Quantity", "Unit Cost"])
    for order in rows:
        for line in order.lines:
            writer.writerow([
                order.id,
                order.order_number,
                order.supplier_id,
                order.supplier_name,
                order.status,
                order.ordered_at,
                order.received_at or "",
                line.line_id,
                line.product_id,
                line.product_title,
                line.quantity,
                line.received_quantity,
                line.unit_cost,
            ])
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="purchase-orders.csv"'},
    )
