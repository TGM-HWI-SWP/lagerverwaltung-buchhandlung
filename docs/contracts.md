# Schnittstellen-Dokumentation (Contracts)

## Übersicht

Diese Datei dokumentiert die **Backend-Contracts** (Ports/Interfaces) der Buchhandlungsverwaltung.
Sie ist die Referenz dafür, wie die Service-Schicht mit Persistenz/Integrationen spricht – unabhängig
von konkreten Implementierungen (Adapters).

Code-Quelle: `src1/backend/app/contracts/`

---

## 1. BookRepository (Port)

**Ort:** `app/contracts/repositories.py`

### Verantwortung
CRUD-Zugriffe auf Bücher (Persistenz-agnostisch).

### Methoden (Signaturen)

- `list() -> list[Book]`
- `get(book_id: str) -> Book | None`
- `add(book: Book) -> Book`
- `update(book: Book) -> Book`
- `delete(book_id: str) -> bool`

### Referenz-Implementierung
- `SqlAlchemyBookRepository` (`app/adapters/sqlalchemy_repositories.py`)

---

## 2. MovementRepository (Port)

**Ort:** `app/contracts/repositories.py`

### Verantwortung
Persistenz von Lagerbewegungen (Movements).

### Methoden (Signaturen)

- `list() -> list[Movement]`
- `get(movement_id: str) -> Movement | None`
- `add(movement: Movement) -> Movement`
- `update(movement: Movement) -> Movement`
- `delete(movement_id: str) -> bool`
- `next_id() -> str`

### Referenz-Implementierung
- `SqlAlchemyMovementRepository` (`app/adapters/sqlalchemy_repositories.py`)

---

## 3. Weitere Persistenz-Ports

### SupplierRepository

- `list() -> list[Supplier]`
- `get(supplier_id: str) -> Supplier | None`
- `add(supplier: Supplier) -> Supplier`
- `next_id() -> str`

### PurchaseOrderRepository

- `list() -> list[PurchaseOrder]`
- `get(order_id: str) -> PurchaseOrder | None`
- `add(order: PurchaseOrder) -> PurchaseOrder`
- `update(order: PurchaseOrder) -> PurchaseOrder`

### IncomingDeliveryRepository

- `list() -> list[IncomingDelivery]`
- `get(delivery_id: str) -> IncomingDelivery | None`
- `add(delivery: IncomingDelivery) -> IncomingDelivery`
- `delete(delivery_id: str) -> bool`

### BookSupplierLinkRepository

- `get_for(book_id: str, supplier_id: str) -> BookSupplierLink | None`
- `primary_for(book_id: str) -> BookSupplierLink | None`
- `upsert(link: BookSupplierLink) -> BookSupplierLink`
- `delete_for_book(book_id: str) -> int`
- `stock_for_supplier(supplier_id: str) -> list[SupplierStockEntry]`

### UnitOfWork

- stellt `books`, `movements`, `suppliers`, `purchase_orders`, `incoming_deliveries`, `book_supplier_links` bereit
- `commit() -> None`
- `rollback() -> None`
- `flush() -> None`

Referenz-Implementierung:
- `SqlAlchemyUnitOfWork` (`app/adapters/sqlalchemy_repositories.py`)

---

## 4. Services (Use-Case Contracts)

Services sind keine “Ports” im strengen Sinn, aber die **stabile API** innerhalb des Backends.

### BooksService

**Ort:** `app/services/books.py`

- `list_books()`
- `get_book(book_id)`
- `create_book(book)`
- `update_book(book_id, book)`
- `delete_book(book_id)`

Wichtig:
- synchronisiert `books.supplier_id` mit `book_suppliers`
- verwendet Domain-Modelle statt direkt Pydantic-Schemas

### InventoryService

**Ort:** `app/services/inventory.py`

#### `create_movement(movement: MovementSchema) -> Movement`

**Regeln/Validierung:**
- `movement_type` muss in `{IN, OUT, CORRECTION}` sein (case-insensitive)
- OUT führt zu negativer Delta-Menge
- Bestand darf nicht negativ werden
- Beim Anlegen einer Bewegung wird der zugehörige `Book.quantity` atomar angepasst

**Wichtig:** `update_movement` / `delete_movement` sind vor Release bewusst **gesperrt**.
Historische Lagerbewegungen dürfen nicht nachträglich verändert oder gelöscht werden.
Korrekturen sollen über ausgleichende Gegenbewegungen erfolgen.

### SupplierService

**Ort:** `app/services/suppliers.py`

