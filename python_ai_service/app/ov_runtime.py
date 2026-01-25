from __future__ import annotations

import logging
import os
from pathlib import Path

import openvino as ov

from .services.errors import AiServiceError

DISALLOWED_DEVICE_TOKENS = ("AUTO", "MULTI")

logger = logging.getLogger("tvwallau-ai")


def normalize_device(device: str) -> str:
    if not device:
        raise AiServiceError(
            code="INVALID_INPUT",
            message="Device string is required.",
            details={"device": device},
            http_status=400,
        )
    normalized = device.strip()
    if normalized.lower().startswith("openvino:"):
        normalized = normalized.split(":", 1)[1]
    if not normalized:
        raise AiServiceError(
            code="INVALID_INPUT",
            message="Device string is required.",
            details={"device": device},
            http_status=400,
        )
    return normalized.upper()


def configure_openvino_cache(core: ov.Core | None, cache_dir: str | None) -> None:
    if not cache_dir:
        return
    cache_path = Path(cache_dir)
    cache_path.mkdir(parents=True, exist_ok=True)
    os.environ.setdefault("OV_CACHE_DIR", str(cache_path))
    if core is not None:
        core.set_property({"CACHE_DIR": str(cache_path)})


def create_core(cache_dir: str | None) -> ov.Core:
    core = ov.Core()
    configure_openvino_cache(core, cache_dir)
    return core


def resolve_device(
    core: ov.Core,
    device: str,
    model_name: str | None = None,
    log: logging.Logger | None = None,
) -> str:
    normalized = normalize_device(device)
    if any(token in normalized for token in DISALLOWED_DEVICE_TOKENS) or "," in normalized:
        raise AiServiceError(
            code="INVALID_INPUT",
            message="AUTO/MULTI devices are not supported.",
            details={"device": device},
            http_status=400,
        )
    available = core.available_devices
    if normalized not in available:
        raise AiServiceError(
            code="DEVICE_NOT_AVAILABLE",
            message="Requested OpenVINO device is not available.",
            details={
                "device_requested": device,
                "device_resolved": normalized,
                "available_devices": available,
                "model": model_name,
            },
            http_status=503,
        )
    active_logger = log or logger
    active_logger.info(
        "OpenVINO device resolved model=%s device_requested=%s device_resolved=%s available_devices=%s",
        model_name or "unknown",
        device,
        normalized,
        available,
    )
    return normalized


def require_device(
    core: ov.Core,
    device: str,
    model_name: str | None = None,
    log: logging.Logger | None = None,
) -> str:
    return resolve_device(core, device, model_name=model_name, log=log)


def compile_strict(
    core: ov.Core,
    model: ov.Model,
    device: str,
    model_name: str | None = None,
    log: logging.Logger | None = None,
) -> ov.CompiledModel:
    normalized = resolve_device(core, device, model_name=model_name, log=log)
    return core.compile_model(model, normalized)
