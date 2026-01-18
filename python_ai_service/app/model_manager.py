from __future__ import annotations

import json
import logging
import os
import shutil
import subprocess
import sys
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import openvino as ov
from filelock import FileLock

from .config import Settings, get_settings
from .services.errors import AiServiceError

logger = logging.getLogger("tvwallau-ai")

@dataclass
class ModelSpec:
    name: str
    source_kind: str
    hf_id: str
    target_dir: Path
    required_files: tuple[str, ...]
    export_args: list[str] = field(default_factory=list)
    converter: str | None = None
    actual_dir: Path | None = None

    def missing_files(self) -> list[str]:
        return [str(self.target_dir / fname) for fname in self.required_files]

    def build_conversion_command(self) -> tuple[str, ...] | None:
        if self.source_kind != "hf_export" or self.converter in {
            "blip_openvino_script",
            "clip_openvino_script",
        }:
            return None
        return (
            "optimum-cli",
            "export",
            "openvino",
            "--model",
            self.hf_id,
            *self.export_args,
        )


@dataclass(frozen=True)
class AssetCheck:
    missing: list[str]
    checked_dir: Path
    found_files: list[str]
    expected: list[str] | None = None

    def __bool__(self) -> bool:
        return bool(self.missing)


@contextmanager
def _model_lock(lock_path: Path) -> Iterable[None]:
    lock_path.parent.mkdir(parents=True, exist_ok=True)
    lock = FileLock(str(lock_path))
    with lock:
        yield


def model_fetch_hint() -> str:
    return "Set MODEL_FETCH_MODE=download and OFFLINE=0 to download/convert once."


