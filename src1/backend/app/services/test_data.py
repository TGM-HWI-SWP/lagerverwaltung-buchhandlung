from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal
import random
from uuid import uuid4

from sqlalchemy.orm import Session

from app.core.time import utc_now_iso
from app.db.models import Book, Supplier
from app.db.models_auth import StaffUser
from app.db.models_commerce import (
    CatalogProduct,
    DiscountRule,
    ProductPrice,
    PurchaseOrderV2,
    PurchaseOrderV2Line,
    SalesOrder,
    SalesOrderLine,
    StockItem,
    Warehouse,
)
from app.core.auth_staff import hash_pin, hash_password
from app.services.activity_log import write_activity_log


def _utc_now_dt() -> datetime:
    return datetime.fromisoformat(utc_now_iso())


def seed_all_test_data(db: Session) -> dict:
    """Lädt Demo-Daten für alle Bereiche (Bücher, Lager, Verkäufe, Lieferanten, Staff-User)."""
    result = {
        "message": "Demo-Daten erfolgreich geladen",
        "stats": {}
    }

    # Überprüfen, ob bereits Demo-Daten existieren
    book_count = db.query(Book).count()

    # 1. Staff-User erstellen (wenn noch keine existieren)
    staff_count = db.query(StaffUser).count()
    if staff_count == 0:
        staff_users = create_demo_staff_users(db)
        result["stats"]["staff_users"] = len(staff_users)
        db.flush()
    
    # 2. Lieferanten erstellen
    supplier_count = db.query(Supplier).count()
    if supplier_count < 3:
        suppliers = create_demo_suppliers(db)
        result["stats"]["suppliers"] = len(suppliers)
        db.flush()
    
    # 3. Katalogprodukte & Bücher erstellen
    if book_count < 10:
        books = create_demo_books_and_products(db)
        result["stats"]["books"] = len(books)
        db.flush()
    
    # 4. Commerce-Daten (Katalog, Preise, Lager)
    catalog_count = db.query(CatalogProduct).count()
    if catalog_count < 10:
        catalog_products = create_demo_catalog_products(db)
        result["stats"]["catalog_products"] = len(catalog_products)
        db.flush()
    
    # 5. Lagerbestand
    stock_count = db.query(StockItem).count()
    if stock_count < 20:
        stock_items = create_demo_stock(db)
        result["stats"]["stock_items"] = len(stock_items)
        db.flush()
    
    # 6. Rabattregeln
    discount_count = db.query(DiscountRule).count()
    if discount_count < 5:
        discounts = create_demo_discount_rules(db)
        result["stats"]["discount_rules"] = len(discounts)
        db.flush()
    
    # 7. Verkaufsdaten (letzte 30 Tage)
    sales_count = db.query(SalesOrder).count()
    if sales_count < 50:
        sales = create_demo_sales(db)
        result["stats"]["sales_orders"] = len(sales)
        db.flush()
    
    # 8. Bestellungen
    purchase_count = db.query(PurchaseOrderV2).count()
    if purchase_count < 10:
        purchases = create_demo_purchase_orders(db)
        result["stats"]["purchase_orders"] = len(purchases)
        db.flush()

    write_activity_log(
        db,
        action="DEMO_DATA_SEEDED",
        entity_type="system",
        entity_id="demo-seed",
        performed_by="admin",
        changes=str(result["stats"]),
        reason="Demo-Daten geladen",
    )

    db.commit()
    return result


def clear_all_test_data(db: Session) -> dict:
    """Löscht nur Demo-Daten (markierte Test-Einträge)."""
    deleted_counts = {}
    
    # Nur Einträge löschen, die mit "DEMO-" beginnen oder bestimmte Muster haben
    # Bücher mit DEMO-Tags
    demo_books = db.query(Book).filter(Book.name.ilike("%DEMO%")).all()
    for book in demo_books:
        db.delete(book)
    deleted_counts["books"] = len(demo_books)
    
    # Staff-User mit Demo-PINs (1234, 5678 etc.)
    demo_users = db.query(StaffUser).filter(
        StaffUser.username.ilike("%demo%") | StaffUser.display_name.ilike("%Demo%")
    ).all()
    for user in demo_users:
        db.delete(user)
    deleted_counts["staff_users"] = len(demo_users)
    
    # Commerce-Daten mit Demo-Flag (falls vorhanden)
    # Hier könnten wir später ein 'is_demo' Feld hinzufügen

    write_activity_log(
        db,
        action="DEMO_DATA_CLEARED",
        entity_type="system",
        entity_id="demo-clear",
        performed_by="admin",
        changes=str(deleted_counts),
        reason="Demo-Daten gelöscht",
    )
    
    db.commit()
    return {
        "message": "Demo-Daten gelöscht",
        "deleted_counts": deleted_counts
    }


