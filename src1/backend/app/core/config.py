from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Buchhandlungsverwaltung"
    database_url: str = "sqlite:///./buchhandlung.db"
    auth_secret: str = "dev-secret-change-me"  # Used to sign staff tokens

    class Config:
        env_file = ".env"


settings = Settings()
