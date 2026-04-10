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

---

## 4. Datenmodelle (DB + API)

### SQLAlchemy Models (DB)
**Ort:** `src1/backend/app/db/models.py`

- `Book`
- `Movement`

### Pydantic Schemas (API Payloads)
**Ort:** `src1/backend/app/db/schemas.py`

- `BookSchema`
- `MovementSchema`

---

## Versionshistorie der Contracts

### v0.2 (2026-04-10)
- Einführung `app/contracts/*` als Ports
- SQLAlchemy Repositories als Adapter
- Services als klare Use-Case Schicht