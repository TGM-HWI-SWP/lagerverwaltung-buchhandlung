# Lagerverwaltung Buchhandlung

Eine kleine Buchhandlungsverwaltung mit FastAPI-Backend, SQLite-Datenbank und React-Frontend.

Der aktuelle Produktcode liegt unter `src1/`.

- Backend: `src1/backend`
- Frontend: `src1/frontend`
- Dokumentation: `docs/`

## Überblick

Die Anwendung deckt die wichtigsten Abläufe einer Buchhandlung ab:

- Bücher verwalten
- Lagerbestand einsehen
- Lagerbewegungen buchen
- Lieferanten verwalten
- Bestellungen erfassen
- Wareneingänge einbuchen
- Verkäufe und Retouren erfassen
- einfachen PDF-Report erzeugen

Technischer Stack:

- Backend: FastAPI, SQLAlchemy 2.0, SQLite, Pydantic v2
- Frontend: React, Vite, TypeScript, TailwindCSS, Recharts
- Diagramme/UI: Recharts, Lucide Icons

## Neue Features (seit v0.4)

- **Pagination** für alle List-Endpoints (`/books`, `/movements`, `/suppliers`, `/purchase-orders`, `/incoming-deliveries`) mit `offset`/`limit` Query-Parametern
- **Activity Log** (`/activity-logs`) – Audit-Trail für alle Aktionen (CREATE, UPDATE, DELETE, Bestellungen, Lieferungen)
- **API-Key-Authentifizierung** – Schreib-Endpoints benötigen einen API-Key (Header `X-API-Key`), Standard: `dev-key-123`
- **CSV-Export** – Bücher, Bewegungen und Bestellungen können als CSV heruntergeladen werden (`/export/books`, `/export/movements`, `/export/purchase-orders`)
- **Frontend-Refactoring** – `App.tsx` wurde in feature-basierte Komponenten aufgeteilt (`features/inventory`, `features/ordering`, `features/sales`, etc.)
- **Einstellungen** – API-Key kann im Frontend unter "Einstellungen" gesetzt werden (wird im localStorage gespeichert)

## Projektstruktur

```text
.
├── src1/
│   ├── backend/
│   │   ├── app/
│   │   │   ├── core/         # Config/Auth/Errors/Time
│   │   │   ├── api/
│   │   │   ├── adapters/
│   │   │   ├── contracts/
│   │   │   ├── db/
│   │   │   └── services/
│   │   └── tests/
│   └── frontend/
│       ├── src/
│       │   ├── features/     # Pages (Dashboard, Lager, Verkauf, ...)
│       │   ├── components/
│       │   └── api/
│       └── vite.config.ts
├── docs/
└── docker-compose.yml
```

## Quickstart

### Mit Docker

Voraussetzung: Docker Desktop oder eine lokale Docker-/Compose-Installation

```bash
docker compose up --build
```

Danach erreichbar:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- OpenAPI Docs: `http://localhost:8000/docs`

### Lokal ohne Docker

#### Backend starten

Voraussetzung: Python 3.11 oder neuer

