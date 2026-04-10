# Lagerverwaltung – Buchhandlung (FastAPI + React)

Dieses Repository implementiert eine einfache **Buchhandlungs-Lagerverwaltung**:

- **Backend**: FastAPI + SQLAlchemy + SQLite (`src1/backend/`)
- **Frontend**: Vite + React (`src1/frontend/`)

Die Doku unter `docs/` ist auf das aktuelle `src1/` Setup angepasst.

## Quickstart (Docker)

Voraussetzung: Docker Desktop.

```bash
docker compose up --build
```

- Backend: `http://localhost:8000` (OpenAPI: `http://localhost:8000/docs`)
- Frontend: `http://localhost:5173`

## Lokales Setup (ohne Docker)

### Backend

Voraussetzung: Python >= 3.11

```bash
cd src1/backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -e .
uvicorn app.main:app --reload --port 8000
```

### Frontend

Voraussetzung: Node.js (LTS empfohlen)

```bash
cd src1/frontend
npm install
npm run dev
```

## Architektur (Backend)

Das Backend folgt einer pragmatischen Port-Adapter-Struktur:

- **HTTP/API Layer**: `app/main.py` + `app/api/*` (dünn)
- **Services (Use-Cases)**: `app/services/*` (fachliche Regeln)
- **Contracts (Ports)**: `app/contracts/*` (Interfaces/Protocols)
- **Adapters**: `app/adapters/*` (SQLAlchemy-Repositories)
- **DB**: `app/db/*` (Models/Schemas/Session)

Details siehe `docs/architecture.md` und `docs/contracts.md`.

## API – wichtigste Endpunkte

- **Books**
  - `GET /books`
  - `GET /books/{book_id}`
  - `POST /books`
  - `PUT /books/{book_id}`
  - `DELETE /books/{book_id}`

- **Movements**
  - `GET /movements`
  - `GET /movements/{movement_id}`
  - `POST /movements`
  - `PUT /movements/{movement_id}`
  - `DELETE /movements/{movement_id}`

- **Inventory**
  - `GET /inventory` (Summary: Titel, Einheiten, Low-Stock Liste)

## Tests

Siehe `docs/tests.md`.

## Dokumentation

- `docs/architecture.md` – Architektur
- `docs/contracts.md` – Contracts/Ports
- `docs/tests.md` – Teststrategie
- `docs/known_issues.md` – bekannte Probleme

## Lizenz

Schulprojekt – TGM
