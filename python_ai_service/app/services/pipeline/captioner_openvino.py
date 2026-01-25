from __future__ import annotations

from dataclasses import dataclass
import logging
from pathlib import Path

import numpy as np
from PIL import Image
import openvino as ov
from transformers import BlipProcessor

from ...config import get_settings
from ...contracts_models import AnalyzeDebug, Caption
from ...model_manager import build_model_specs, check_assets, model_fetch_hint
from ...ov_runtime import compile_strict, create_core
from ..errors import AiServiceError

settings = get_settings()
logger = logging.getLogger("tvwallau-ai")


@dataclass(frozen=True)
class CaptionPaths:
    base: Path
    vision_encoder: Path
    text_decoder: Path


def _resolve_caption_paths() -> CaptionPaths:
    spec = build_model_specs(settings)["caption"]
    base = spec.target_dir
    vision_encoder = base / "vision_encoder.xml"
    text_decoder = base / "text_decoder.xml"
    status = check_assets(spec)
    if status.missing:
        raise AiServiceError(
            code="MODEL_NOT_AVAILABLE",
            message=f"Caption model assets are missing. {model_fetch_hint()}",
            details={
                "model": "caption",
                "missing": status.missing,
                "dir": str(status.checked_dir),
                "hf_id": spec.hf_id,
                "directory": str(base),
                "expected_files": status.expected,
                "found_files": status.found_files,
                "hint": model_fetch_hint(),
            },
            http_status=503,
        )
    return CaptionPaths(
        base=base,
        vision_encoder=vision_encoder,
        text_decoder=text_decoder,
    )