def create_demo_staff_users(db: Session) -> list[StaffUser]:
    """Erstellt Demo-Mitarbeiter."""
    demo_users = [
        {
            "username": "admin",
            "display_name": "Administrator",
            "pin": "1234",
            "role": "admin",
            "password": "SecureAdminPass123!",
            "avatar_image": "",
        },
        {
            "username": "kassierer1",
            "display_name": "Anna Müller",
            "pin": "5678",
            "role": "cashier",
            "password": "",
            "avatar_image": "",
        },
        {
            "username": "kassierer2",
            "display_name": "Max Schmidt",
            "pin": "9012",
            "role": "cashier",
            "password": "",
            "avatar_image": "",
        },
        {
            "username": "lagerist",
            "display_name": "Thomas Wagner",
            "pin": "3456",
            "role": "cashier",  # Lagerist als Cashier mit erweiterten Rechten
            "password": "",
            "avatar_image": "",
        },
        {
            "username": "inaktiv",
            "display_name": "Inaktiver User (Demo)",
            "pin": "9999",
            "role": "cashier",
            "password": "",
            "avatar_image": "",
            "is_active": False,
        },
    ]
    
    created = []
    for user_data in demo_users:
        existing = db.query(StaffUser).filter(StaffUser.username == user_data["username"]).first()
        if existing:
            continue
            
        user = StaffUser(
            id=f"U{uuid4().hex[:8].upper()}",
            username=user_data["username"],
            display_name=user_data["display_name"],
            role=user_data["role"],
            pin_hash=hash_pin(user_data["pin"]),
            password_hash=hash_password(user_data["password"]) if user_data["password"] else "",
            avatar_image=user_data.get("avatar_image", ""),
            is_active=user_data.get("is_active", True),
        )
        db.add(user)
        created.append(user)
    
    return created


def create_demo_suppliers(db: Session) -> list[Supplier]:
    """Erstellt Demo-Lieferanten."""
    suppliers_data = [
        {
            "id": "SUP001",
            "name": "Buchgroßhandel Wien GmbH",
            "contact": "bestellung@bgh-wien.at",
            "address": "Mariahilfer Straße 100, 1060 Wien",
            "notes": "Hauptlieferant für alle Bücher",
        },
        {
            "id": "SUP002",
            "name": "Fachbuchverlag Müller & Co.",
            "contact": "vertrieb@fachbuch-verlag.at",
            "address": "Landstraßer Hauptstraße 45, 1030 Wien",
            "notes": "Spezialisiert auf Fachbücher",
        },
        {
            "id": "SUP003",
            "name": "Taschenbuch-Distributor",
            "contact": "info@taschenbuch.at",
            "address": "Hütteldorfer Straße 22, 1150 Wien",
            "notes": "Günstige Taschenbücher",
        },
    ]
    
    created = []
    for data in suppliers_data:
        existing = db.query(Supplier).filter(Supplier.id == data["id"]).first()
        if existing:
            continue

        supplier = Supplier(
            id=data["id"],
            name=data["name"],
            contact=data["contact"],
            address=data["address"],
            notes=data["notes"],
            created_at=_utc_now_dt(),
        )
        db.add(supplier)
        created.append(supplier)
    
    return created


