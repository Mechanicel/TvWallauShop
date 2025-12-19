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

    # Tagging
    TAG_MODE: str = os.getenv("TAG_MODE", "free").strip().lower()  # free | restricted
    TAG_LANG: str = os.getenv("TAG_LANG", "de").strip().lower()    # de | en
    DEBUG: bool = os.getenv("DEBUG", "0").strip() in ("1", "true", "yes", "on")

    # In free-mode: wie viele Tags sollen maximal/minimal rauskommen?
    FREE_TAG_MAX: int = int(os.getenv("FREE_TAG_MAX", "8"))
    FREE_TAG_MIN: int = int(os.getenv("FREE_TAG_MIN", "5"))

    # Optional: wenn du später restricted willst
    ALLOWED_TAGS_PATH: str = os.getenv("ALLOWED_TAGS_PATH", "models/allowed_tags.txt")

    # Model
    # FashionCLIP (Transformers)
    CLIP_MODEL_NAME: str = os.getenv("CLIP_MODEL_NAME", "patrickjohncyh/fashion-clip")
    CLIP_DEVICE: str = os.getenv("CLIP_DEVICE", "cpu")  # cpu | cuda (wenn verfügbar)
    REQUEST_TIMEOUT_SEC: float = float(os.getenv("REQUEST_TIMEOUT_SEC", "8"))


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
