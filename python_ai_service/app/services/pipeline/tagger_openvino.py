from __future__ import annotations

from dataclasses import dataclass
import logging
from pathlib import Path

import numpy as np
from PIL import Image
import openvino as ov
import openvino_genai as ov_genai

from ...config import get_settings
from ...contracts_models import Tag
from ...model_manager import build_model_specs, check_assets, model_fetch_hint
from ..errors import AiServiceError
from .normalize import normalize_tags

settings = get_settings()
logger = logging.getLogger("tvwallau-ai")


@dataclass(frozen=True)
class ClipCandidate:
    value: str


CANDIDATES_EN: list[ClipCandidate] = [
    ClipCandidate("socks"),
    ClipCandidate("tennis socks"),
    ClipCandidate("crew socks"),
    ClipCandidate("t-shirt"),
    ClipCandidate("hoodie"),
    ClipCandidate("sweatshirt"),
    ClipCandidate("jacket"),
    ClipCandidate("pants"),
    ClipCandidate("shorts"),
    ClipCandidate("shoes"),
    ClipCandidate("sneakers"),
    ClipCandidate("white"),
    ClipCandidate("black"),
    ClipCandidate("beige"),
    ClipCandidate("brown"),
    ClipCandidate("blue"),
    ClipCandidate("red"),
    ClipCandidate("green"),
    ClipCandidate("grey"),
    ClipCandidate("striped"),
    ClipCandidate("leopard print"),
    ClipCandidate("animal print"),
    ClipCandidate("logo"),
    ClipCandidate("sport"),
    ClipCandidate("casual"),
    ClipCandidate("adidas"),
    ClipCandidate("nike"),
    ClipCandidate("puma"),
]


def _resolve_clip_dir() -> tuple[Path, list[str]]:
    spec = build_model_specs(settings)["clip"]
    status = check_assets(spec)
    return status.checked_dir, status.found_files


def _preprocess_image(image: Image.Image, size: int = 224) -> np.ndarray:
    resized = image.resize((size, size))
    array = np.asarray(resized).astype(np.float32) / 255.0
    mean = np.array([0.48145466, 0.4578275, 0.40821073], dtype=np.float32)
    std = np.array([0.26862954, 0.26130258, 0.27577711], dtype=np.float32)
    array = (array - mean) / std
    array = np.transpose(array, (2, 0, 1))
    return np.expand_dims(array, axis=0)


