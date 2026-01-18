from __future__ import annotations

import json
import logging
import os
from pathlib import Path

import openvino as ov

from ...config import get_settings
from ...contracts_models import LlmDebug
from ...model_manager import build_model_specs, check_assets, model_fetch_hint
from ...openvino_tokenizers_ext import ensure_openvino_tokenizers_extension_loaded
from ..errors import AiServiceError
from .prompts import COPYWRITER_SYSTEM, build_copy_prompt

settings = get_settings()
logger = logging.getLogger("tvwallau-ai")


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
                "missing": missing.missing,
                "checked_dir": str(missing.checked_dir),
                "found_files": missing.found_files,
                "asset_details": missing.details,
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


def _truncate_text(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars]


def _extract_first_json_block(text: str) -> str | None:
    in_string = False
    escape = False
    start_idx: int | None = None
    depth = 0
    for idx, char in enumerate(text):
        if char == "\\" and in_string:
            escape = not escape
            continue
        if char == '"' and not escape:
            in_string = not in_string
        escape = False
        if in_string:
            continue
        if char == "{":
            start_idx = idx
            depth = 1
            break
    if start_idx is None:
        return None
    for idx in range(start_idx + 1, len(text)):
        char = text[idx]
        if char == "\\" and in_string:
            escape = not escape
            continue
        if char == '"' and not escape:
            in_string = not in_string
        escape = False
        if in_string:
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return text[start_idx : idx + 1]
    return None


class LlmCopywriter:
    def __init__(self, device: str) -> None:
        import openvino_genai as ov_genai

        if settings.AI_DEVICE_STRICT and "AUTO" in device:
            raise AiServiceError(
                code="INVALID_INPUT",
                message="AUTO device not allowed for LLM in strict mode.",
                details={"device": device},
                http_status=400,
            )
        core = ov.Core()
        if device == "NPU" and "NPU" not in core.available_devices:
            raise AiServiceError(
                code="DEVICE_NOT_AVAILABLE",
                message="Requested OpenVINO NPU device is not available.",
                details={"device": device, "available": core.available_devices},
                http_status=503,
            )
        model_dir = _resolve_llm_dir()
        ensure_openvino_tokenizers_extension_loaded()
        try:
            self.pipeline = ov_genai.LLMPipeline(str(model_dir), device)
            self._ov_genai = ov_genai
        except Exception as exc:
            try:
                files = sorted(os.listdir(model_dir))
            except FileNotFoundError:
                files = []
            raise AiServiceError(
                code="MODEL_NOT_AVAILABLE",
                message=(
                    "Failed to initialize LLM pipeline (tokenizer extension likely missing or incompatible)."
                ),
                details={
                    "model_dir": str(model_dir),
                    "device": device,
                    "files": files,
                    "error": str(exc),
                },
                http_status=503,
            ) from exc

    def generate(
        self,
        price_amount: float,
        currency: str,
        tags: list[str],
        captions: list[str],
        debug: LlmDebug | None = None,
        include_prompt: bool = False,
    ) -> tuple[str, str]:
        prompt = build_copy_prompt(price_amount, currency, tags, captions)
        return self._generate_with_retry(
            prompt,
            retry=True,
            debug=debug,
            include_prompt=include_prompt,
        )

    def _build_full_prompt(self, user_prompt: str) -> str:
        return (
            "### System\n"
            f"{COPYWRITER_SYSTEM}\n"
            "### User\n"
            f"{user_prompt}\n"
            "### Assistant\n"
        )

    def _generate_with_retry(
        self,
        prompt: str,
        retry: bool,
        debug: LlmDebug | None = None,
        include_prompt: bool = False,
    ) -> tuple[str, str]:
        full_prompt = self._build_full_prompt(prompt)
        config = self._ov_genai.GenerationConfig(
            max_new_tokens=settings.LLM_MAX_NEW_TOKENS,
            temperature=settings.LLM_TEMPERATURE,
        )
        try:
            result = self.pipeline.generate(full_prompt, config)
        except ValueError as exc:
            if "incorrect GenerationConfig parameter" in str(exc):
                raise AiServiceError(
                    code="INVALID_CONFIG",
                    message="Invalid OpenVINO GenAI GenerationConfig parameter.",
                    details={"error": str(exc)},
                    http_status=500,
                ) from exc
            raise
        if debug:
            max_chars = settings.DEBUG_AI_MAX_CHARS
            debug.raw_output = _truncate_text(result, max_chars)
            if include_prompt:
                debug.prompt = _truncate_text(full_prompt, max_chars)
            extracted = _extract_first_json_block(result)
            if extracted:
                debug.extracted_json = _truncate_text(extracted, max_chars)

        try:
            return parse_llm_json(result)
        except json.JSONDecodeError as exc:
            if retry:
                retry_prompt = (
                    "Your previous output was invalid JSON or did not match the schema. "
                    "Return ONLY valid JSON with keys title and description."
                )
                return self._generate_with_retry(
                    f"{prompt}\n\n{retry_prompt}",
                    retry=False,
                    debug=debug,
                    include_prompt=include_prompt,
                )
            if debug:
                debug.parse_error = str(exc)
            logger.warning("LLM output JSON parse failed: %s", exc)
            raise AiServiceError(
                code="LLM_OUTPUT_INVALID",
                message="LLM output did not match the required JSON schema.",
                details={"error": str(exc)},
                http_status=502,
            ) from exc
        except ValueError as exc:
            if retry:
                retry_prompt = (
                    "Your previous output was invalid JSON or did not match the schema. "
                    "Return ONLY valid JSON with keys title and description."
                )
                return self._generate_with_retry(
                    f"{prompt}\n\n{retry_prompt}",
                    retry=False,
                    debug=debug,
                    include_prompt=include_prompt,
                )
            if debug:
                debug.schema_error = str(exc)
            logger.warning("LLM output schema validation failed: %s", exc)
            raise AiServiceError(
                code="LLM_OUTPUT_INVALID",
                message="LLM output did not match the required JSON schema.",
                details={"error": str(exc)},
                http_status=502,
            ) from exc