def create_demo_books_and_products(db: Session) -> list[Book]:
    """Erstellt Demo-Bücher und verknüpft sie mit Katalogprodukten."""
    books_data = [
        {
            "name": "Die Verwandlung (DEMO)",
            "author": "Franz Kafka",
            "description": "Klassiker der deutschen Literatur",
            "purchase_price": 8.50,
            "selling_price": 12.90,
            "quantity": 15,
            "sku": "BK001",
            "category": "Klassiker",
            "supplier_id": "SUP001",
            "notes": "DEMO-Buch für Testzwecke",
        },
        {
            "name": "Der Prozess (DEMO)",
            "author": "Franz Kafka",
            "description": "Roman über Bürokratie und Justiz",
            "purchase_price": 9.20,
            "selling_price": 14.50,
            "quantity": 8,
            "sku": "BK002",
            "category": "Klassiker",
            "supplier_id": "SUP001",
            "notes": "DEMO-Buch für Testzwecke",
        },
        {
            "name": "Der große Gatsby (DEMO)",
            "author": "F. Scott Fitzgerald",
            "description": "Amerikanischer Klassiker",
            "purchase_price": 7.80,
            "selling_price": 11.90,
            "quantity": 22,
            "sku": "BK003",
            "category": "Klassiker",
            "supplier_id": "SUP002",
            "notes": "DEMO-Buch für Testzwecke",
        },
        {
            "name": "1984 (DEMO)",
            "author": "George Orwell",
            "description": "Dystopischer Roman",
            "purchase_price": 9.90,
            "selling_price": 15.50,
            "quantity": 12,
            "sku": "BK004",
            "category": "Science Fiction",
            "supplier_id": "SUP002",
            "notes": "DEMO-Buch für Testzwecke",
        },
        {
            "name": "Stolz und Vorurteil (DEMO)",
            "author": "Jane Austen",
            "description": "Britischer Gesellschaftsroman",
            "purchase_price": 8.30,
            "selling_price": 13.20,
            "quantity": 18,
            "sku": "BK005",
            "category": "Romantik",
            "supplier_id": "SUP001",
            "notes": "DEMO-Buch für Testzwecke",
        },
        {
            "name": "Der Herr der Ringe (DEMO)",
            "author": "J.R.R. Tolkien",
            "description": "Fantasy-Epos",
            "purchase_price": 22.50,
            "selling_price": 34.90,
            "quantity": 6,
            "sku": "BK006",
            "category": "Fantasy",
            "supplier_id": "SUP003",
            "notes": "DEMO-Buch für Testzwecke",
        },
        {
            "name": "Harry Potter und der Stein der Weisen (DEMO)",
            "author": "J.K. Rowling",
            "description": "Fantasy-Roman für Jugendliche",
            "purchase_price": 12.80,
            "selling_price": 19.90,
            "quantity": 25,
            "sku": "BK007",
            "category": "Fantasy",
            "supplier_id": "SUP003",
            "notes": "DEMO-Buch für Testzwecke",
        },
        {
            "name": "Der Alchimist (DEMO)",
            "author": "Paulo Coelho",
            "description": "Philosophischer Roman",
            "purchase_price": 10.50,
            "selling_price": 16.90,
            "quantity": 14,
            "sku": "BK008",
            "category": "Philosophie",
            "supplier_id": "SUP002",
            "notes": "DEMO-Buch für Testzwecke",
        },
        {
            "name": "Siddhartha (DEMO)",
            "author": "Hermann Hesse",
            "description": "Spiritueller Entwicklungsroman",
            "purchase_price": 9.10,
            "selling_price": 14.20,
            "quantity": 9,
            "sku": "BK009",
            "category": "Philosophie",
            "supplier_id": "SUP001",
            "notes": "DEMO-Buch für Testzwecke",
        },
        {
            "name": "Der kleine Prinz (DEMO)",
            "author": "Antoine de Saint-Exupéry",
            "description": "Kinderbuch mit philosophischer Tiefe",
            "purchase_price": 7.50,
            "selling_price": 11.50,
            "quantity": 30,
            "sku": "BK010",
            "category": "Kinderbuch",
            "supplier_id": "SUP003",
            "notes": "DEMO-Buch für Testzwecke",
        },
    ]
    
    created = []
    for data in books_data:
        # Prüfen ob SKU bereits existiert
        existing = db.query(Book).filter(Book.sku == data["sku"]).first()
        if existing:
            continue
            
        book = Book(
            id=f"B{uuid4().hex[:8].upper()}",
            name=data["name"],
            author=data["author"],
            description=data["description"],
            purchase_price=data["purchase_price"],
            sell_price=data["selling_price"],
            quantity=data["quantity"],
            sku=data["sku"],
            category=data["category"],
            supplier_id=data["supplier_id"],
            created_at=_utc_now_dt(),
            updated_at=_utc_now_dt(),
            notes=data["notes"],
        )
        db.add(book)
        created.append(book)
        
        # Katalogprodukt erstellen
        catalog_product = CatalogProduct(
            id=book.id,  # Gleiche ID wie Buch für einfache Verknüpfung
            sku=data["sku"],
            title=data["name"],
            author=data["author"],
            description=data["description"],
            category=data["category"],
            is_active=True,
            created_at=_utc_now_dt(),
            updated_at=_utc_now_dt(),
        )
        db.add(catalog_product)
        
        # Preis für Katalogprodukt
        price = ProductPrice(
            id=str(uuid4()),
            product_id=catalog_product.id,
            price_type="standard",
            amount=Decimal(str(data["selling_price"])),
            currency="EUR",
            valid_from=_utc_now_dt(),
            priority=0,
            is_active=True,
            created_at=_utc_now_dt(),
        )
        db.add(price)
    
    return created


