from __future__ import annotations

import openvino as ov

from .services.errors import AiServiceError

DISALLOWED_DEVICE_TOKENS = ("AUTO", "MULTI")


def _normalize_device(device: str) -> str:
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


def require_device(core: ov.Core, device: str) -> str:
    normalized = _normalize_device(device)
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
            details={"device": normalized, "available": available},
            http_status=503,
        )
    return normalized


def compile_strict(core: ov.Core, model: ov.Model, device: str) -> ov.CompiledModel:
    normalized = require_device(core, device)
    return core.compile_model(model, normalized)
