## `src1/` – Produktcode

In `src1/` liegt der aktuelle Produktcode (Frontend + Backend).

### Backend

- Pfad: `src1/backend`
- Stack: FastAPI, SQLAlchemy, SQLite
- Start (lokal):

```bash
cd src1/backend
pip install -e .
uvicorn app.main:app --reload --port 8000
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

