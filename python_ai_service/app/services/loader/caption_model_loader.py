from __future__ import annotations

import os
import time
from functools import lru_cache
from pathlib import Path
from typing import Optional

import torch
from transformers import (
    AutoConfig,
    AutoImageProcessor,
    AutoProcessor,
    AutoTokenizer,
    VisionEncoderDecoderModel,
)

from app.config import get_settings

settings = get_settings()


def _dbg(msg: str) -> None:
    if bool(getattr(settings, "DEBUG", False)):
        print(msg, flush=True)


def _as_fs_path(p: Path) -> str:
    return os.fspath(p)


def _sanitize_model_id(model_id: str) -> str:
    # HuggingFace IDs -> sicherer Ordnername
    s = (model_id or "").strip().replace("\\", "_").replace("/", "_")
    out = []
    for ch in s:
        if ch.isalnum() or ch in "._-":
            out.append(ch)
        else:
            out.append("_")
    s2 = "".join(out)
    while "__" in s2:
        s2 = s2.replace("__", "_")
    return s2.strip("_ ") or "model"


class VisionEncDecCaptionProcessor:
    """Processor für VisionEncoderDecoderModel (z.B. vit-gpt2)."""

    supports_prompt = False
    # Prompt via decoder_input_ids ist bei ViT-GPT2 oft schlechter/instabil.
    # Wenn du es explizit willst, setze das in deiner eigenen Klasse/Variante auf True.
    allow_decoder_input_prompt = False

    def __init__(self, image_processor, tokenizer):
        self.image_processor = image_processor
        self.tokenizer = tokenizer

    def __call__(self, images, text=None, return_tensors: str = "pt"):
        # text wird bewusst ignoriert: viele ViT-GPT2 Pipelines werden instabil mit Text-Prompts
        return self.image_processor(images=images, return_tensors=return_tensors)

    def decode(self, token_ids, skip_special_tokens: bool = True) -> str:
        return self.tokenizer.decode(token_ids, skip_special_tokens=skip_special_tokens)


class BlipCaptionProcessor:
    """Processor für BLIP (Salesforce/blip-image-captioning-*)."""

    supports_prompt = True
    allow_decoder_input_prompt = False

    def __init__(self, processor):
        self._p = processor
        self.tokenizer = getattr(processor, "tokenizer", None)

    def __call__(self, images, text=None, return_tensors: str = "pt"):
        if text:
            return self._p(images=images, text=text, return_tensors=return_tensors)
        return self._p(images=images, return_tensors=return_tensors)

    def decode(self, token_ids, skip_special_tokens: bool = True) -> str:
        if hasattr(self._p, "decode"):
            return self._p.decode(token_ids, skip_special_tokens=skip_special_tokens)
        if self.tokenizer is None:
            return ""
        return self.tokenizer.decode(token_ids, skip_special_tokens=skip_special_tokens)


def _infer_model_type(model_id_or_dir: str, local_only: bool) -> str:
    cfg = AutoConfig.from_pretrained(model_id_or_dir, local_files_only=local_only)
    return (getattr(cfg, "model_type", None) or "").strip().lower()


def _ov_available_devices() -> Optional[list]:
    try:
        import openvino as ov  # type: ignore

        core = ov.Core()
        return list(core.available_devices)
    except Exception as e:
        _dbg(f"[DEBUG] CAPTION[OV]: device query failed -> {e}")
        return None


def _patch_generation_ids(model, tokenizer) -> None:
    try:
        if tokenizer is None:
            return
        if getattr(tokenizer, "pad_token", None) is None and getattr(tokenizer, "eos_token", None) is not None:
            tokenizer.pad_token = tokenizer.eos_token

        if model is not None and getattr(model, "config", None) is not None:
            if getattr(model.config, "pad_token_id", None) is None and getattr(tokenizer, "pad_token_id", None) is not None:
                model.config.pad_token_id = tokenizer.pad_token_id
            if getattr(model.config, "eos_token_id", None) is None and getattr(tokenizer, "eos_token_id", None) is not None:
                model.config.eos_token_id = tokenizer.eos_token_id
            if getattr(model.config, "decoder_start_token_id", None) is None and getattr(tokenizer, "bos_token_id", None) is not None:
                model.config.decoder_start_token_id = tokenizer.bos_token_id
    except Exception as e:
        _dbg(f"[DEBUG] CAPTION: patch ids failed -> {e}")


