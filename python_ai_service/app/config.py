import logging
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv

from .contracts_models import DeviceRouting
from .ov_runtime import normalize_device

# .env-Datei aus Projektroot laden (wenn vorhanden)
_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=_ENV_PATH, override=False)

logger = logging.getLogger("tvwallau-ai")


def _strip_optional_quotes(value: str) -> str:
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
        return value[1:-1].strip()
    return value


def _parse_stop_strings(value: str) -> tuple[str, ...]:
    if not value:
        return ()
    value = _strip_optional_quotes(value)
    stop_strings: list[str] = []
    for item in value.split("|"):
        cleaned = _strip_optional_quotes(item)
        if not cleaned:
            continue
        stop_strings.append(cleaned.replace("\\n", "\n"))
    return tuple(stop_strings)


def _parse_list(value: str) -> tuple[str, ...]:
    if not value:
        return ()
    value = _strip_optional_quotes(value)
    items = re.split(r"[|,]", value)
    cleaned = [_strip_optional_quotes(item).strip() for item in items]
    return tuple([item for item in cleaned if item])


class Settings:
    # Server
    AI_SERVICE_HOST: str = os.getenv("AI_SERVICE_HOST", "0.0.0.0")
    AI_SERVICE_PORT: int = int(os.getenv("AI_SERVICE_PORT", "8000"))
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "info")

    # AI pipeline
    AI_DEVICE: str = os.getenv("AI_DEVICE", "").strip()
    ENABLE_CPU_FALLBACK: bool = os.getenv("ENABLE_CPU_FALLBACK", "0").strip() in (
        "1",
        "true",
        "yes",
        "on",
    )
    MODEL_DIR: str = os.getenv("MODEL_DIR", "models").strip()
    MODEL_CACHE_DIR: str = os.getenv("MODEL_CACHE_DIR", MODEL_DIR).strip()
    OFFLINE: bool = os.getenv("OFFLINE", "1").strip() in ("1", "true", "yes", "on")
    MODEL_FETCH_MODE: str = os.getenv("MODEL_FETCH_MODE", "never").strip()
    OV_CACHE_DIR: str = os.getenv("OV_CACHE_DIR", f"{MODEL_DIR}/.ov_cache").strip()

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
    TAG_SHARED_MIN_RATIO: float = float(os.getenv("TAG_SHARED_MIN_RATIO", "0.6"))
    MAX_SOFT_TAGS: int = int(os.getenv("MAX_SOFT_TAGS", "12"))
    BRAND_LIST_RAW: str = os.getenv("BRAND_LIST", "").strip()
    BRAND_LIST: tuple[str, ...] = _parse_list(BRAND_LIST_RAW)
    BRAND_STRICT: bool = os.getenv("BRAND_STRICT", "1").strip() in (
        "1",
        "true",
        "yes",
        "on",
    )
    CAPTION_MAX_CHARS: int = int(os.getenv("CAPTION_MAX_CHARS", "280"))
    CAPTION_REPETITION_THRESHOLD: int = int(
        os.getenv("CAPTION_REPETITION_THRESHOLD")
        or os.getenv("CAPTION_DEDUP_REPETITION_THRESHOLD", "3")
    )
    CAPTION_CONSENSUS_TOPK: int = int(
        os.getenv("CAPTION_CONSENSUS_TOPK", "8")
    )

    LLM_MAX_NEW_TOKENS: int = int(os.getenv("LLM_MAX_NEW_TOKENS", "220"))
    LLM_TEMPERATURE: float = float(os.getenv("LLM_TEMPERATURE", "0.4"))
    LLM_STOP_STRINGS_RAW: str | None = os.getenv("LLM_STOP_STRINGS")
    LLM_STOP_STRINGS: tuple[str, ...] = _parse_stop_strings(
        LLM_STOP_STRINGS_RAW or ""
    )
    LLM_PRELOAD_ON_STARTUP: bool = os.getenv(
        "LLM_PRELOAD_ON_STARTUP", "0"
    ).strip() in ("1", "true", "yes", "on")

    REQUEST_TIMEOUT_SEC: float = float(os.getenv("REQUEST_TIMEOUT_SEC", "30"))
    LLM_TIMEOUT_SECONDS: float = float(os.getenv("LLM_TIMEOUT_SECONDS", "20"))
    DEBUG: bool = os.getenv("DEBUG", "0").strip() in ("1", "true", "yes", "on")

    DEBUG_AI: bool = os.getenv("DEBUG_AI", "0").strip() in ("1", "true", "yes", "on")
    DEBUG_AI_INCLUDE_PROMPT: bool = os.getenv("DEBUG_AI_INCLUDE_PROMPT", "0").strip() in (
        "1",
        "true",
        "yes",
        "on",
    )
    DEBUG_AI_LOG_RAW_TAIL: bool = os.getenv("DEBUG_AI_LOG_RAW_TAIL", "0").strip() in (
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

    DEVICES_CLIP: str = os.getenv("DEVICES_CLIP", "openvino:GPU").strip()
    DEVICES_BLIP: str = os.getenv("DEVICES_BLIP", "openvino:GPU").strip()
    DEVICES_LLM: str = os.getenv("DEVICES_LLM", "openvino:NPU").strip()
    DEVICES_STRICT: bool = os.getenv("DEVICES_STRICT", "true").strip() in (
        "1",
        "true",
        "yes",
        "on",
    )

    def device_routing(self) -> DeviceRouting:
        devices_env = {
            "DEVICES_CLIP": os.getenv("DEVICES_CLIP"),
            "DEVICES_BLIP": os.getenv("DEVICES_BLIP"),
            "DEVICES_LLM": os.getenv("DEVICES_LLM"),
        }
        ai_device_env = os.getenv("AI_DEVICE")
        if ai_device_env and any(devices_env.values()):
            logger.warning(
                "AI_DEVICE is set but DEVICES_* are also configured; using DEVICES_* for routing."
            )
        if ai_device_env and not any(devices_env.values()):
            clip = blip = llm = ai_device_env
        else:
            clip = self.DEVICES_CLIP
            blip = self.DEVICES_BLIP
            llm = self.DEVICES_LLM

        def _normalize(label: str, value: str) -> str:
            normalized = normalize_device(value)
            if value.strip() and value.strip().lower() != normalized.lower():
                logger.info(
                    "Device routing normalized %s device_requested=%s device_resolved=%s",
                    label,
                    value,
                    normalized,
                )
            return normalized
        return DeviceRouting(
            clip=_normalize("clip", clip),
            blip=_normalize("blip", blip),
            llm=_normalize("llm", llm),
            strict=self.DEVICES_STRICT,
        )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