class Captioner:
    def __init__(self, device: str) -> None:
        paths = _resolve_caption_paths()
        core = create_core(settings.OV_CACHE_DIR)
        self.vision_encoder = compile_strict(
            core,
            core.read_model(paths.vision_encoder),
            device,
            model_name="blip-vision",
            log=logger,
        )
        text_decoder_model = core.read_model(paths.text_decoder)
        self.text_decoder = compile_strict(
            core, text_decoder_model, device, model_name="blip-text", log=logger
        )
        self.processor = BlipProcessor.from_pretrained(paths.base)
        self.tokenizer = self.processor.tokenizer
        self.bos_token_id = self.tokenizer.bos_token_id or self.tokenizer.cls_token_id or 0
        self.eos_token_id = self.tokenizer.eos_token_id
        self.max_length = min(getattr(self.tokenizer, "model_max_length", 30), 30)
        image_processor = getattr(self.processor, "image_processor", None)
        self.image_mean = getattr(image_processor, "image_mean", [0.485, 0.456, 0.406])
        self.image_std = getattr(image_processor, "image_std", [0.229, 0.224, 0.225])
        self.expected_h = 224
        self.expected_w = 224
        inp_shape = list(self.vision_encoder.inputs[0].shape)
        if len(inp_shape) >= 4:
            h_dim = inp_shape[2]
            w_dim = inp_shape[3]
            if hasattr(h_dim, "is_dynamic") and h_dim.is_dynamic:
                self.expected_h = 224
            else:
                self.expected_h = int(h_dim)
            if hasattr(w_dim, "is_dynamic") and w_dim.is_dynamic:
                self.expected_w = 224
            else:
                self.expected_w = int(w_dim)
        logger.info(
            "BLIP vision encoder expects shape=[1,3,H,W] -> H=%s W=%s",
            self.expected_h,
            self.expected_w,
        )
        self.text_decoder_shapes = self._read_text_decoder_shapes(text_decoder_model)
        logger.info(
            "BLIP text decoder input_ids partial_shape=%s attention_mask partial_shape=%s",
            self.text_decoder_shapes.get("input_ids"),
            self.text_decoder_shapes.get("attention_mask"),
        )

    @staticmethod
    def _read_text_decoder_shapes(model: ov.Model) -> dict[str, ov.PartialShape]:
        shapes: dict[str, ov.PartialShape] = {}
        for input_tensor in model.inputs:
            name = input_tensor.get_any_name()
            if "input_ids" in name:
                shapes["input_ids"] = input_tensor.get_partial_shape()
            elif "attention_mask" in name:
                shapes["attention_mask"] = input_tensor.get_partial_shape()
        return shapes

    def generate(
        self,
        images: list[Image.Image],
        max_captions: int,
        debug: AnalyzeDebug | None = None,
    ) -> list[Caption]:
        captions: list[Caption] = []
        for index, image in enumerate(images):
            for _ in range(max(1, max_captions)):
                text = self._generate_caption(image, index)
                if not text:
                    raise AiServiceError(
                        code="INFERENCE_FAILED",
                        message="Caption model returned empty caption.",
                        details={"imageIndex": index},
                        http_status=500,
                    )
                captions.append(Caption(image_index=index, text=text, source="blip"))

        if debug and captions:
            debug.blip_caption = captions[0].text
            logger.info("BLIP first caption: %s", captions[0].text)

        return captions

    def _encode_image(self, image: Image.Image) -> np.ndarray:
        if image.mode != "RGB":
            image = image.convert("RGB")
        image_resized = image.resize(
            (self.expected_w, self.expected_h), resample=Image.BILINEAR
        )
        arr = np.asarray(image_resized).astype(np.float32) / 255.0
        arr = np.transpose(arr, (2, 0, 1))
        arr = np.expand_dims(arr, axis=0)
        mean = np.array(self.image_mean, dtype=np.float32).reshape(1, 3, 1, 1)
        std = np.array(self.image_std, dtype=np.float32).reshape(1, 3, 1, 1)
        arr = (arr - mean) / std
        expected_shape = (1, 3, self.expected_h, self.expected_w)
        if arr.shape != expected_shape:
            raise AiServiceError(
                code="INFERENCE_FAILED",
                message="BLIP vision encoder input shape mismatch.",
                details={
                    "expected": list(expected_shape),
                    "got": list(arr.shape),
                },
                http_status=503,
            )
        outputs = self.vision_encoder({self.vision_encoder.input(0): arr})
        hidden_states = next(iter(outputs.values()))
        return hidden_states

    def _decode(
        self,
        encoder_hidden_states: np.ndarray,
        input_ids: np.ndarray,
        attention_mask: np.ndarray,
        step: int,
    ) -> np.ndarray:
        if input_ids.shape != attention_mask.shape:
            raise AiServiceError(
                code="INFERENCE_FAILED",
                message="BLIP text decoder input shape mismatch.",
                details={
                    "input_ids": list(input_ids.shape),
                    "attention_mask": list(attention_mask.shape),
                    "step": step,
                },
                http_status=500,
            )
        if input_ids.shape[0] != 1:
            raise AiServiceError(
                code="INFERENCE_FAILED",
                message="BLIP text decoder batch size must be 1.",
                details={"input_ids": list(input_ids.shape), "step": step},
                http_status=500,
            )
        if input_ids.dtype != np.int64:
            input_ids = input_ids.astype(np.int64)
        if attention_mask.dtype != np.int64:
            attention_mask = attention_mask.astype(np.int64)
        inputs: dict[str, np.ndarray] = {}
        for input_tensor in self.text_decoder.inputs:
            name = input_tensor.get_any_name()
            if "input_ids" in name:
                inputs[name] = input_ids
            elif "encoder_hidden_states" in name:
                inputs[name] = encoder_hidden_states
            elif "attention_mask" in name:
                inputs[name] = attention_mask
        try:
            outputs = self.text_decoder(inputs)
            logits = next(iter(outputs.values()))
        except Exception as exc:
            raise AiServiceError(
                code="INFERENCE_FAILED",
                message="BLIP text decoder failed to run with provided shapes.",
                details={
                    "expected_partial_shapes": {
                        "input_ids": str(self.text_decoder_shapes.get("input_ids")),
                        "attention_mask": str(
                            self.text_decoder_shapes.get("attention_mask")
                        ),
                    },
                    "got_shapes": {
                        "input_ids": list(input_ids.shape),
                        "attention_mask": list(attention_mask.shape),
                    },
                    "step": step,
                    "error": str(exc),
                },
                http_status=500,
            ) from exc
        if logits.size == 0:
            raise AiServiceError(
                code="INFERENCE_FAILED",
                message="Caption model returned empty output.",
                details={},
                http_status=500,
            )
        return logits

    def _generate_caption(self, image: Image.Image, index: int) -> str:
        encoder_hidden_states = self._encode_image(image)
        input_ids = np.array([[self.bos_token_id]], dtype=np.int64)

        for step in range(self.max_length):
            attention_mask = np.ones_like(input_ids)
            logits = self._decode(
                encoder_hidden_states, input_ids, attention_mask, step
            )
            next_token = int(np.argmax(logits[:, -1, :], axis=-1)[0])
            input_ids = np.concatenate(
                [input_ids, np.array([[next_token]], dtype=np.int64)], axis=1
            )
            if self.eos_token_id is not None and next_token == self.eos_token_id:
                break

        token_ids = input_ids[0].tolist()
        return self.tokenizer.decode(token_ids, skip_special_tokens=True).strip()
