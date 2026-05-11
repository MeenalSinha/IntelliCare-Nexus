"""
Core configuration module for IntelliCare Nexus backend.
Loads all settings from environment variables with sensible defaults.
"""
from functools import lru_cache
from typing import List
from pydantic_settings import BaseSettings
from pydantic import AnyHttpUrl, field_validator


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "IntelliCare Nexus"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"

    # Security
    SECRET_KEY: str = "dev_secret_key_change_in_production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ALGORITHM: str = "HS256"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://intellicare:intellicare_dev@localhost:5432/intellicare"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Vector DB
    CHROMA_URL: str = "http://localhost:8001"
    CHROMA_COLLECTION: str = "intellicare_docs"

    # AI / LLM
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash-exp"
    GEMINI_PRO_MODEL: str = "gemini-2.0-flash-exp"

    # FHIR
    FHIR_SERVER_URL: str = "https://hapi.fhir.org/baseR4"

    # Clinical Trials API
    CLINICAL_TRIALS_API_URL: str = "https://clinicaltrials.gov/api/v2"

    # CORS
    CORS_ORIGINS: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