def create_demo_catalog_products(db: Session) -> list[CatalogProduct]:
    """Erstellt zusätzliche Katalogprodukte (nicht als Bücher)."""
    # Werden bereits in create_demo_books_and_products erstellt
    return db.query(CatalogProduct).all()


def create_demo_stock(db: Session) -> list[StockItem]:
    """Erstellt Demo-Lagerbestände."""
    # Standard-Lager erstellen, falls nicht vorhanden
    warehouse = db.query(Warehouse).filter(Warehouse.code == "STORE").first()
    if not warehouse:
        warehouse = Warehouse(
            id=str(uuid4()),
            code="STORE",
            name="Verkaufsfläche",
            is_active=True,
            created_at=_utc_now_dt(),
        )
        db.add(warehouse)
    
    # Alle Katalogprodukte holen
    products = db.query(CatalogProduct).all()
    created = []
    
    for product in products:
        # Prüfen ob bereits Lagerbestand existiert
        existing = db.query(StockItem).filter(
            StockItem.product_id == product.id,
            StockItem.warehouse_id == warehouse.id
        ).first()
        
        if existing:
            continue
        
        # Zufällige Menge zwischen 5 und 50
        quantity = random.randint(5, 50)
        
        stock_item = StockItem(
            id=str(uuid4()),
            product_id=product.id,
            warehouse_id=warehouse.id,
            on_hand=quantity,
            reserved=0,
            reorder_point=5,
            updated_at=_utc_now_dt(),
        )
        db.add(stock_item)
        created.append(stock_item)
    
    return created


def create_demo_discount_rules(db: Session) -> list[DiscountRule]:
    """Erstellt Demo-Rabattregeln."""
    now = _utc_now_dt()
    discount_data = [
        {
            "name": "Sommeraktion 10%",
            "rule_type": "SEASONAL",
            "value_type": "PERCENT",
            "value": Decimal("10.00"),
            "min_order_amount": Decimal("0.00"),
            "stackable": True,
            "active_from": now - timedelta(days=30),
            "active_to": now + timedelta(days=30),
            "is_active": True,
        },
        {
            "name": "Treuerabatt 5%",
            "rule_type": "CUSTOM",
            "value_type": "PERCENT",
            "value": Decimal("5.00"),
            "min_order_amount": Decimal("50.00"),
            "stackable": True,
            "active_from": now - timedelta(days=365),
            "active_to": now + timedelta(days=365),
            "is_active": True,
        },
        {
            "name": "Mengenrabatt 15%",
            "rule_type": "CUSTOM",
            "value_type": "PERCENT",
            "value": Decimal("15.00"),
            "min_order_amount": Decimal("75.00"),
            "stackable": False,
            "active_from": now,
            "active_to": now + timedelta(days=180),
            "is_active": True,
        },
        {
            "name": "Willkommensrabatt 5€",
            "rule_type": "FIRST_CUSTOMER",
            "value_type": "FIXED",
            "value": Decimal("5.00"),
            "min_order_amount": Decimal("0.00"),
            "stackable": False,
            "active_from": now,
            "active_to": now + timedelta(days=90),
            "is_active": True,
        },
    ]

    created = []
    for data in discount_data:
        discount = DiscountRule(
            id=str(uuid4()),
            name=data["name"],
            rule_type=data["rule_type"],
            value_type=data["value_type"],
            value=data["value"],
            min_order_amount=data["min_order_amount"],
            stackable=data["stackable"],
            active_from=data["active_from"],
            active_to=data["active_to"],
            is_active=data["is_active"],
            created_at=_utc_now_dt(),
        )
        db.add(discount)
        created.append(discount)

    return created


