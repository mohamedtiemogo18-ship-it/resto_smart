"""Configuration de l'application, lue depuis l'environnement."""

from functools import lru_cache
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Application -------------------------------------------------
    APP_NAME: str = "Resto Smart API"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"          # development | staging | production
    API_PREFIX: str = "/api/v1"

    # --- Base de données ---------------------------------------------
    DATABASE_URL: str

    # --- Supabase ----------------------------------------------------
    SUPABASE_URL: str
    SUPABASE_ANON_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str

    # --- QR / anti-fraude --------------------------------------------
    QR_SECRET: str
    QR_SECRET_VERSION: int = 1

    # --- Tickets -----------------------------------------------------
    TICKET_VALIDITY_DAYS: int = 30
    PDF_PER_PAGE: int = 4
    PDF_PAGE_SIZE: str = "A5"
    SIGNED_URL_TTL_SECONDS: int = 300
    STORAGE_BUCKET: str = "tickets"

    # --- Images du PDF (chemins locaux ou Storage) -------------------
    SIGNATURE_IMAGE_PATH: str | None = None
    CACHET_IMAGE_PATH: str | None = None
    RESTO_IDENTITY: dict | None = None

    # --- CORS / tâches planifiées ------------------------------------
    # `NoDecode` : pydantic-settings tenterait sinon un json.loads avant
    # notre validateur, ce qui casse la forme « a.com, b.com ».
    BACKEND_CORS_ORIGINS: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    CRON_SECRET: str | None = None

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def split_origins(cls, v):
        """Accepte une liste, une chaîne JSON ou une liste séparée par virgules."""
        if isinstance(v, str):
            v = v.strip()
            if v.startswith("["):
                import json

                return json.loads(v)
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


settings = get_settings()