class ClipTagger:
    def __init__(self, device: str) -> None:
        clip_dir, found_files = _resolve_clip_dir()
        image_model_path = clip_dir / "image_encoder.xml"
        text_model_path = clip_dir / "text_encoder.xml"
        combined_model_path = clip_dir / "openvino_model.xml"
        tokenizer_path = clip_dir / "tokenizer.json"
        core = ov.Core()
        self.image_model: ov.CompiledModel | None = None
        self.text_model: ov.CompiledModel | None = None
        self.combined_model: ov.CompiledModel | None = None
        self.combined_inputs: dict[str, str] = {}
        self.combined_image_shape: tuple[int, int, int, int] | None = None
        self.combined_text_seq_len: int | None = None
        if image_model_path.exists() and text_model_path.exists():
            if not tokenizer_path.exists():
                raise AiServiceError(
                    code="MODEL_NOT_AVAILABLE",
                    message=(
                        "CLIP tokenizer.json is missing for dual-encoder CLIP. "
                        f"{model_fetch_hint()}"
                    ),
                    details={
                        "model": "clip",
                        "missing": [str(tokenizer_path)],
                        "directory": str(clip_dir),
                        "found_files": found_files,
                        "hint": model_fetch_hint(),
                    },
                    http_status=503,
                )
            logger.info("CLIP loaded as dual-encoder (image_encoder.xml/text_encoder.xml)")
            self.image_model = core.compile_model(core.read_model(image_model_path), device)
            self.text_model = core.compile_model(core.read_model(text_model_path), device)
        elif combined_model_path.exists():
            if not tokenizer_path.exists():
                raise AiServiceError(
                    code="MODEL_NOT_AVAILABLE",
                    message=(
                        "CLIP tokenizer.json is missing for single-graph CLIP. "
                        f"{model_fetch_hint()}"
                    ),
                    details={
                        "model": "clip",
                        "missing": [str(tokenizer_path)],
                        "directory": str(clip_dir),
                        "found_files": found_files,
                        "hint": model_fetch_hint(),
                    },
                    http_status=503,
                )
            model = core.read_model(combined_model_path)
            input_names = [tensor.get_any_name() for tensor in model.inputs]
            logger.info(
                "CLIP loaded as single-graph OpenVINO model (openvino_model.xml) inputs=%s",
                input_names,
            )
            pixel_name = next(
                (name for name in input_names if "pixel" in name.lower() or "image" in name.lower()),
                None,
            )
            input_ids_name = next(
                (name for name in input_names if "input_ids" in name.lower()), None
            )
            attention_mask_name = next(
                (name for name in input_names if "attention_mask" in name.lower()), None
            )
            if not pixel_name or not input_ids_name or not attention_mask_name:
                raise AiServiceError(
                    code="MODEL_NOT_AVAILABLE",
                    message="Single-graph CLIP model inputs are not compatible.",
                    details={
                        "model": "clip",
                        "found_inputs": input_names,
                        "hint": model_fetch_hint(),
                    },
                    http_status=503,
                )
            self.combined_inputs = {
                "pixel_values": pixel_name,
                "input_ids": input_ids_name,
                "attention_mask": attention_mask_name,
            }
            pixel_shape = model.input(pixel_name).get_partial_shape()
            if pixel_shape.is_dynamic:
                self.combined_image_shape = (1, 3, 224, 224)
            else:
                self.combined_image_shape = tuple(int(dim) for dim in pixel_shape)
            text_shape = model.input(input_ids_name).get_partial_shape()
            if not text_shape.is_dynamic and len(text_shape) > 1:
                self.combined_text_seq_len = int(text_shape[1])
            self.combined_model = core.compile_model(model, device)
        else:
            raise AiServiceError(
                code="MODEL_NOT_AVAILABLE",
                message=(
                    "CLIP model assets are missing. Expected image_encoder.xml + "
                    "text_encoder.xml or openvino_model.xml with tokenizer.json."
                ),
                details={
                    "model": "clip",
                    "found_files": found_files,
                    "directory": str(clip_dir),
                    "expected_files": [
                        "image_encoder.xml",
                        "image_encoder.bin",
                        "text_encoder.xml",
                        "text_encoder.bin",
                        "openvino_model.xml",
                        "openvino_model.bin",
                        "tokenizer.json",
                    ],
                    "hint": model_fetch_hint(),
                },
                http_status=503,
            )
        self.tokenizer = ov_genai.Tokenizer(str(tokenizer_path))

    def _prepare_text_inputs(self, texts: list[str]) -> tuple[np.ndarray, np.ndarray]:
        tokenized = self.tokenizer.encode_batch(texts)
        input_ids = np.array(tokenized.input_ids, dtype=np.int64)
        attention_mask = np.array(tokenized.attention_mask, dtype=np.int64)
        if self.combined_text_seq_len:
            input_ids = self._pad_or_trim(input_ids, self.combined_text_seq_len)
            attention_mask = self._pad_or_trim(attention_mask, self.combined_text_seq_len)
        return input_ids, attention_mask

    @staticmethod
    def _pad_or_trim(values: np.ndarray, target_len: int) -> np.ndarray:
        if values.shape[1] == target_len:
            return values
        if values.shape[1] > target_len:
            return values[:, :target_len]
        padding = target_len - values.shape[1]
        return np.pad(values, ((0, 0), (0, padding)), mode="constant")

    def _dummy_image(self) -> np.ndarray:
        shape = self.combined_image_shape or (1, 3, 224, 224)
        return np.zeros(shape, dtype=np.float32)

    def _encode_text(self, texts: list[str]) -> np.ndarray:
        if self.combined_model:
            input_ids, attention_mask = self._prepare_text_inputs(texts)
            inputs = {
                self.combined_inputs["input_ids"]: input_ids,
                self.combined_inputs["attention_mask"]: attention_mask,
                self.combined_inputs["pixel_values"]: self._dummy_image(),
            }
            output = self.combined_model(inputs)
            embedding = next(iter(output.values()))
            return embedding
        if not self.text_model:
            raise AiServiceError(
                code="MODEL_NOT_AVAILABLE",
                message="CLIP text encoder is not available.",
                details={"model": "clip", "hint": model_fetch_hint()},
                http_status=503,
            )
        input_ids, attention_mask = self._prepare_text_inputs(texts)
        inputs = {}
        for input_tensor in self.text_model.inputs:
            name = input_tensor.get_any_name()
            if "attention" in name:
                inputs[name] = attention_mask
            else:
                inputs[name] = input_ids
        output = self.text_model(inputs)
        embedding = next(iter(output.values()))
        return embedding

    def _encode_image(self, image: Image.Image) -> np.ndarray:
        tensor = _preprocess_image(image)
        if self.combined_model:
            input_ids, attention_mask = self._prepare_text_inputs([""])
            inputs = {
                self.combined_inputs["pixel_values"]: tensor,
                self.combined_inputs["input_ids"]: input_ids,
                self.combined_inputs["attention_mask"]: attention_mask,
            }
            output = self.combined_model(inputs)
            embedding = next(iter(output.values()))
            return embedding
        if not self.image_model:
            raise AiServiceError(
                code="MODEL_NOT_AVAILABLE",
                message="CLIP image encoder is not available.",
                details={"model": "clip", "hint": model_fetch_hint()},
                http_status=503,
            )
        inputs = {self.image_model.input(0): tensor}
        output = self.image_model(inputs)
        embedding = next(iter(output.values()))
        return embedding

    def predict(self, images: list[Image.Image], max_tags: int) -> list[Tag]:
        max_tags = max(1, max_tags)
        prompts = [f"a photo of {c.value}" for c in CANDIDATES_EN]
        text_features = self._encode_text(prompts)
        text_features = text_features / np.linalg.norm(text_features, axis=-1, keepdims=True)

        selected: list[str] = []
        scored_tags: list[Tag] = []
        for image in images:
            image_features = self._encode_image(image)
            image_features = image_features / np.linalg.norm(
                image_features, axis=-1, keepdims=True
            )
            sims = np.matmul(image_features, text_features.T).squeeze(0)
            top_indices = np.argsort(sims)[::-1][:max_tags]
            for idx in top_indices:
                selected.append(CANDIDATES_EN[idx].value)
                scored_tags.append(
                    Tag(value=CANDIDATES_EN[idx].value.lower(), score=float(sims[idx]), source="clip")
                )

        normalized = normalize_tags(selected)
        normalized_set = set(normalized)
        filtered = [tag for tag in scored_tags if tag.value in normalized_set]
        deduped: dict[str, Tag] = {}
        for tag in filtered:
            if tag.value not in deduped:
                deduped[tag.value] = tag
        return list(deduped.values())[:max_tags]
