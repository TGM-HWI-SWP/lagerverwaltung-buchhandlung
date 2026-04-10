# Architektur-Dokumentation

## Architektur-Übersicht

Dieses Repository enthält eine kleine **Buchhandlungs-Lagerverwaltung** mit:

- **Frontend**: `src1/frontend/` (Vite + React)
- **Backend**: `src1/backend/` (FastAPI + SQLAlchemy + SQLite)

Das Backend ist bewusst so strukturiert, dass die HTTP-Schicht (FastAPI) nur dünn ist
und die fachlichen Regeln in Services liegen. Persistenzdetails werden über
Contracts/Adapters gekapselt (Port-Adapter/Hexagonal-Style, pragmatisch umgesetzt).

## Backend-Schichten (FastAPI)

```
┌──────────────────────────────────────────────────────────────┐
│                 HTTP / API Layer (FastAPI)                    │
│  app/main.py (Routes) + app/api/* (thin orchestration)        │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                    Service Layer (Use-Cases)                  │
│   app/services/*  (z.B. InventoryService mit Stock-Regeln)    │
└──────────────────────────────┬───────────────────────────────┘
                               │
┌───────────────┬──────────────▼───────────────────┬───────────┐
│  Contracts     │                                  │  Adapters │
│  (Ports)       │                                  │  (Impl.)  │
│  app/contracts │                                  │ app/adapters
│  Protocols     │◄────────────────────────────────►│ SQLAlchemy
└───────────────┴───────────────────────────────────┴───────────┘
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                        Persistence                            │
│     app/db/models.py (SQLAlchemy) + SQLite (default)          │
└──────────────────────────────────────────────────────────────┘
```

## Wichtige Module (Backend)

### `app/main.py`

- Erstellt die FastAPI-App
- Seed/Schema-Init für SQLite
- Definiert die HTTP-Endpunkte `/books`, `/movements`, `/inventory`

### `app/contracts/repositories.py`

- Enthält die **Ports** (Interfaces) für Persistenz:
  - `BookRepository`
  - `MovementRepository`

Diese Interfaces werden von Services genutzt und erlauben es, die Persistenz später
(z.B. andere DB, API, Mock) auszutauschen.

### `app/adapters/sqlalchemy_repositories.py`

- SQLAlchemy-Implementierungen der Ports:
  - `SqlAlchemyBookRepository`
  - `SqlAlchemyMovementRepository`

### `app/services/*`

- `BooksService`: CRUD-Use-Cases für Bücher (delegiert an Repository)
- `InventoryService`: Lagerbewegungen inkl. Regeln (z.B. Bestand darf nicht negativ werden)

## Datenmodell

- `Book`: Stammdaten + `quantity`
- `Movement`: einzelne Lagerbewegung (`IN`, `OUT`, `CORRECTION`)

## Datenfluss (Beispiel: Movement anlegen)

```
POST /movements
  → app/main.py (Endpoint)
  → app/api/inventory.py (thin wrapper)
  → InventoryService.create_movement(...)
  → BookRepository.get(...) + SQLAlchemy Models/Session
  → Commit (Movement + updated Book.quantity)
```

## Roadmap / TODOs

- Router-Struktur weiter aufteilen (FastAPI `APIRouter`)
- Konsistentes Fehler-Handling (eigene Domain-Exceptions → HTTP mapping)
- Update/Deletion von Movements fachlich korrekt lösen (aktuell: kein Bestands-Replay)

---

**Letzte Aktualisierung:** 2026-04-10
