from __future__ import annotations

from pathlib import Path

from sqlalchemy import inspect, text

from app.core.migrations import ensure_schema
from app.db import models_auth, models_commerce  # noqa: F401
from app.db.models import Base  # noqa: F401
from app.db.session import engine


def _seed_sqlite_database() -> None:
    if engine.url.get_backend_name() != "sqlite":
        return

    sql_file = Path(__file__).resolve().parents[1] / "db" / "buchhandlung.sql"
    if not sql_file.exists():
        return

    with engine.begin() as conn:
        inspector = inspect(conn)
        if "catalog_products" not in inspector.get_table_names():
            return
        product_count = conn.execute(text("SELECT COUNT(*) FROM catalog_products")).scalar()
        if product_count and int(product_count) > 0:
            return

        sql = sql_file.read_text(encoding="utf-8")
        for statement in sql.split(";"):
            stmt = statement.strip()
            if stmt:
                conn.execute(text(stmt))


def initialize_application() -> None:
    Base.metadata.create_all(bind=engine)
    ensure_schema()
    _seed_sqlite_database()


def get_database_health() -> dict[str, str | bool]:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"ok": True, "dialect": engine.url.get_backend_name()}
    except Exception as exc:  # pragma: no cover
        return {"ok": False, "dialect": engine.url.get_backend_name(), "error": str(exc)}
