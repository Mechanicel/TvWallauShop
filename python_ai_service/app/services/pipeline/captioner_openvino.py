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
    text_decoder_with_past: Path


def _resolve_caption_paths() -> CaptionPaths:
    spec = build_model_specs(settings)["caption"]
    base = spec.target_dir
    vision_encoder = base / "vision_encoder.xml"
    text_decoder = base / "text_decoder.xml"
    text_decoder_with_past = base / "text_decoder_with_past.xml"
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
        text_decoder_with_past=text_decoder_with_past,
    )


class Captioner:
    def __init__(self, device: str) -> None:
        paths = _resolve_caption_paths()
        core = ov.Core()
        self.vision_encoder = core.compile_model(
            core.read_model(paths.vision_encoder), device
        )
        self.text_decoder = core.compile_model(core.read_model(paths.text_decoder), device)
        self.text_decoder_with_past = core.compile_model(
            core.read_model(paths.text_decoder_with_past), device
        )
        self.processor = BlipProcessor.from_pretrained(paths.base)
        self.tokenizer = self.processor.tokenizer
        self.bos_token_id = self.tokenizer.bos_token_id or self.tokenizer.cls_token_id or 0
        self.eos_token_id = self.tokenizer.eos_token_id
        self.max_length = min(getattr(self.tokenizer, "model_max_length", 30), 30)
        self._decoder_past_input_names = [
            inp.get_any_name()
            for inp in self.text_decoder_with_past.inputs
            if not self._is_standard_decoder_input(inp.get_any_name())
        ]

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

    def _encode_image(self, image: Image.Image) -> tuple[np.ndarray, np.ndarray]:
        inputs = self.processor(images=image, return_tensors="np")
        pixel_values = inputs["pixel_values"]
        outputs = self.vision_encoder({self.vision_encoder.input(0): pixel_values})
        hidden_states = next(iter(outputs.values()))
        encoder_attention_mask = np.ones(hidden_states.shape[:2], dtype=np.int64)
        return hidden_states, encoder_attention_mask

    def _decode_first_step(
        self,
        encoder_hidden_states: np.ndarray,
        encoder_attention_mask: np.ndarray,
        input_ids: np.ndarray,
        attention_mask: np.ndarray,
    ) -> tuple[np.ndarray, list[np.ndarray]]:
        inputs = self._build_decoder_inputs(
            self.text_decoder,
            encoder_hidden_states,
            encoder_attention_mask,
            input_ids,
            attention_mask,
            past=None,
        )
        outputs = self.text_decoder(inputs)
        return self._split_decoder_outputs(outputs, self.text_decoder)

    def _decode_with_past(
        self,
        encoder_hidden_states: np.ndarray,
        encoder_attention_mask: np.ndarray,
        input_ids: np.ndarray,
        attention_mask: np.ndarray,
        past: list[np.ndarray],
    ) -> tuple[np.ndarray, list[np.ndarray]]:
        inputs = self._build_decoder_inputs(
            self.text_decoder_with_past,
            encoder_hidden_states,
            encoder_attention_mask,
            input_ids,
            attention_mask,
            past=past,
        )
        outputs = self.text_decoder_with_past(inputs)
        return self._split_decoder_outputs(outputs, self.text_decoder_with_past)

    def _build_decoder_inputs(
        self,
        compiled_model: ov.CompiledModel,
        encoder_hidden_states: np.ndarray,
        encoder_attention_mask: np.ndarray,
        input_ids: np.ndarray,
        attention_mask: np.ndarray,
        past: list[np.ndarray] | None,
    ) -> dict[str, np.ndarray]:
        inputs: dict[str, np.ndarray] = {}
        for input_tensor in compiled_model.inputs:
            name = input_tensor.get_any_name()
            if "input_ids" in name:
                inputs[name] = input_ids
            elif "encoder_hidden_states" in name:
                inputs[name] = encoder_hidden_states
            elif "encoder_attention_mask" in name:
                inputs[name] = encoder_attention_mask
            elif "attention_mask" in name:
                inputs[name] = attention_mask
        if past is not None:
            for name, value in zip(self._decoder_past_input_names, past):
                inputs[name] = value
        return inputs

    def _split_decoder_outputs(
        self, outputs: dict[ov.Output, np.ndarray], compiled_model: ov.CompiledModel
    ) -> tuple[np.ndarray, list[np.ndarray]]:
        ordered = [outputs[out] for out in compiled_model.outputs]
        if not ordered:
            raise AiServiceError(
                code="INFERENCE_FAILED",
                message="Caption decoder returned no outputs.",
                details={},
                http_status=500,
            )
        logits = ordered[0]
        past = ordered[1:]
        return logits, list(past)

    @staticmethod
    def _is_standard_decoder_input(name: str) -> bool:
        standard_inputs = (
            "input_ids",
            "encoder_hidden_states",
            "encoder_attention_mask",
            "attention_mask",
        )
        return any(key in name for key in standard_inputs)

    def _generate_caption(self, image: Image.Image, index: int) -> str:
        encoder_hidden_states, encoder_attention_mask = self._encode_image(image)
        input_ids = np.array([[self.bos_token_id]], dtype=np.int64)
        attention_mask = np.ones_like(input_ids)
        logits, past = self._decode_first_step(
            encoder_hidden_states, encoder_attention_mask, input_ids, attention_mask
        )
        if logits.size == 0:
            raise AiServiceError(
                code="INFERENCE_FAILED",
                message="Caption model returned empty output.",
                details={"imageIndex": index},
                http_status=500,
            )
        next_token = int(np.argmax(logits[:, -1, :], axis=-1)[0])
        generated = [next_token]

        for _ in range(self.max_length - 1):
            if self.eos_token_id is not None and next_token == self.eos_token_id:
                break
            input_ids = np.array([[next_token]], dtype=np.int64)
            attention_mask = np.ones_like(input_ids)
            logits, past = self._decode_with_past(
                encoder_hidden_states,
                encoder_attention_mask,
                input_ids,
                attention_mask,
                past,
            )
            if logits.size == 0:
                raise AiServiceError(
                    code="INFERENCE_FAILED",
                    message="Caption model returned empty output.",
                    details={"imageIndex": index},
                    http_status=500,
                )
            next_token = int(np.argmax(logits[:, -1, :], axis=-1)[0])
            generated.append(next_token)

        token_ids = [self.bos_token_id, *generated]
        return self.tokenizer.decode(token_ids, skip_special_tokens=True).strip()