def build_model_specs(settings: Settings) -> dict[str, ModelSpec]:
    if settings.CLIP_SOURCE not in {"prebuilt_ir", "hf_export"}:
        raise AiServiceError(
            code="INVALID_INPUT",
            message="Unsupported CLIP_SOURCE value.",
            details={"clip_source": settings.CLIP_SOURCE},
            http_status=400,
        )
    clip_required_files = (
        "image_encoder.xml",
        "image_encoder.bin",
        "text_encoder.xml",
        "text_encoder.bin",
        "tokenizer.json",
    )
    Path(settings.OV_CLIP_DIR).mkdir(parents=True, exist_ok=True)
    return {
        "clip": ModelSpec(
            name="clip",
            source_kind="hf_export",
            hf_id="openai/clip-vit-base-patch32",
            target_dir=Path(settings.OV_CLIP_DIR),
            required_files=clip_required_files,
            converter="clip_openvino_script",
        ),
        "caption": ModelSpec(
            name="caption",
            source_kind="hf_export",
            hf_id=settings.CAPTION_HF_ID,
            target_dir=Path(settings.OV_CAPTION_DIR),
            required_files=(
                "vision_encoder.xml",
                "vision_encoder.bin",
                "text_decoder.xml",
                "text_decoder.bin",
            ),
            converter="blip_openvino_script",
        ),
        "llm": ModelSpec(
            name="llm",
            source_kind="hf_export",
            hf_id="Qwen/Qwen2.5-3B-Instruct",
            target_dir=Path(settings.OV_LLM_DIR),
            required_files=(
                "openvino_model.xml",
                "openvino_model.bin",
                "tokenizer.json",
                "config.json",
            ),
            export_args=[
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
            ],
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


def _list_files(directory: Path) -> list[str]:
    if not directory.exists() or not directory.is_dir():
        return []
    return sorted(path.name for path in directory.iterdir() if path.is_file())


def _find_ir_dir(target_dir: Path) -> Path | None:
    if not target_dir.exists():
        return None
    xml_dirs = {path.parent for path in target_dir.rglob("*.xml") if path.is_file()}
    bin_dirs = {path.parent for path in target_dir.rglob("*.bin") if path.is_file()}
    candidates = xml_dirs & bin_dirs
    if not candidates:
        return None
    if target_dir in candidates:
        return target_dir
    return sorted(candidates, key=lambda path: (len(path.parts), str(path)))[0]


def _update_actual_dir(spec: ModelSpec) -> None:
    actual = _find_ir_dir(spec.target_dir)
    if actual is not None:
        spec.actual_dir = actual


def check_assets(spec: ModelSpec) -> AssetCheck:
    _update_actual_dir(spec)
    checked_dir = spec.actual_dir or spec.target_dir
    found_files = _list_files(checked_dir)
    missing: list[str] = []
    expected: list[str] | None = None
    if spec.name == "clip":
        expected = list(spec.required_files)
        for filename in spec.required_files:
            checked_path = checked_dir / filename
            if not checked_path.exists():
                missing.append(str(checked_path))
    elif spec.name == "caption":
        expected = list(spec.required_files)
        for filename in spec.required_files:
            checked_path = checked_dir / filename
            fallback_path = spec.target_dir / filename
            if not checked_path.exists() and not fallback_path.exists():
                missing.append(str(checked_path))
        processor_candidates = (
            "preprocessor_config.json",
            "tokenizer.json",
            "tokenizer_config.json",
            "special_tokens_map.json",
            "vocab.txt",
            "merges.txt",
        )
        if not any((checked_dir / name).exists() for name in processor_candidates):
            missing.extend(str(checked_dir / name) for name in processor_candidates)
            expected.extend(name for name in processor_candidates if name not in expected)
    else:
        expected_ir = ["*.xml", "*.bin"]
        xml_found = any(checked_dir.glob("*.xml"))
        bin_found = any(checked_dir.glob("*.bin"))
        if not xml_found:
            missing.append("*.xml")
        if not bin_found:
            missing.append("*.bin")
        for filename in spec.required_files:
            if filename.endswith((".xml", ".bin")):
                continue
            checked_path = checked_dir / filename
            fallback_path = spec.target_dir / filename
            if not checked_path.exists() and not fallback_path.exists():
                missing.append(str(checked_path))
        expected = expected_ir if any(entry in expected_ir for entry in missing) else None
    return AssetCheck(
        missing=missing,
        checked_dir=checked_dir,
        found_files=found_files,
        expected=expected,
    )


def _raise_model_missing(
    spec: ModelSpec,
    status: AssetCheck,
    stdout_tail: str | None = None,
    stderr_tail: str | None = None,
) -> None:
    raise AiServiceError(
        code="MODEL_NOT_AVAILABLE",
        message=(
            f"{spec.name.upper()} model assets are missing in {status.checked_dir}. "
            f"Found files: {status.found_files}. {model_fetch_hint()}"
        ),
        details={
            "model": spec.name,
            "hf_id": spec.hf_id,
            "missing": status.missing,
            "directory": str(spec.target_dir),
            "dir": str(status.checked_dir),
            "found_files": status.found_files,
            "expected_files": status.expected,
            "hint": model_fetch_hint(),
            "stdout_tail": stdout_tail,
            "stderr_tail": stderr_tail,
        },
        http_status=503,
    )


def _conversion_env(settings: Settings, offline: bool) -> dict[str, str]:
    env = os.environ.copy()
    model_dir = Path(settings.MODEL_DIR)
    env.setdefault("HF_HOME", str(model_dir / ".hf_home"))
    env.setdefault("HUGGINGFACE_HUB_CACHE", str(model_dir / ".hf_cache"))
    env.setdefault("PYTHONUTF8", "1")
    env.setdefault("PYTHONIOENCODING", "utf-8")
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


def _tail_output(value: str | None, limit: int = 4000) -> str | None:
    if not value:
        return None
    if len(value) <= limit:
        return value
    return value[-limit:]


def _run_conversion(
    spec: ModelSpec, settings: Settings, offline: bool
) -> tuple[str | None, str | None]:
    spec.target_dir.mkdir(parents=True, exist_ok=True)
    if spec.converter == "blip_openvino_script":
        command = [
            sys.executable,
            "-m",
            "app.tools.convert_blip_to_openvino",
            "--model-id",
            settings.CAPTION_HF_ID,
            "--outdir",
            str(settings.OV_CAPTION_DIR),
        ]
    elif spec.converter == "clip_openvino_script":
        command = [
            sys.executable,
            "-m",
            "app.tools.convert_clip_to_openvino",
            "--model-id",
            "openai/clip-vit-base-patch32",
            "--outdir",
            str(settings.OV_CLIP_DIR),
        ]
    else:
        conversion_command = spec.build_conversion_command()
        if conversion_command is None:
            return None, None
        command = list(conversion_command)
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
        result = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            env=_conversion_env(settings, offline),
        )
        return result.stdout, result.stderr
    except subprocess.CalledProcessError as exc:
        raise AiServiceError(
            code="MODEL_NOT_AVAILABLE",
            message=f"Failed to convert/download {spec.name} model. {model_fetch_hint()}",
            details={
                "model": spec.name,
                "cmd": command,
                "returncode": exc.returncode,
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
                "source": spec.hf_id,
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
            status = check_assets(spec)
            if not status.missing and mode != "force":
                continue
            if offline:
                if not status.missing:
                    status = AssetCheck(
                        missing=spec.missing_files(),
                        checked_dir=spec.actual_dir or spec.target_dir,
                        found_files=_list_files(spec.actual_dir or spec.target_dir),
                    )
                _raise_model_missing(spec, status)
            if mode in {"download", "force"}:
                conversion_stdout = None
                conversion_stderr = None
                if spec.target_dir.exists():
                    if mode == "force":
                        shutil.rmtree(spec.target_dir)
                        spec.actual_dir = None
                    elif status.missing:
                        print(
                            f"{spec.name.upper()} model directory appears incomplete; "
                            "removing before re-export.",
                            file=sys.stderr,
                        )
                        shutil.rmtree(spec.target_dir)
                        spec.actual_dir = None
                conversion_stdout, conversion_stderr = _run_conversion(
                    spec, settings, offline
                )
                status = check_assets(spec)
                if status.missing:
                    _raise_model_missing(
                        spec,
                        status,
                        stdout_tail=_tail_output(conversion_stdout),
                        stderr_tail=_tail_output(conversion_stderr),
                    )
            else:
                _raise_model_missing(spec, status)

    if not offline and mode == "download":
        _write_manifest(model_dir, list(specs.values()))


def _cli_prepare() -> int:
    settings = get_settings()
    print(
        f"Preparing models (MODE=download OFFLINE={settings.OFFLINE} CLIP_SOURCE={settings.CLIP_SOURCE})"
    )
    try:
        ensure_models(mode="download", offline=settings.OFFLINE, settings=settings)
    except AiServiceError as exc:
        print(f"Model preparation failed: {exc.message}", file=sys.stderr)
        print(json.dumps(exc.details, indent=2), file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"Model preparation failed unexpectedly: {exc}", file=sys.stderr)
        return 1
    print("Model preparation completed successfully.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] != "prepare":
        print("Usage: python -m app.model_manager prepare", file=sys.stderr)
        raise SystemExit(2)
    raise SystemExit(_cli_prepare())