```bash
cd src1/backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

`pip install -e ".[dev]"` installiert Backend + Dev-Tools (z. B. `pytest`, `httpx`).

#### Frontend starten

Voraussetzung: Node.js LTS

```bash
cd src1/frontend
npm install
npm run dev
```

## Architektur

Das Backend verwendet eine einfache Port-Adapter-Struktur:

- `app/main.py`
  FastAPI-App und HTTP-Endpunkte
- `app/api/`
  dünne API-Schicht
- `app/services/`
  fachliche Logik und Regeln
- `app/contracts/`
  Ports/Interfaces
- `app/adapters/`
  SQLAlchemy-Repositories und Persistenzanbindung
- `app/db/`
  SQLAlchemy-Modelle, Pydantic-Schemas, Session und Seed-SQL

Zusätzlich wurden in der aktuellen Version folgende Dinge verbessert:

- stärkere Request-Validierung über Pydantic v2
- konsistentere UTC-ISO-Zeitstempel im Backend
- Lieferanten-, Bestell- und Wareneingangslogik stärker in Services gebündelt

Mehr Details:

- [docs/architecture.md](/home/smooth/code-projects/lagerverwaltung-buchhandlung/docs/architecture.md)
- [docs/contracts.md](/home/smooth/code-projects/lagerverwaltung-buchhandlung/docs/contracts.md)

## Datenmodell

Die wichtigsten Tabellen sind:

- `books`
- `suppliers`
- `book_suppliers`
- `movements`
- `purchase_orders`
- `incoming_deliveries`

Wichtig:

- `books.supplier_id` bleibt für bestehende UI-Flows als primärer oder zuletzt genutzter Lieferant erhalten
- `book_suppliers` bildet die eigentliche N:M-Zuordnung zwischen Büchern und Lieferanten ab
- Bestellungen und Wareneingänge werden persistent in der Datenbank gespeichert

Das Seed-SQL liegt in:

- [src1/backend/app/db/buchhandlung.sql](/home/smooth/code-projects/lagerverwaltung-buchhandlung/src1/backend/app/db/buchhandlung.sql)

## Wichtige Endpunkte

### Bücher

- `GET /books?offset=0&limit=50`
- `GET /books/{book_id}`
- `POST /books` (benötigt API-Key)
- `PUT /books/{book_id}` (benötigt API-Key)
- `DELETE /books/{book_id}` (benötigt API-Key)

### Lagerbewegungen

- `GET /movements?offset=0&limit=50`
- `GET /movements/{movement_id}`
- `POST /movements` (benötigt API-Key)
- `PUT /movements/{movement_id}` (benötigt API-Key, liefert `409` – Movements sind unveränderlich)
- `DELETE /movements/{movement_id}` (benötigt API-Key, liefert `409` – Movements sind unveränderlich)

### Inventar und Reports

- `GET /inventory`
- `GET /reports/inventory-pdf`
- `GET /export/books` (CSV)
- `GET /export/movements` (CSV)
- `GET /export/purchase-orders` (CSV)

### Lieferanten

- `GET /suppliers?offset=0&limit=50`
- `GET /suppliers/{supplier_id}`
- `POST /suppliers` (benötigt API-Key)
- `GET /suppliers/{supplier_id}/stock`
- `POST /suppliers/{supplier_id}/order` (benötigt API-Key)

### Bestellungen und Wareneingänge

- `GET /purchase-orders?offset=0&limit=50`
- `POST /purchase-orders` (benötigt API-Key)
- `POST /purchase-orders/{order_id}/receive` (benötigt API-Key)
- `GET /incoming-deliveries?offset=0&limit=50`
- `POST /incoming-deliveries/{delivery_id}/book` (benötigt API-Key)

### Aktivitäts-Log

- `GET /activity-logs?offset=0&limit=50&entity_type=book&entity_id=B001&performed_by=system`

## Tests

Der neue Backend-Schematest läuft ohne zusätzliche Test-Tools mit `unittest`.

Vom Repo-Root:

```bash
python -m unittest -q src1.backend.tests.test_sqlite_schema
```

Oder aus dem Backend-Ordner:

```bash
cd src1/backend
python -m unittest -q tests.test_sqlite_schema
```

Der Test prüft unter anderem:

- frisches Erzeugen des SQLite-Schemas
- Seed-Daten
- `book_suppliers` für Mehrfach-Lieferanten
- wichtige Constraints

Weitere Hinweise:

- [docs/tests.md](/home/smooth/code-projects/lagerverwaltung-buchhandlung/docs/tests.md)

## Entwicklungshinweise

- Der produktive Projektstand liegt in `src1/`
- Für neue Produktarbeit sollte in der Regel nur unter `src1/` gearbeitet werden

## Dokumentation

- [docs/architecture.md](/home/smooth/code-projects/lagerverwaltung-buchhandlung/docs/architecture.md)
- [docs/contracts.md](/home/smooth/code-projects/lagerverwaltung-buchhandlung/docs/contracts.md)
- [docs/tests.md](/home/smooth/code-projects/lagerverwaltung-buchhandlung/docs/tests.md)
- [docs/known_issues.md](/home/smooth/code-projects/lagerverwaltung-buchhandlung/docs/known_issues.md)
- [docs/changelog_kattner.md](/home/smooth/code-projects/lagerverwaltung-buchhandlung/docs/changelog_kattner.md)

## Lizenz

Schulprojekt im Rahmen der TGM.
