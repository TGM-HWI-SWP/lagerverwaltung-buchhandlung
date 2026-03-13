from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Buchhandlungsverwaltung"
    # Standard: PostgreSQL (z.B. aus docker-compose)
    database_url: str = "postgresql+psycopg2://app:app@db:5432/buchhandlung"
    # Optional: In-Memory-SQLite als Fallback (z.B. für schnelle Tests)
    use_in_memory_db: bool = False

    class Config:
        env_file = ".env"

    @property
    def effective_database_url(self) -> str:
        """
        Liefert die tatsächlich zu verwendende DB-URL.
        Wenn USE_IN_MEMORY_DB=true gesetzt ist, wird eine In-Memory-SQLite-DB genutzt.
        """
        if self.use_in_memory_db:
            return "sqlite:///:memory:"
        return self.database_url


settings = Settings()

