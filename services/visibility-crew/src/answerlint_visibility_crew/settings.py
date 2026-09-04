from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="ANSWERLINT_CREW_",
        extra="ignore",
    )

    signing_secret: str = Field(min_length=32)
    key_id: str = Field(default="primary", min_length=1, max_length=64)
    llm_model: str = Field(default="openai/gpt-5-mini", min_length=3, max_length=200)
    llm_api_key: str = Field(min_length=1)
    llm_base_url: str | None = None
    temperature: float = Field(default=0, ge=0, le=1)
    max_tokens: int = Field(default=5000, ge=500, le=12000)
    allowed_hosts: Annotated[tuple[str, ...], NoDecode] = ("localhost", "127.0.0.1")
    max_body_bytes: int = Field(default=524_288, ge=16_384, le=1_048_576)
    max_concurrency: int = Field(default=2, ge=1, le=16)
    signature_ttl_seconds: int = Field(default=300, ge=30, le=900)
    request_timeout_seconds: int = Field(default=90, ge=10, le=300)
    log_level: str = "INFO"
    storage_dir: str = "/tmp/answerlint-crewai"

    @field_validator("allowed_hosts", mode="before")
    @classmethod
    def parse_hosts(cls, value: object) -> object:
        if isinstance(value, str):
            return tuple(host.strip() for host in value.split(",") if host.strip())
        return value

    @field_validator("llm_base_url")
    @classmethod
    def normalize_base_url(cls, value: str | None) -> str | None:
        normalized = value.strip() if value else ""
        return normalized or None

    @field_validator("storage_dir")
    @classmethod
    def validate_storage_dir(cls, value: str) -> str:
        path = Path(value).expanduser().resolve()
        if not path.is_absolute():
            raise ValueError("storage_dir must be absolute")
        return str(path)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