def _load_processor(model_id_or_dir: str, model_type: str, local_only: bool):
    if model_type == "blip":
        proc = AutoProcessor.from_pretrained(model_id_or_dir, local_files_only=local_only)
        return BlipCaptionProcessor(proc)

    image_processor = AutoImageProcessor.from_pretrained(model_id_or_dir, local_files_only=local_only)
    tokenizer = AutoTokenizer.from_pretrained(model_id_or_dir, local_files_only=local_only)
    return VisionEncDecCaptionProcessor(image_processor, tokenizer)


def _ov_try_load_vision2seq(model_id: str, local_only: bool):
    backend = (getattr(settings, "CAPTION_BACKEND", "auto") or "auto").strip().lower()
    if backend not in ("auto", "openvino", "ov"):
        return None

    try:
        from optimum.intel.openvino import OVModelForVision2Seq  # type: ignore
    except Exception as e:
        _dbg(f"[DEBUG] CAPTION[OV]: optimum-intel/openvino missing -> {e}")
        if backend in ("openvino", "ov"):
            raise RuntimeError(
                "CAPTION_BACKEND=openvino aber optimum-intel/openvino fehlt. Install: pip install openvino optimum-intel"
            ) from e
        return None

    ov_device = (getattr(settings, "OPENVINO_DEVICE", "GPU") or "GPU").strip()
    allow_export = bool(getattr(settings, "CAPTION_OPENVINO_ALLOW_EXPORT", True))
    force_export = bool(getattr(settings, "CAPTION_OPENVINO_FORCE_EXPORT", False))

    # Cache dir (kompiliertes Model-Cache)
    cache_dir = (getattr(settings, "OPENVINO_CACHE_DIR", "") or "").strip()
    if not cache_dir:
        cache_dir = os.path.join(getattr(settings, "MODEL_STORE_DIR", os.getcwd()), "openvino_cache")
    ov_config = {"CACHE_DIR": cache_dir} if cache_dir else None

    ov_dir = Path(getattr(settings, "CAPTION_OPENVINO_DIR", "") or "")
    if not str(ov_dir).strip():
        ov_dir = Path(getattr(settings, "MODEL_STORE_DIR", os.getcwd())) / "openvino" / _sanitize_model_id(model_id)

    has_xml = ov_dir.exists() and any(ov_dir.glob("*.xml"))
    has_bin = ov_dir.exists() and any(ov_dir.glob("*.bin"))
    has_export = bool(has_xml and has_bin)

    if bool(getattr(settings, "DEBUG", False)):
        _dbg(f"[DEBUG] CAPTION: requested model='{model_id}' model_type='{_infer_model_type(model_id, local_only)}'")
        _dbg(f"[DEBUG] CAPTION: ov_dir='{_as_fs_path(ov_dir)}' ov_device='{ov_device}' cache_dir='{cache_dir}' local_only={local_only}")
        devs = _ov_available_devices()
        if devs is not None:
            _dbg(f"[DEBUG] CAPTION[OV]: available_devices={devs}")

    # 1) Load exported model
    if has_export and not force_export:
        t0 = time.perf_counter()
        try:
            model = OVModelForVision2Seq.from_pretrained(
                _as_fs_path(ov_dir),
                device=ov_device,
                compile=True,
                ov_config=ov_config,
            )
            ov_model_type = _infer_model_type(_as_fs_path(ov_dir), local_only=True)
            processor = _load_processor(_as_fs_path(ov_dir), ov_model_type, local_only=True)
            _patch_generation_ids(model, getattr(processor, "tokenizer", None))
            _dbg(f"[DEBUG] CAPTION[OV]: loaded exported in {time.perf_counter() - t0:.2f}s")
            return model, processor, torch.device("cpu"), f"openvino:{ov_device}"
        except Exception as e:
            _dbg(f"[DEBUG] CAPTION[OV]: loading exported failed -> {e}")
            if backend in ("openvino", "ov"):
                raise

    # 2) Export if allowed
    if not allow_export:
        _dbg(f"[DEBUG] CAPTION[OV]: export disabled and no export present at '{_as_fs_path(ov_dir)}'")
        if backend in ("openvino", "ov"):
            raise RuntimeError(f"CAPTION_BACKEND=openvino aber kein exportiertes Model in: {ov_dir}")
        return None

    ov_dir.mkdir(parents=True, exist_ok=True)

    _dbg(f"[DEBUG] CAPTION[OV]: exporting '{model_id}' -> '{_as_fs_path(ov_dir)}' device='{ov_device}' (local_only={local_only}) ...")
    t0 = time.perf_counter()

    try:
        # Export möglichst stabil: FP32 laden (vermeidet Trace-Mismatch durch FP16-Rundung)
        try:
            model = OVModelForVision2Seq.from_pretrained(
                model_id,
                export=True,
                device=ov_device,
                compile=True,
                local_files_only=local_only,
                ov_config=ov_config,
                torch_dtype=torch.float32,
            )
        except TypeError:
            model = OVModelForVision2Seq.from_pretrained(
                model_id,
                export=True,
                device=ov_device,
                compile=True,
                local_files_only=local_only,
                ov_config=ov_config,
            )

        model.save_pretrained(_as_fs_path(ov_dir))

        model_type = _infer_model_type(model_id, local_only=local_only)
        if model_type == "blip":
            proc = AutoProcessor.from_pretrained(model_id, local_files_only=local_only)
            proc.save_pretrained(_as_fs_path(ov_dir))
            processor = BlipCaptionProcessor(proc)
        else:
            image_processor = AutoImageProcessor.from_pretrained(model_id, local_files_only=local_only)
            tokenizer = AutoTokenizer.from_pretrained(model_id, local_files_only=local_only)
            image_processor.save_pretrained(_as_fs_path(ov_dir))
            tokenizer.save_pretrained(_as_fs_path(ov_dir))
            processor = VisionEncDecCaptionProcessor(image_processor, tokenizer)

        _patch_generation_ids(model, getattr(processor, "tokenizer", None))
        _dbg(f"[DEBUG] CAPTION[OV]: exported+loaded in {time.perf_counter() - t0:.2f}s")
        return model, processor, torch.device("cpu"), f"openvino:{ov_device}"
    except Exception as e:
        _dbg(f"[DEBUG] CAPTION[OV]: export failed -> {e}")
        if backend in ("openvino", "ov"):
            raise
        return None


