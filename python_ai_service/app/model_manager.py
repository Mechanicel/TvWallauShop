from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import openvino as ov
from filelock import FileLock

from .config import Settings, get_settings
from .services.errors import AiServiceError


@dataclass(frozen=True)
class ModelSpec:
    name: str
    hf_source: str
    target_dir: Path
    required_files: tuple[str, ...]
    conversion_command: tuple[str, ...] | None = None

    def missing_files(self) -> list[str]:
        return [str(self.target_dir / fname) for fname in self.required_files]


@contextmanager
def _model_lock(lock_path: Path) -> Iterable[None]:
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    lock = FileLock(str(lock_path))
    with lock:
        yield


def model_fetch_hint() -> str:
    return "Set MODEL_FETCH_MODE=download and OFFLINE=0 to download/convert once."


def build_model_specs(settings: Settings) -> dict[str, ModelSpec]:
    return {
        "clip": ModelSpec(
            name="clip",
            hf_source="openai/clip-vit-base-patch32",
            target_dir=Path(settings.OV_CLIP_DIR),
            required_files=(
                "image_encoder.xml",
                "image_encoder.bin",
                "text_encoder.xml",
                "text_encoder.bin",
                "tokenizer.json",
            ),
            conversion_command=(
                "optimum-cli",
                "export",
                "openvino",
                "--model",
                "openai/clip-vit-base-patch32",
                "--task",
                "feature-extraction",
                "--output",
                settings.OV_CLIP_DIR,
            ),
        ),
        "caption": ModelSpec(
            name="caption",
            hf_source="Salesforce/blip-image-captioning-base",
            target_dir=Path(settings.OV_CAPTION_DIR),
            required_files=("model.xml", "model.bin", "tokenizer.json"),
            conversion_command=(
                "optimum-cli",
                "export",
                "openvino",
                "--model",
                "Salesforce/blip-image-captioning-base",
                "--task",
                "image-to-text",
                "--output",
                settings.OV_CAPTION_DIR,
            ),
        ),
        "llm": ModelSpec(
            name="llm",
            hf_source="Qwen/Qwen2.5-3B-Instruct",
            target_dir=Path(settings.OV_LLM_DIR),
            required_files=(
                "openvino_model.xml",
                "openvino_model.bin",
                "tokenizer.json",
                "config.json",
            ),
            conversion_command=(
                "optimum-cli",
                "export",
                "openvino",
                "--model",
                "Qwen/Qwen2.5-3B-Instruct",
                "--task",
                "text-generation-with-past",
                "--trust-remote-code",
                "--weight-format",
                "int4",
                "--group-size",
                "128",
                "--ratio",
                "1.0",
                "--sym",
                settings.OV_LLM_DIR,
            ),
        ),
    }


def check_device_available(device: str) -> str:
    if device != "openvino:GPU":
        raise AiServiceError(
            code="INVALID_INPUT",
            message="Only OpenVINO GPU is supported.",
            details={"device": device},
            http_status=400,
        )
    core = ov.Core()
    if "GPU" not in core.available_devices:
        raise AiServiceError(
            code="DEVICE_NOT_AVAILABLE",
            message="Requested OpenVINO GPU device is not available.",
            details={"device": device, "available": core.available_devices},
            http_status=503,
        )
    return "GPU"


def check_assets(spec: ModelSpec) -> list[str]:
    missing = [str(spec.target_dir / fname) for fname in spec.required_files]
    return [path for path in missing if not Path(path).exists()]


def _raise_model_missing(spec: ModelSpec, missing: list[str]) -> None:
    raise AiServiceError(
        code="MODEL_NOT_AVAILABLE",
        message=f"{spec.name.upper()} model assets are missing. {model_fetch_hint()}",
        details={
            "model": spec.name,
            "missing": missing,
            "directory": str(spec.target_dir),
            "hint": model_fetch_hint(),
        },
        http_status=503,
    )


