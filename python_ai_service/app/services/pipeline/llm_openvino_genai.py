from __future__ import annotations

import json
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from inspect import signature
from pathlib import Path

from ...config import get_settings
from ...contracts_models import LlmDebug
from ...model_manager import build_model_specs, check_assets, model_fetch_hint
from ...ov_runtime import create_core, normalize_device, require_device
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
    candidate = _extract_first_json_object(result)
    if candidate is None:
        raise ValueError("No JSON object found.")
    parsed, parse_error = _parse_json_strict(candidate)
    if parse_error or parsed is None:
        raise ValueError(parse_error or "JSON parse failed.")
    title = parsed.get("title")
    description = parsed.get("description")
    _validate_copy_output(title, description)
    return title, description


def _truncate_text(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    return text[:max_chars]


def _extract_first_json_object(text: str) -> str | None:
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


def _parse_json_strict(text: str) -> tuple[dict | None, str | None]:
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed, None
        return None, "Parsed JSON must be an object."
    except json.JSONDecodeError as exc:
        return None, str(exc)


def parse_llm_output(
    raw: str,
    debug: LlmDebug | None,
    allow_debug_failure: bool,
) -> tuple[str, str]:
    candidate = _extract_first_json_object(raw)
    if debug:
        debug.raw_text_chars = len(raw)
        debug.raw_text_truncated = _truncate_text(raw, settings.DEBUG_AI_MAX_CHARS)
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
    parsed, parse_error = _parse_json_strict(candidate)
    if debug:
        debug.extracted_json_truncated = _truncate_text(
            candidate, settings.DEBUG_AI_MAX_CHARS
        )
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
    def __init__(self, device: str, debug: LlmDebug | None = None) -> None:
        import openvino_genai as ov_genai

        model_dir = _resolve_llm_dir()
        ensure_openvino_tokenizers_extension_loaded()
        init_start = time.monotonic()
        logger.info(
            "LLM init start ts=%.6f device_requested=%s",
            init_start,
            device,
        )
        core = create_core(settings.OV_CACHE_DIR)
        normalized_requested = normalize_device(device)
        allowed_devices = {"GPU", "NPU"}
        if normalized_requested == "CPU":
            allowed_devices.add("CPU")
        ov_device = require_device(core, device, model_name="llm", log=logger)
        if debug:
            debug.llm_device_requested = device
            debug.llm_device_resolved = ov_device
        if ov_device not in allowed_devices:
            allowed_devices_for_llm = sorted(allowed_devices)
            logger.warning(
                "LLM device rejected device_requested=%s device_resolved=%s allowed_devices_for_llm=%s",
                device,
                ov_device,
                allowed_devices_for_llm,
            )
            raise AiServiceError(
                code="INVALID_INPUT",
                message="LLM device is not allowed.",
                details={
                    "device_requested": device,
                    "device_resolved": ov_device,
                    "allowed_devices_for_llm": allowed_devices_for_llm,
                },
                http_status=400,
            )
        try:
            self.pipeline = ov_genai.LLMPipeline(str(model_dir), ov_device)
            self._ov_genai = ov_genai
            self._device_resolved = ov_device
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
        finally:
            init_end = time.monotonic()
            init_ms = (init_end - init_start) * 1000
            if debug:
                debug.llm_init_ms = init_ms
            logger.info(
                "LLM init end ts=%.6f duration_ms=%.2f device_resolved=%s",
                init_end,
                init_ms,
                ov_device,
            )

    def generate(
        self,
        price_amount: float,
        currency: str,
        tags: list[str],
        captions: list[str],
        debug: LlmDebug | None = None,
        include_prompt: bool = False,
        allow_debug_failure: bool = False,
    ) -> tuple[str, str]:
        prompt = build_copy_prompt(price_amount, currency, tags, captions)
        return self._generate_with_retry(
            prompt,
            retry=True,
            debug=debug,
            include_prompt=include_prompt,
            allow_debug_failure=allow_debug_failure,
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
        allow_debug_failure: bool = False,
    ) -> tuple[str, str]:
        full_prompt = self._build_full_prompt(prompt)
        stop_strings = self._resolve_stop_strings()
        config_kwargs = {
            "max_new_tokens": max(1, settings.LLM_MAX_NEW_TOKENS),
            "temperature": settings.LLM_TEMPERATURE,
        }
        stop_strings_used: list[str] | None = None
        if stop_strings:
            try:
                if "stop_strings" in signature(self._ov_genai.GenerationConfig).parameters:
                    config_kwargs["stop_strings"] = stop_strings
                    stop_strings_used = list(stop_strings)
            except (TypeError, ValueError):
                pass
        config = self._ov_genai.GenerationConfig(**config_kwargs)
        if stop_strings and stop_strings_used is None and hasattr(config, "stop_strings"):
            try:
                config.stop_strings = stop_strings
                stop_strings_used = list(stop_strings)
            except Exception:
                stop_strings_used = None
        generate_start = time.monotonic()
        logger.info(
            "LLM generate start ts=%.6f device_resolved=%s",
            generate_start,
            self._device_resolved,
        )
        try:
            result = self._generate_with_timeout(full_prompt, config, debug)
            if debug is not None:
                debug.llm_timeout_hit = False
        except AiServiceError as exc:
            if exc.code == "LLM_TIMEOUT":
                if allow_debug_failure:
                    return "", ""
                raise
            raise
        except ValueError as exc:
            if "incorrect GenerationConfig parameter" in str(exc):
                raise AiServiceError(
                    code="INVALID_CONFIG",
                    message="Invalid OpenVINO GenAI GenerationConfig parameter.",
                    details={"error": str(exc)},
                    http_status=500,
                ) from exc
            raise
        finally:
            generate_end = time.monotonic()
            generate_ms = (generate_end - generate_start) * 1000
            if debug is not None:
                debug.llm_generate_ms = generate_ms
            logger.info(
                "LLM generate end ts=%.6f duration_ms=%.2f",
                generate_end,
                generate_ms,
            )
        raw = result
        raw_trunc = _truncate_text(raw, settings.DEBUG_AI_MAX_CHARS)
        stop_triggered = None
        if stop_strings_used:
            stop_triggered = any(stop_string in raw for stop_string in stop_strings_used)
        if debug is not None:
            debug.stop_strings_used = stop_strings_used
            debug.stop_triggered = stop_triggered
        if settings.DEBUG or settings.DEBUG_AI:
            logger.debug(
                "LLM stop strings used=%s stop_triggered=%s",
                stop_strings_used,
                stop_triggered,
            )
        if settings.DEBUG or settings.DEBUG_AI:
            logger.info("LLM raw output (truncated): %s", raw_trunc)
        if settings.DEBUG_AI and settings.DEBUG_AI_INCLUDE_PROMPT:
            logger.info(
                "LLM prompt (truncated): %s",
                _truncate_text(full_prompt, settings.DEBUG_AI_MAX_CHARS),
            )
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
                    allow_debug_failure=allow_debug_failure,
                )
            raise exc

    def _resolve_stop_strings(self) -> tuple[str, ...]:
        if settings.LLM_STOP_STRINGS:
            return settings.LLM_STOP_STRINGS
        return (
            "You are an AI assistant",
            "Yes_or_No",
            "### User",
            "### System",
            "### Assistant",
        )

    def _generate_with_timeout(
        self,
        full_prompt: str,
        config: object,
        debug: LlmDebug | None,
    ) -> str:
        timeout_seconds = settings.LLM_TIMEOUT_SECONDS
        if timeout_seconds <= 0:
            return self.pipeline.generate(full_prompt, config)
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(self.pipeline.generate, full_prompt, config)
            try:
                return future.result(timeout=timeout_seconds)
            except FuturesTimeoutError as exc:
                if debug is not None:
                    debug.llm_timeout_hit = True
                raise AiServiceError(
                    code="LLM_TIMEOUT",
                    message="LLM inference timed out.",
                    details={"timeoutSeconds": timeout_seconds},
                    http_status=502,
                ) from exc
