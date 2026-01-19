from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path

import openvino as ov

from ...config import get_settings
from ...contracts_models import LlmDebug
from ...model_manager import build_model_specs, check_assets, model_fetch_hint
from ...ov_runtime import require_device
from ...openvino_tokenizers_ext import ensure_openvino_tokenizers_extension_loaded
from ..errors import AiServiceError
from .prompts import COPYWRITER_SYSTEM, build_copy_prompt

settings = get_settings()
logger = logging.getLogger("tvwallau-ai")
LLM_DEBUG_MAX_CHARS = 2000


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
    if not isinstance(parsed, dict):
        raise ValueError("Parsed JSON must be an object.")
    title = parsed.get("title")
    description = parsed.get("description")
    _validate_copy_output(title, description)
    return title, description


def _truncate_text(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars]


def _extract_json_fenced_block(text: str) -> str | None:
    match = re.search(r"```json\\s*(.*?)```", text, flags=re.DOTALL | re.IGNORECASE)
    if not match:
        return None
    return match.group(1).strip()


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


def _extract_json_candidate(text: str) -> str | None:
    fenced = _extract_json_fenced_block(text)
    if fenced:
        return fenced
    return _extract_first_json_block(text)


def _parse_json_best_effort(text: str) -> tuple[dict | None, str | None]:
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed, None
        return None, "Parsed JSON must be an object."
    except json.JSONDecodeError as exc:
        if "Extra data" in str(exc) and exc.pos:
            trimmed = text[: exc.pos].rstrip()
            try:
                parsed = json.loads(trimmed)
                if isinstance(parsed, dict):
                    return parsed, None
                return None, "Parsed JSON must be an object."
            except json.JSONDecodeError as exc_retry:
                return None, str(exc_retry)
        return None, str(exc)


def parse_llm_output(
    raw: str,
    debug: LlmDebug | None,
    allow_debug_failure: bool,
) -> tuple[str, str]:
    candidate = _extract_json_candidate(raw)
    if debug:
        debug.raw_text_chars = len(raw)
        debug.raw_text_truncated = _truncate_text(raw, LLM_DEBUG_MAX_CHARS)
    if candidate is None:
        if debug:
            debug.json_parse_error = "No JSON object found."
        if allow_debug_failure:
            return "", ""
        raise AiServiceError(
            code="LLM_OUTPUT_INVALID",
            message="LLM output did not contain JSON.",
            details={"error": "No JSON object found."},
            http_status=502,
        )
    parsed, parse_error = _parse_json_best_effort(candidate)
    if debug:
        debug.extracted_json_truncated = _truncate_text(candidate, LLM_DEBUG_MAX_CHARS)
        debug.extracted_json_chars = len(candidate)
        if parse_error:
            debug.json_parse_error = parse_error
    if parse_error or parsed is None:
        if allow_debug_failure:
            return "", ""
        raise AiServiceError(
            code="LLM_OUTPUT_INVALID",
            message="LLM output did not match the required JSON schema.",
            details={"error": parse_error or "JSON parse failed."},
            http_status=502,
        )
    title = parsed.get("title")
    description = parsed.get("description")
    try:
        _validate_copy_output(title, description)
    except ValueError as exc:
        if debug:
            debug.schema_error = str(exc)
        if allow_debug_failure:
            return "", ""
        raise AiServiceError(
            code="LLM_OUTPUT_INVALID",
            message="LLM output did not match the required JSON schema.",
            details={"error": str(exc)},
            http_status=502,
        ) from exc
    return title, description


class LlmCopywriter:
    def __init__(self, device: str) -> None:
        import openvino_genai as ov_genai

        model_dir = _resolve_llm_dir()
        ensure_openvino_tokenizers_extension_loaded()
        core = ov.Core()
        ov_device = require_device(core, device)
        if ov_device != "NPU":
            raise AiServiceError(
                code="INVALID_INPUT",
                message="LLM must be initialized on OpenVINO NPU.",
                details={"device": ov_device},
                http_status=400,
            )
        try:
            self.pipeline = ov_genai.LLMPipeline(str(model_dir), ov_device)
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
        raw = result
        raw_trunc = _truncate_text(raw, LLM_DEBUG_MAX_CHARS)
        if settings.DEBUG or settings.DEBUG_AI:
            logger.info("LLM raw output (truncated): %s", raw_trunc)
        if settings.DEBUG_AI and settings.DEBUG_AI_INCLUDE_PROMPT:
            logger.info(
                "LLM prompt (truncated): %s",
                _truncate_text(full_prompt, LLM_DEBUG_MAX_CHARS),
            )
        allow_debug_failure = settings.DEBUG
        try:
            return parse_llm_output(raw, debug, allow_debug_failure)
        except AiServiceError as exc:
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
            raise exc
