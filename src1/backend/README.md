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

### Tests

This repo ships a stdlib-only schema test.

```bash
python -m unittest -q tests.test_sqlite_schema
```

Optional: service tests require `sqlalchemy` installed (included in `.[dev]`).

```bash
python -m unittest -q tests.test_inventory_service tests.test_supplier_service
```
