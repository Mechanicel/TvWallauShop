from __future__ import annotations

import os
import re
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()


def _is_true(v: str) -> bool:
    return (v or "").strip().lower() in ("1", "true", "yes", "on")


def _sanitize_model_id(model_id: str) -> str:
    """HuggingFace Model-ID -> sicherer Ordnername."""
    s = (model_id or "").strip().replace("\\", "_").replace("/", "_")
    s = re.sub(r"[^a-zA-Z0-9._-]+", "_", s)
    return s.strip("_ ") or "model"


class Settings:
    # ----------------------------
    # Core Service
    # ----------------------------
    AI_SERVICE_HOST: str = os.getenv("AI_SERVICE_HOST", "0.0.0.0")
    AI_SERVICE_PORT: int = int(os.getenv("AI_SERVICE_PORT", "8000"))
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "info")
    DEBUG: bool = _is_true(os.getenv("DEBUG", "0"))

    # ----------------------------
    # Pipeline / Akku
    # ----------------------------
    ANALYZE_PIPELINE: str = os.getenv("ANALYZE_PIPELINE", "caption")
    STOP_AFTER_CAPTION: bool = _is_true(os.getenv("STOP_AFTER_CAPTION", "1"))
    WARMUP_MODELS: bool = _is_true(os.getenv("WARMUP_MODELS", "0"))

    # ----------------------------
    # Model Store (AUßERHALB Projekt)
    # ----------------------------
    MODEL_STORE_DIR: str = os.getenv(
        "MODEL_STORE_DIR",
        os.path.join(os.path.expanduser("~"), ".cache", "huggingface", "hub", "tvwallau"),
    )

    # ----------------------------
    # Tagging / CLIP
    # ----------------------------
    TAGGING_MODEL_NAME: str = os.getenv("TAGGING_MODEL_NAME", "openai/clip-vit-base-patch32")
    TAGGING_DEVICE: str = os.getenv("TAGGING_DEVICE", "cpu")

    # ----------------------------
    # Captioning
    # ----------------------------
    CAPTION_MODEL_NAME: str = os.getenv("CAPTION_MODEL_NAME", "nlpconnect/vit-gpt2-image-captioning")
    CAPTION_DEVICE: str = os.getenv("CAPTION_DEVICE", "cpu").strip().lower()

    CAPTION_BACKEND: str = os.getenv("CAPTION_BACKEND", "auto").strip().lower()
    OPENVINO_DEVICE: str = os.getenv("OPENVINO_DEVICE", "GPU")

    # WICHTIG: Default-Ordner richtet sich jetzt automatisch nach CAPTION_MODEL_NAME
    CAPTION_OPENVINO_DIR: str = os.getenv(
        "CAPTION_OPENVINO_DIR",
        os.path.join(MODEL_STORE_DIR, "openvino", _sanitize_model_id(CAPTION_MODEL_NAME)),
    )
    CAPTION_OPENVINO_ALLOW_EXPORT: bool = _is_true(os.getenv("CAPTION_OPENVINO_ALLOW_EXPORT", "1"))
    CAPTION_OPENVINO_FORCE_EXPORT: bool = _is_true(os.getenv("CAPTION_OPENVINO_FORCE_EXPORT", "0"))
    OPENVINO_CACHE_DIR: str = os.getenv("OPENVINO_CACHE_DIR", "")

    # Prompt / Generation
    CAPTION_PROMPT_PREFIX: str = os.getenv("CAPTION_PROMPT_PREFIX", "a product photo of")
    CAPTION_USE_DECODER_PROMPT: bool = _is_true(os.getenv("CAPTION_USE_DECODER_PROMPT", "1"))

    CAPTION_MAX_NEW_TOKENS: int = int(os.getenv("CAPTION_MAX_NEW_TOKENS", "24"))
    CAPTION_MIN_NEW_TOKENS: int = int(os.getenv("CAPTION_MIN_NEW_TOKENS", "6"))
    CAPTION_NUM_BEAMS: int = int(os.getenv("CAPTION_NUM_BEAMS", "4"))
    CAPTION_NUM_RETURN_SEQUENCES: int = int(os.getenv("CAPTION_NUM_RETURN_SEQUENCES", "2"))
    CAPTION_DO_SAMPLE: bool = _is_true(os.getenv("CAPTION_DO_SAMPLE", "0"))
    CAPTION_REPETITION_PENALTY: float = float(os.getenv("CAPTION_REPETITION_PENALTY", "1.2"))
    CAPTION_NO_REPEAT_NGRAM_SIZE: int = int(os.getenv("CAPTION_NO_REPEAT_NGRAM_SIZE", "3"))

    CAPTION_HTTP_TIMEOUT: int = int(os.getenv("CAPTION_HTTP_TIMEOUT", "12"))
    CAPTION_HTTP_USER_AGENT: str = os.getenv("CAPTION_HTTP_USER_AGENT", "TvWallauShop-AI/1.0")
    CAPTION_ALLOWED_SCHEMES: str = os.getenv("CAPTION_ALLOWED_SCHEMES", "http,https")
    CAPTION_ALLOW_LOCAL_FILES: bool = _is_true(os.getenv("CAPTION_ALLOW_LOCAL_FILES", "0"))
    CAPTION_ALLOW_PRIVATE_NETWORKS: bool = _is_true(os.getenv("CAPTION_ALLOW_PRIVATE_NETWORKS", "0"))
    CAPTION_ALLOW_PRIVATE_HOSTS: str = os.getenv(
        "CAPTION_ALLOW_PRIVATE_HOSTS",
        "localhost,127.0.0.1,::1,host.docker.internal",
    )
    CAPTION_MAX_IMAGE_BYTES: int = int(os.getenv("CAPTION_MAX_IMAGE_BYTES", str(8 * 1024 * 1024)))
    CAPTION_MAX_IMAGE_PIXELS: int = int(os.getenv("CAPTION_MAX_IMAGE_PIXELS", str(20_000_000)))
    CAPTION_MAX_IMAGES: int = int(os.getenv("CAPTION_MAX_IMAGES", "4"))
    CAPTION_CLEANUP_MAX_SENTENCES: int = int(os.getenv("CAPTION_CLEANUP_MAX_SENTENCES", "2"))
    CAPTION_MERGE_MAX_SENTENCES: int = int(os.getenv("CAPTION_MERGE_MAX_SENTENCES", "3"))
    CAPTION_MERGE_MAX_CHARS: int = int(os.getenv("CAPTION_MERGE_MAX_CHARS", "220"))
    CAPTION_MERGE_SIM_THRESHOLD: float = float(os.getenv("CAPTION_MERGE_SIM_THRESHOLD", "0.85"))

    # Bad words (personen)
    CAPTION_BAD_WORDS: str = os.getenv(
        "CAPTION_BAD_WORDS",
        "woman,women,man,men,person,people,boy,girl,child,kid,young,asian,language,unknown,lady,female,someone",
    )

    # ----------------------------
    # Offline Flags (NUR das steuert Model-Download!)
    # ----------------------------
    HF_HUB_OFFLINE: bool = _is_true(os.getenv("HF_HUB_OFFLINE", "0"))
    TRANSFORMERS_OFFLINE: bool = _is_true(os.getenv("TRANSFORMERS_OFFLINE", "0"))


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
