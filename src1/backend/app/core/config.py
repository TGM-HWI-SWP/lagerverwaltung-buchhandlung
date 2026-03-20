import sqlite3
from pathlib import Path

from pydantic_settings import BaseSettings

APP_DIR = Path(__file__).resolve().parent.parent  # core/ → app/
DB_DIR = APP_DIR / "db"
SQL_PATH = DB_DIR / "buchhadlung.sql"
DB_PATH = DB_DIR / "buchhandlung.db"


class Settings(BaseSettings):
    app_name: str = "Buchhandlungsverwaltung"
    database_url: str = f"sqlite:///{DB_PATH}"
    use_in_memory_db: bool = False

    class Config:
        env_file = ".env"

    @property
    def effective_database_url(self) -> str:
        if self.use_in_memory_db:
            return "sqlite:///:memory:"
        return self.database_url


settings = Settings()


def init_db():
    """Erstellt die DB aus buchhadlung.sql falls sie noch nicht existiert."""
    if DB_PATH.exists():
        return
    sql = SQL_PATH.read_text(encoding="utf-8")
    conn = sqlite3.connect(str(DB_PATH))
    conn.executescript(sql)
    conn.commit()
    conn.close()

