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
- `create(book: BookSchema) -> Book`
- `update(book_id: str, book: BookSchema) -> Book | None`
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
- `create(movement: MovementSchema) -> Movement`
- `update(movement_id: str, movement: MovementSchema) -> Movement | None`
- `delete(movement_id: str) -> bool`

### Referenz-Implementierung
- `SqlAlchemyMovementRepository` (`app/adapters/sqlalchemy_repositories.py`)

---

## 3. Services (Use-Case Contracts)

Services sind keine “Ports” im strengen Sinn, aber die **stabile API** innerhalb des Backends.

### BooksService

**Ort:** `app/services/books.py`

- `list_books()`
- `get_book(book_id)`
- `create_book(book)`
- `update_book(book_id, book)`
- `delete_book(book_id)`

### InventoryService

**Ort:** `app/services/inventory.py`

#### `create_movement(movement: MovementSchema) -> Movement`

**Regeln/Validierung:**
- `movement_type` muss in `{IN, OUT, CORRECTION}` sein (case-insensitive)
- OUT führt zu negativer Delta-Menge
- Bestand darf nicht negativ werden
- Beim Anlegen einer Bewegung wird der zugehörige `Book.quantity` atomar angepasst

**Wichtig:** `update_movement` / `delete_movement` passen aktuell den Bestand **nicht** rückwirkend an.
Wenn das fachlich benötigt ist, wird ein “compensating movements” Ansatz empfohlen.

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

---

## 4. Datenmodelle (DB + API)

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
