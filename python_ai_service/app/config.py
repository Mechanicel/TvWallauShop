import os
from typing import Literal
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
    AI_DEVICE_CLIP: str = os.getenv("AI_DEVICE_CLIP", "openvino:GPU").strip()
    AI_DEVICE_BLIP: str = os.getenv("AI_DEVICE_BLIP", "openvino:GPU").strip()
    AI_DEVICE_LLM: str = os.getenv("AI_DEVICE_LLM", "openvino:NPU").strip()
    AI_DEVICE_STRICT: bool = os.getenv("AI_DEVICE_STRICT", "1").strip() in (
        "1",
        "true",
        "yes",
        "on",
    )
    ENABLE_CPU_FALLBACK: bool = os.getenv("ENABLE_CPU_FALLBACK", "0").strip() in (
        "1",
        "true",
        "yes",
        "on",
    )
    MODEL_DIR: str = os.getenv("MODEL_DIR", "models").strip()
    MODEL_CACHE_DIR: str = os.getenv("MODEL_CACHE_DIR", MODEL_DIR).strip()
    OFFLINE: bool = os.getenv("OFFLINE", "0").strip() in ("1", "true", "yes", "on")
    MODEL_FETCH_MODE: str = os.getenv("MODEL_FETCH_MODE", "never").strip()

    OV_CLIP_DIR: str = os.getenv("OV_CLIP_DIR", f"{MODEL_DIR}/clip").strip()
    OV_CAPTION_DIR: str = os.getenv("OV_CAPTION_DIR", f"{MODEL_DIR}/caption").strip()
    OV_LLM_DIR: str = os.getenv("OV_LLM_DIR", f"{MODEL_DIR}/llm").strip()
    CLIP_SOURCE: str = os.getenv("CLIP_SOURCE", "hf_export").strip()
    CAPTION_HF_ID: str = os.getenv(
        "CAPTION_HF_ID", "Salesforce/blip-image-captioning-base"
    ).strip()
    LLM_SOURCE: Literal["prebuilt_ov_ir", "hf_export"] = os.getenv(
        "LLM_SOURCE", "prebuilt_ov_ir"
    ).strip()
    LLM_HF_ID: str = os.getenv("LLM_HF_ID", "Qwen/Qwen2.5-3B-Instruct").strip()
    LLM_HF_OV_REPO: str = os.getenv(
        "LLM_HF_OV_REPO", "llmware/qwen2.5-3b-instruct-ov"
    ).strip()
    LLM_REVISION: str | None = os.getenv("LLM_REVISION") or None

    MAX_TAGS: int = int(os.getenv("MAX_TAGS", "10"))
    MAX_CAPTIONS_PER_IMAGE: int = int(os.getenv("MAX_CAPTIONS_PER_IMAGE", "1"))

    LLM_MAX_NEW_TOKENS: int = int(os.getenv("LLM_MAX_NEW_TOKENS", "220"))
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.4"))

    REQUEST_TIMEOUT_SEC: float = float(os.getenv("REQUEST_TIMEOUT_SEC", "8"))
    DEBUG: bool = os.getenv("DEBUG", "0").strip() in ("1", "true", "yes", "on")

    DEBUG_AI: bool = os.getenv("DEBUG_AI", "0").strip() in ("1", "true", "yes", "on")
    DEBUG_AI_INCLUDE_PROMPT: bool = os.getenv("DEBUG_AI_INCLUDE_PROMPT", "0").strip() in (
        "1",
        "true",
        "yes",
        "on",
    )
    DEBUG_AI_MAX_TAGS_LOG: int = int(os.getenv("DEBUG_AI_MAX_TAGS_LOG", "50"))
    DEBUG_AI_MAX_CHARS: int = int(os.getenv("DEBUG_AI_MAX_CHARS", "6000"))
    DEBUG_AI_RESPONSE: bool = os.getenv("DEBUG_AI_RESPONSE", "1").strip() in (
        "1",
        "true",
        "yes",
        "on",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
