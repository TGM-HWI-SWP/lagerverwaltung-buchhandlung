## Backend (FastAPI)

### Setup (venv)

```bash
cd src1/backend
python -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -e ".[dev]"
```

### Run

```bash
uvicorn app.main:app --reload --port 8000
```

Standardmaessig verwendet das Backend lokal eine SQLite-Datei `buchhandlung.db` im Backend-Ordner.
Fuer Docker Compose wird automatisch PostgreSQL verwendet.

### Tests

This repo ships a stdlib-only schema test.

```bash
python -m unittest -q tests.test_sqlite_schema
```
