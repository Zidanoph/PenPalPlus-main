"""Application configuration, loaded from environment / .env."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    secret_key: str = "dev-secret-change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 30

    database_url: str = "sqlite:///./penpal.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173,https://penpalplus-production.up.railway.app"

    delivery_speed_kmh: float = 140.0
    delivery_min_hours: float = 2.0
    delivery_max_hours: float = 168.0
    demo_fast_delivery: bool = False
    demo_delivery_seconds: int = 20

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