- `list_suppliers()`
- `get_supplier(supplier_id)`
- `create_supplier(supplier)`
- `list_purchase_orders()`
- `create_purchase_order(order)`
- `receive_purchase_order(order_id, quantity)`
- `list_incoming_deliveries()`
- `book_incoming_delivery(delivery_id, performed_by)`
- `get_supplier_stock(supplier_id)`
- `order_from_supplier(supplier_id, order_data)`

Wichtig:
- `create_purchase_order` validiert `supplier_id` und `book_id` gegen den aktuellen Bestand
- `book_incoming_delivery` erhöht Bestand, aktualisiert Einkaufspreis/Lieferant und erzeugt zusätzlich eine `IN`-Bewegung
- `order_from_supplier(...)` ist vor Release bewusst deaktiviert; verbindlicher Beschaffungsweg ist `purchase_orders -> receive -> incoming_deliveries -> book`

---

## 5. Datenmodelle (DB + API)

### SQLAlchemy Models (DB)
**Ort:** `src1/backend/app/db/models.py`

- `Book`
- `Movement`
- `Supplier`
- `BookSupplier`
- `PurchaseOrder`
- `IncomingDelivery`

### Pydantic Schemas (API Payloads)
**Ort:** `src1/backend/app/db/schemas.py`

- `BookSchema`
- `MovementSchema`
- `SupplierSchema`
- `PurchaseOrderSchema`
- `IncomingDeliverySchema`

#### Payload-Hinweise

- `BookSchema` akzeptiert fuer Preis- und Lieferantenfelder sowohl `snake_case`
  (`purchase_price`, `sell_price`, `supplier_id`) als auch die im Frontend
  verwendeten `camelCase`-Varianten (`purchasePrice`, `sellingPrice`, `supplierId`).
- Damit bleibt der HTTP-Contract fuer bestehende UI-Komponenten rueckwaertskompatibel.
- Die Schemas validieren inzwischen auch Pflichtfelder, Mengen, Preise, Statuswerte und ISO-Zeitstempel strenger.

#### Bestell- und Wareneingangs-Contract

- `GET /purchase-orders` liefert offene und historische Bestellungen aus der DB
- `POST /purchase-orders` legt Bestellungen persistent in `purchase_orders` an
- `POST /purchase-orders/{order_id}/receive` erzeugt einen persistenten Wareneingang in `incoming_deliveries`
- `GET /incoming-deliveries` listet noch nicht eingebuchte Lieferungen
- `POST /incoming-deliveries/{delivery_id}/book` bucht Wareneingang ins Lager und erzeugt eine `IN`-Bewegung

#### Struktur-Hinweise

- `books.supplier_id` bleibt als primaerer/zuletzt genutzter Lieferant fuer bestehende UI-Flows erhalten
- `book_suppliers` bildet die professionelle N:M-Zuordnung `Buch <-> Lieferant` ab
- Geldfelder sind als numerische Werte mit Nicht-Negativ-Checks modelliert
- Wichtige Fremdschluessel-Spalten besitzen zusaetzliche Indizes

---

## Versionshistorie der Contracts

### v0.7 (2026-04-23)
- Doku an tatsächliche Port-Signaturen (`add/update`, `next_id`, `UnitOfWork`) angepasst
- Supplier-, Purchase-Order-, Incoming-Delivery- und Book-Supplier-Link-Ports ergänzt
- Hinweise auf Bestands-Synchronisation und direkte Lagerbuchungen ergänzt
- direkte Lieferanten-Sofortbuchung fachlich deaktiviert und Gegenbewegungs-Regel für Movements dokumentiert

### v0.2 (2026-04-10)
- Einführung `app/contracts/*` als Ports
- SQLAlchemy Repositories als Adapter
- Services als klare Use-Case Schicht

### v0.3 (2026-04-18)
- `BookSchema` fuer Frontend/Backend-Integration toleranter gemacht
- Dokumentation des Feld-Mappings fuer UI-Clients ergänzt

### v0.4 (2026-04-18)
- Persistente Contracts fuer Bestellungen und Wareneingang ergänzt
- DB-gestützten Ablauf `purchase_orders -> incoming_deliveries -> movements/books` dokumentiert

### v0.5 (2026-04-18)
- N:M-Modell `book_suppliers` fuer Mehrfach-Lieferanten ergänzt
- Kern-Tabellen mit staerkeren Constraints und Indizes abgesichert

### v0.6 (2026-04-19)
- Request-Validierung in `schemas.py` deutlich ausgebaut
- UTC-ISO-Zeitstempel im Backend vereinheitlicht
- Lieferanten-, Bestell- und Wareneingangslogik in `SupplierService` gebündelt