def _torch_load(model_id: str, local_only: bool):
    t0 = time.perf_counter()
    device_name = (getattr(settings, "CAPTION_DEVICE", "cpu") or "cpu").strip().lower()
    device = torch.device("cuda" if device_name == "cuda" and torch.cuda.is_available() else "cpu")

    model_type = _infer_model_type(model_id, local_only=local_only)

    if model_type == "blip":
        try:
            from transformers import AutoModelForVision2Seq  # type: ignore
            model = AutoModelForVision2Seq.from_pretrained(model_id, local_files_only=local_only)
        except Exception:
            from transformers import BlipForConditionalGeneration  # type: ignore
            model = BlipForConditionalGeneration.from_pretrained(model_id, local_files_only=local_only)
        processor = _load_processor(model_id, model_type, local_only=local_only)
        _patch_generation_ids(model, getattr(processor, "tokenizer", None))
    else:
        model = VisionEncoderDecoderModel.from_pretrained(model_id, local_files_only=local_only)
        processor = _load_processor(model_id, model_type, local_only=local_only)
        _patch_generation_ids(model, getattr(processor, "tokenizer", None))

    model.to(device)
    model.eval()
    _dbg(f"[DEBUG] CAPTION[TORCH]: loaded in {time.perf_counter() - t0:.2f}s device='{device}'")
    return model, processor, device, f"torch:{device}"


@lru_cache(maxsize=1)
def get_caption_model():
    model_id = (getattr(settings, "CAPTION_MODEL_NAME", "") or "").strip()
    if not model_id:
        model_id = "nlpconnect/vit-gpt2-image-captioning"

    # 100% nur Env-Flags: wenn offline -> local_files_only
    local_only = bool(getattr(settings, "HF_HUB_OFFLINE", False) or getattr(settings, "TRANSFORMERS_OFFLINE", False))

    backend = (getattr(settings, "CAPTION_BACKEND", "auto") or "auto").strip().lower()

    ov = _ov_try_load_vision2seq(model_id, local_only=local_only)
    if ov is not None:
        return ov

    if backend in ("openvino", "ov"):
        raise RuntimeError("CAPTION_BACKEND=openvino aber OpenVINO-Backend konnte nicht geladen werden.")

    return _torch_load(model_id, local_only=local_only)
