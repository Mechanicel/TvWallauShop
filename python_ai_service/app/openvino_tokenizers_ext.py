from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path

import openvino as ov

from .services.errors import AiServiceError


DLL_NAME = "openvino_tokenizers.dll"


def _find_dlls(base: Path, limit: int = 5) -> list[Path]:
    if not base.exists():
        return []
    matches: list[Path] = []
    for path in base.rglob(DLL_NAME):
        matches.append(path)
        if len(matches) >= limit:
            break
    return matches


def ensure_openvino_tokenizers_extension_loaded() -> dict:
    spec = importlib.util.find_spec("openvino_tokenizers")
    dlls: list[Path] = []
    if spec and spec.origin:
        base = Path(spec.origin).resolve().parent
        dlls = list(base.rglob(DLL_NAME))

    if not dlls:
        fallback_base = Path(sys.prefix) / "Lib" / "site-packages"
        dlls = _find_dlls(fallback_base)

    if not dlls:
        raise AiServiceError(
            code="MODEL_NOT_AVAILABLE",
            message=(
                "OpenVINO Tokenizers extension DLL not found (openvino_tokenizers.dll)."
            ),
            details={
                "hint": (
                    "Install openvino_tokenizers matching your openvino-genai/openvino versions."
                )
            },
            http_status=503,
        )

    dll_path = dlls[0]
    if os.name == "nt":
        os.add_dll_directory(str(dll_path.parent))

    core = ov.Core()
    core.add_extension(str(dll_path))
    return {"dll_path": str(dll_path)}
