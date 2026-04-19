## `src1/` – Produktcode

In `src1/` liegt der aktuelle Produktcode (Frontend + Backend).

### Backend

- Pfad: `src1/backend`
- Stack: FastAPI, SQLAlchemy, SQLite
- Start (lokal):

```bash
cd src1/backend
python -m venv .venv
source .venv/bin/activate
pip install -U pip
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

Tests (Backend):

```bash
cd src1/backend
source .venv/bin/activate
python -m unittest -q tests.test_sqlite_schema
```

### Frontend

- Pfad: `src1/frontend`
- Stack: Vite, React
- Start (lokal):

```bash
cd src1/frontend
npm install
npm run dev
```

### Docker

Im Repo-Root:

```bash
docker compose up --build
```
