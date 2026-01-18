from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image
import openvino as ov
from transformers import BlipProcessor

from ...config import get_settings
from ...contracts_models import Caption
from ...model_manager import build_model_specs, check_assets, model_fetch_hint
from ..errors import AiServiceError

settings = get_settings()


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
        core = ov.Core()
        self.vision_encoder = core.compile_model(
            core.read_model(paths.vision_encoder), device
        )
        self.text_decoder = core.compile_model(core.read_model(paths.text_decoder), device)
        self.processor = BlipProcessor.from_pretrained(paths.base)
        self.tokenizer = self.processor.tokenizer
        self.bos_token_id = self.tokenizer.bos_token_id or self.tokenizer.cls_token_id or 0
        self.eos_token_id = self.tokenizer.eos_token_id
        self.max_length = min(getattr(self.tokenizer, "model_max_length", 30), 30)

    def generate(self, images: list[Image.Image], max_captions: int) -> list[Caption]:
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

        return captions

    def _encode_image(self, image: Image.Image) -> np.ndarray:
        inputs = self.processor(images=image, return_tensors="np")
        pixel_values = inputs["pixel_values"]
        outputs = self.vision_encoder({self.vision_encoder.input(0): pixel_values})
        hidden_states = next(iter(outputs.values()))
        return hidden_states

    def _decode(
        self,
        encoder_hidden_states: np.ndarray,
        input_ids: np.ndarray,
        attention_mask: np.ndarray,
    ) -> np.ndarray:
        inputs: dict[str, np.ndarray] = {}
        for input_tensor in self.text_decoder.inputs:
            name = input_tensor.get_any_name()
            if "input_ids" in name:
                inputs[name] = input_ids
            elif "encoder_hidden_states" in name:
                inputs[name] = encoder_hidden_states
            elif "attention_mask" in name:
                inputs[name] = attention_mask
        outputs = self.text_decoder(inputs)
        logits = next(iter(outputs.values()))
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

        for _ in range(self.max_length):
            attention_mask = np.ones_like(input_ids)
            logits = self._decode(encoder_hidden_states, input_ids, attention_mask)
            next_token = int(np.argmax(logits[:, -1, :], axis=-1)[0])
            input_ids = np.concatenate(
                [input_ids, np.array([[next_token]], dtype=np.int64)], axis=1
            )
            if self.eos_token_id is not None and next_token == self.eos_token_id:
                break

        token_ids = input_ids[0].tolist()
        return self.tokenizer.decode(token_ids, skip_special_tokens=True).strip()
