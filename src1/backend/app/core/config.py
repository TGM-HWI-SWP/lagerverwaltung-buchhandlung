from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Buchhandlungsverwaltung"
    database_url: str = "sqlite:///./buchhandlung.db"
    auth_secret: str = "dev-secret-change-me"  # Used to sign staff tokens
    location_search_url: str = "https://nominatim.openstreetmap.org/search"
    location_user_agent: str = "buchhandlungsverwaltung/1.0"
    location_search_timeout_seconds: int = 3

    class Config:
        env_file = ".env"


settings = Settings()
