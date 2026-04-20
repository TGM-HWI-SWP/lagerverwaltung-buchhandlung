# Lagerverwaltung Buchhandlung

Buchhandlungsverwaltung mit FastAPI-Backend, React-Frontend und einer einfachen, abgabefesten Startkonfiguration.

Der aktuelle Produktcode liegt unter `src1/`.

- Backend: `src1/backend`
- Frontend: `src1/frontend`
- Dokumentation: `docs/`

## Funktionen

- Buecher, Lagerbestaende und Lieferanten verwalten
- Lagerbewegungen buchen
- Bestellungen und Wareneingaenge abwickeln
- Verkaeufe und Retouren erfassen
- Activity-Log fuer nachvollziehbare Aenderungen
- Rollenbasiertes Login fuer Kasse und Admin
- PDF- und CSV-Exporte

## Stack

- Backend: FastAPI, SQLAlchemy, Pydantic v2
- Datenbank:
  - lokal standardmaessig SQLite
  - in Docker Compose PostgreSQL 16
- Frontend: React, Vite, TypeScript, TailwindCSS, Recharts

## Schnellstart

### Docker Compose

```bash
docker compose up --build
```

Danach erreichbar:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- API-Doku: `http://localhost:8000/docs`

Compose startet PostgreSQL mit Healthcheck; das Backend wartet auf eine bereite DB.

### Lokal

Backend:

```bash
cd src1/backend
python -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

Das Backend verwendet lokal ohne weitere Konfiguration automatisch `sqlite:///./buchhandlung.db`.
Eine Beispiel-Konfiguration liegt in [src1/backend/.env.example](/home/smooth/code-projects/lagerverwaltung-buchhandlung/src1/backend/.env.example).

Frontend:

```bash
cd src1/frontend
npm install
npm run dev
```

## Architektur

Das Backend bleibt absichtlich einfach:

- `app/main.py`: FastAPI-App und HTTP-Endpunkte
- `app/services/`: Fachlogik
- `app/api/`: duenne API-Helfer
- `app/contracts/` und `app/adapters/`: saubere Repository-Grenzen
- `app/core/bootstrap.py`: DB-Initialisierung, SQLite-Kompatibilitaet und Start-Health
- `app/db/`: Modelle, Schemas, Session und Seed-SQL

Wichtige Stabilitaetsentscheidungen:

- lokale Standard-DB ist SQLite, damit der Start fuer Mitschueler einfach bleibt
- Docker Compose nutzt PostgreSQL fuer einen robusteren Demo-/Abgabestand
- Health-Endpoint prueft auch die DB-Verbindung
- das Backend startet in Docker ohne `--reload`, damit Startup und DB-Bootstrap nur einmal laufen

## Wichtige Endpunkte

- `GET /health`
- `POST /auth/bootstrap-admin`
- `POST /auth/cashier-login`
- `POST /auth/admin-login`
- `GET /books`
- `GET /movements`
- `GET /suppliers`
- `GET /purchase-orders`
- `GET /incoming-deliveries`
- `GET /activity-logs`
- `GET /reports/inventory-pdf`
- `GET /export/books`
- `GET /export/movements`
- `GET /export/purchase-orders`

## Tests

Vom Repo-Root:

```bash
python -m unittest -q src1.backend.tests.test_sqlite_schema
```

Oder aus dem Backend-Ordner:

```bash
cd src1/backend
python -m unittest -q tests.test_sqlite_schema
```

Der Test prueft das frische SQLite-Schema, Seed-Daten und wichtige Constraints.

## Dokumentation

- [src1/README_src1.md](/home/smooth/code-projects/lagerverwaltung-buchhandlung/src1/README_src1.md)
- [src1/backend/README.md](/home/smooth/code-projects/lagerverwaltung-buchhandlung/src1/backend/README.md)
- [docs/architecture.md](/home/smooth/code-projects/lagerverwaltung-buchhandlung/docs/architecture.md)
- [docs/contracts.md](/home/smooth/code-projects/lagerverwaltung-buchhandlung/docs/contracts.md)
- [docs/tests.md](/home/smooth/code-projects/lagerverwaltung-buchhandlung/docs/tests.md)

## Lizenz

Schulprojekt im Rahmen der TGM.
