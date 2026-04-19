from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Buchhandlungsverwaltung"
    database_url: str = "sqlite:///./buchhandlung.db"
    admin_api_key: str = "dev-key-123"  # Change in production!

    class Config:
        env_file = ".env"


settings = Settings()
