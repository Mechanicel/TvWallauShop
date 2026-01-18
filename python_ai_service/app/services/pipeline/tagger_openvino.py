from __future__ import annotations

from dataclasses import dataclass
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


def _resolve_clip_paths() -> tuple[Path, Path, Path]:
    spec = build_model_specs(settings)["clip"]
    base = spec.target_dir
    tokenizer = base / "tokenizer.json"
    image_model = base / "image_encoder.xml"
    text_model = base / "text_encoder.xml"
    missing = check_assets(spec)
    if missing:
        raise AiServiceError(
            code="MODEL_NOT_AVAILABLE",
            message=f"CLIP model assets are missing. {model_fetch_hint()}",
            details={
                "model": "clip",
                "missing": missing,
                "directory": str(base),
                "hint": model_fetch_hint(),
            },
            http_status=503,
        )
    return image_model, text_model, tokenizer


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
        image_model_path, text_model_path, tokenizer_path = _resolve_clip_paths()
        core = ov.Core()
        self.image_model = core.compile_model(core.read_model(image_model_path), device)
        self.text_model = core.compile_model(core.read_model(text_model_path), device)
        self.tokenizer = ov_genai.Tokenizer(str(tokenizer_path))

    def _encode_text(self, texts: list[str]) -> np.ndarray:
        tokenized = self.tokenizer.encode_batch(texts)
        input_ids = np.array(tokenized.input_ids, dtype=np.int64)
        attention_mask = np.array(tokenized.attention_mask, dtype=np.int64)
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