def create_demo_sales(db: Session) -> list[SalesOrder]:
    """Erstellt Demo-Verkaufsdaten der letzten 30 Tage."""
    products = db.query(CatalogProduct).all()
    if not products:
        return []

    staff_users = db.query(StaffUser).filter(StaffUser.is_active == True).all()
    if not staff_users:
        return []

    created = []
    for i in range(50):
        days_ago = random.randint(0, 30)
        sale_date = _utc_now_dt() - timedelta(days=days_ago, hours=random.randint(0, 23))

        order = SalesOrder(
            id=f"SO{uuid4().hex[:8].upper()}",
            order_number=f"SO-{sale_date.strftime('%Y%m%d')}-{i:04d}",
            cashier_user_id=random.choice(staff_users).id,
            customer_reference=f"Kunde {random.randint(1, 100)}",
            is_first_customer=random.random() < 0.2,
            subtotal=Decimal("0.00"),
            discount_total=Decimal("0.00"),
            total=Decimal("0.00"),
            status="COMPLETED",
            created_at=sale_date,
        )
        db.add(order)

        num_lines = random.randint(1, 5)
        subtotal = Decimal("0.00")

        for _ in range(num_lines):
            product = random.choice(products)
            quantity = random.randint(1, 3)
            unit_price = Decimal(str(random.uniform(8.0, 35.0))).quantize(Decimal("0.01"))
            line_total = (unit_price * quantity).quantize(Decimal("0.01"))

            line = SalesOrderLine(
                id=str(uuid4()),
                sales_order_id=order.id,
                product_id=product.id,
                product_name=product.title,
                quantity=quantity,
                unit_price=unit_price,
                line_discount=Decimal("0.00"),
                line_total=line_total,
            )
            db.add(line)
            subtotal += line_total

        discount_total = Decimal("0.00")
        if random.random() < 0.3:
            discount_total = (subtotal * Decimal("0.10")).quantize(Decimal("0.01"))
            if discount_total > subtotal:
                discount_total = subtotal

        order.subtotal = subtotal
        order.discount_total = discount_total
        order.total = (subtotal - discount_total).quantize(Decimal("0.01"))

        created.append(order)

    return created


def create_demo_purchase_orders(db: Session) -> list[PurchaseOrderV2]:
    """Erstellt Demo-Bestellungen."""
    suppliers = db.query(Supplier).all()
    products = db.query(CatalogProduct).all()
    admin = db.query(StaffUser).filter(StaffUser.role == "admin").first()

    if not suppliers or not products or not admin:
        return []

    created = []
    for i in range(10):
        supplier = random.choice(suppliers)
        order_date = _utc_now_dt() - timedelta(days=random.randint(1, 60))
        status = random.choice(["ORDERED", "PARTIAL_RECEIVED", "RECEIVED"])

        order = PurchaseOrderV2(
            id=f"PO{uuid4().hex[:8].upper()}",
            order_number=f"PO-{order_date.strftime('%Y%m%d')}-{i:04d}",
            supplier_id=supplier.id,
            created_by_user_id=admin.id,
            status=status,
            notes="DEMO-Bestellung",
            ordered_at=order_date,
            received_at=order_date + timedelta(days=random.randint(1, 7)) if status == "RECEIVED" else None,
        )
        db.add(order)

        num_lines = random.randint(1, 4)
        for _ in range(num_lines):
            product = random.choice(products)
            quantity = random.randint(10, 50)
            unit_cost = Decimal(str(random.uniform(5.0, 25.0))).quantize(Decimal("0.01"))

            line = PurchaseOrderV2Line(
                id=str(uuid4()),
                purchase_order_id=order.id,
                product_id=product.id,
                quantity=quantity,
                unit_cost=unit_cost,
                received_quantity=quantity if status == "RECEIVED" else random.randint(0, quantity),
            )
            db.add(line)

        created.append(order)

    return created
