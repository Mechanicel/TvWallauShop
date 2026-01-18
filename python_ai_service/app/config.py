import os
from functools import lru_cache

from dotenv import load_dotenv

# .env-Datei aus Projektroot laden (wenn vorhanden)
load_dotenv()


class Settings:
    # Server
    AI_SERVICE_HOST: str = os.getenv("AI_SERVICE_HOST", "0.0.0.0")
    AI_SERVICE_PORT: int = int(os.getenv("AI_SERVICE_PORT", "8000"))
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "info")

    # AI pipeline
    AI_DEVICE: str = os.getenv("AI_DEVICE", "openvino:GPU").strip()
    ENABLE_CPU_FALLBACK: bool = os.getenv("ENABLE_CPU_FALLBACK", "0").strip() in (
        "1",
        "true",
        "yes",
        "on",
    )
    MODEL_CACHE_DIR: str = os.getenv("MODEL_CACHE_DIR", "models").strip()

    OV_CLIP_DIR: str = os.getenv("OV_CLIP_DIR", "models/clip").strip()
    OV_CAPTION_DIR: str = os.getenv("OV_CAPTION_DIR", "models/caption").strip()
    OV_LLM_DIR: str = os.getenv("OV_LLM_DIR", "models/llm").strip()

    MAX_TAGS: int = int(os.getenv("MAX_TAGS", "10"))
    MAX_CAPTIONS_PER_IMAGE: int = int(os.getenv("MAX_CAPTIONS_PER_IMAGE", "1"))

    LLM_MAX_NEW_TOKENS: int = int(os.getenv("LLM_MAX_NEW_TOKENS", "220"))
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.4"))

    REQUEST_TIMEOUT_SEC: float = float(os.getenv("REQUEST_TIMEOUT_SEC", "8"))
    DEBUG: bool = os.getenv("DEBUG", "0").strip() in ("1", "true", "yes", "on")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
