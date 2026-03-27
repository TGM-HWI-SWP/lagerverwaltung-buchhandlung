from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Buchhandlungsverwaltung"
    database_url: str = "sqlite:///./buchhandlung.db"

    class Config:
        env_file = ".env"


settings = Settings()

