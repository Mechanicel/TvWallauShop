from __future__ import annotations

import json
from pathlib import Path

from ...config import get_settings
from ...model_manager import build_model_specs, check_assets, model_fetch_hint
from ...openvino_tokenizers_ext import ensure_openvino_tokenizers_extension_loaded
from ..errors import AiServiceError
from .prompts import COPYWRITER_SYSTEM, build_copy_prompt

settings = get_settings()


def _resolve_llm_dir() -> Path:
    spec = build_model_specs(settings)["llm"]
    model_dir = spec.target_dir
    missing = check_assets(spec)
    if missing:
        raise AiServiceError(
            code="MODEL_NOT_AVAILABLE",
            message=f"LLM model assets are missing. {model_fetch_hint()}",
            details={
                "model": "llm",
                "missing": missing,
                "directory": str(model_dir),
                "hint": model_fetch_hint(),
            },
            http_status=503,
        )
    return model_dir


def _validate_copy_output(title: str, description: str) -> None:
    if not isinstance(title, str) or not isinstance(description, str):
        raise ValueError("Title and description must be strings.")
    if not (55 <= len(title) <= 90):
        raise ValueError("Title length out of range.")
    sentence_count = len([s for s in description.split(".") if s.strip()])
    if sentence_count < 2 or sentence_count > 4:
        raise ValueError("Description must be 2-4 sentences.")
    if not description.strip():
        raise ValueError("Description must not be empty.")


def parse_llm_json(result: str) -> tuple[str, str]:
    parsed = json.loads(result)
    title = parsed.get("title")
    description = parsed.get("description")
    _validate_copy_output(title, description)
    return title, description


class LlmCopywriter:
    def __init__(self, device: str) -> None:
        import openvino_genai as ov_genai

        model_dir = _resolve_llm_dir()
        ensure_openvino_tokenizers_extension_loaded()
        try:
            self.pipeline = ov_genai.LLMPipeline(str(model_dir), device)
        except Exception as exc:
            raise AiServiceError(
                code="MODEL_NOT_AVAILABLE",
                message=(
                    "Failed to initialize LLM pipeline (tokenizer extension likely missing or incompatible)."
                ),
                details={"model_dir": str(model_dir), "device": device, "error": str(exc)},
                http_status=503,
            ) from exc

    def generate(self, price_amount: float, currency: str, tags: list[str], captions: list[str]) -> tuple[str, str]:
        prompt = build_copy_prompt(price_amount, currency, tags, captions)
        raw = self._generate_with_retry(prompt, retry=True)
        return raw

    def _generate_with_retry(self, prompt: str, retry: bool) -> tuple[str, str]:
        result = self.pipeline.generate(
            prompt,
            max_new_tokens=settings.LLM_MAX_NEW_TOKENS,
            temperature=settings.LLM_TEMPERATURE,
            system_prompt=COPYWRITER_SYSTEM,
        )
        try:
            return parse_llm_json(result)
        except Exception as exc:
            if retry:
                retry_prompt = (
                    "Your previous output was invalid JSON or did not match the schema. "
                    "Return ONLY valid JSON with keys title and description."
                )
                return self._generate_with_retry(f"{prompt}\n\n{retry_prompt}", retry=False)
            raise AiServiceError(
                code="LLM_OUTPUT_INVALID",
                message="LLM output did not match the required JSON schema.",
                details={"error": str(exc)},
                http_status=502,
            ) from exc