def _conversion_env(settings: Settings, offline: bool) -> dict[str, str]:
    env = os.environ.copy()
    cache_dir = settings.MODEL_CACHE_DIR
    env.setdefault("HF_HOME", cache_dir)
    env.setdefault("TRANSFORMERS_CACHE", cache_dir)
    env.setdefault("HUGGINGFACE_HUB_CACHE", cache_dir)
    if offline:
        env.setdefault("HF_HUB_OFFLINE", "1")
        env.setdefault("TRANSFORMERS_OFFLINE", "1")
    return env


def _find_optimum_cli() -> str | None:
    executable = shutil.which("optimum-cli") or shutil.which("optimum-cli.exe")
    if executable:
        return str(Path(executable).resolve())

    python_dir = Path(sys.executable).resolve().parent
    for candidate in ("optimum-cli", "optimum-cli.exe"):
        path = python_dir / candidate
        if path.exists():
            return str(path.resolve())
    return None


def _tail_output(value: str | None, limit: int = 2000) -> str | None:
    if not value:
        return None
    if len(value) <= limit:
        return value
    return value[-limit:]


def _run_conversion(spec: ModelSpec, settings: Settings, offline: bool) -> None:
    spec.target_dir.mkdir(parents=True, exist_ok=True)
    if spec.conversion_command is None:
        return
    command = list(spec.conversion_command)
    if command and command[0] == "optimum-cli":
        optimum_cli = _find_optimum_cli()
        if not optimum_cli:
            expected_path = Path(sys.executable).resolve().parent / "optimum-cli.exe"
            raise AiServiceError(
                code="MODEL_NOT_AVAILABLE",
                message="optimum-cli is required to download/convert models.",
                details={
                    "install": "pip install -U optimum-intel[openvino] openvino",
                    "python_executable": sys.executable,
                    "expected_path": str(expected_path),
                },
                http_status=503,
            )
        command[0] = optimum_cli
    try:
        subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            env=_conversion_env(settings, offline),
        )
    except subprocess.CalledProcessError as exc:
        raise AiServiceError(
            code="MODEL_NOT_AVAILABLE",
            message=f"Failed to convert/download {spec.name} model. {model_fetch_hint()}",
            details={
                "model": spec.name,
                "command": " ".join(command),
                "stdout_tail": _tail_output(exc.stdout),
                "stderr_tail": _tail_output(exc.stderr),
            },
            http_status=503,
        ) from exc


def _write_manifest(model_dir: Path, specs: list[ModelSpec]) -> None:
    manifest = {
        "ready": True,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "models": [
            {
                "name": spec.name,
                "source": spec.hf_source,
                "directory": str(spec.target_dir),
                "required_files": list(spec.required_files),
            }
            for spec in specs
        ],
    }
    model_dir.mkdir(parents=True, exist_ok=True)
    (model_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def ensure_models(mode: str, offline: bool, settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    if mode not in {"never", "download", "force"}:
        raise AiServiceError(
            code="INVALID_INPUT",
            message="Unsupported MODEL_FETCH_MODE value.",
            details={"mode": mode},
            http_status=400,
        )
    if offline and mode in {"download", "force"}:
        raise AiServiceError(
            code="MODEL_NOT_AVAILABLE",
            message="OFFLINE forbids downloading.",
            details={"mode": mode},
            http_status=503,
        )

    check_device_available(settings.AI_DEVICE)
    specs = build_model_specs(settings)
    model_dir = Path(settings.MODEL_DIR)

    with _model_lock(model_dir / ".lock"):
        for spec in specs.values():
            missing = check_assets(spec)
            if not missing and mode != "force":
                continue
            if offline:
                _raise_model_missing(spec, missing or spec.missing_files())
            if mode in {"download", "force"}:
                _run_conversion(spec, settings, offline)
                missing = check_assets(spec)
                if missing:
                    _raise_model_missing(spec, missing)
            else:
                _raise_model_missing(spec, missing)

    if not offline and mode == "download":
        _write_manifest(model_dir, list(specs.values()))
