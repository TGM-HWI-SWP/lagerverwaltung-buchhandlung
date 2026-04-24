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

- Backend: FastAPI, SQLAlchemy, SQLite
- Frontend: React, Vite, TypeScript
- Diagramme/UI: Recharts, Tailwind

## Projektstruktur

```text
.
├── src1/
│   ├── backend/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   ├── adapters/
│   │   │   ├── contracts/
│   │   │   ├── db/
│   │   │   └── services/
│   │   └── tests/
│   └── frontend/
│       └── src/
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
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --port 8000
```

Windows:

```bash
.venv\Scripts\activate
```

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

- [src1/backend/app/db/buchhadlung.sql](/home/smooth/code-projects/lagerverwaltung-buchhandlung/src1/backend/app/db/buchhadlung.sql)

## Wichtige Endpunkte

### Bücher

- `GET /books`
- `GET /books/{book_id}`
- `POST /books`
- `PUT /books/{book_id}`
- `DELETE /books/{book_id}`

### Lagerbewegungen

- `GET /movements`
- `GET /movements/{movement_id}`
- `POST /movements`
- `PUT /movements/{movement_id}`
- `DELETE /movements/{movement_id}`

### Inventar und Reports

- `GET /inventory`
- `GET /reports/inventory-pdf`

### Lieferanten

- `GET /suppliers`
- `GET /suppliers/{supplier_id}`
- `POST /suppliers`
- `GET /suppliers/{supplier_id}/stock`
- `POST /suppliers/{supplier_id}/order`

### Bestellungen und Wareneingänge

- `GET /purchase-orders`
- `POST /purchase-orders`
- `POST /purchase-orders/{order_id}/receive`
- `GET /incoming-deliveries`
- `POST /incoming-deliveries/{delivery_id}/book`

## Tests

Die Backend-Tests laufen mit `unittest` — keine Extra-Installation nötig.

Im laufenden Docker-Container:

```bash
docker compose exec backend python -m unittest -q tests.test_sqlite_schema tests.test_ports_adapters_flow
```


Weitere Hinweise:

- [docs/tests.md](/home/smooth/code-projects/lagerverwaltung-buchhandlung/docs/tests.md)

Die Tests prüfen unter anderem:
- frisches Erzeugen des SQLite-Schemas und der Seed-Daten
- `book_suppliers` für Mehrfach-Lieferanten und wichtige Constraints
- Book-CRUD, Lagerbewegungen mit Bestandsanpassung, Negativbestand-Schutz
- Purchase-Order → Incoming-Delivery → Booking
- gesperrte Pfade (`order_from_supplier`, Movement-Update/Delete)

Weitere Hinweise: [docs/tests.md](docs/tests.md)

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
