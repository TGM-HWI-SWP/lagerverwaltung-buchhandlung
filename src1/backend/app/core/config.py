from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Buchhandlungsverwaltung"
    database_url: str = "postgresql+psycopg://buchhandlung:buchhandlung@postgres:5432/buchhandlung"
    admin_api_key: str = "dev-key-123"  # Change in production!
    auth_secret: str = "dev-secret-change-me"  # Used to sign staff tokens

    class Config:
        env_file = ".env"


settings = Settings()
