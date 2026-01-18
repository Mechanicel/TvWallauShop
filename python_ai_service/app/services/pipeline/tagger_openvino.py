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
from ...model_manager import model_fetch_hint
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


def _list_files(directory: Path) -> list[str]:
    if not directory.exists() or not directory.is_dir():
        return []
    return sorted(path.name for path in directory.iterdir() if path.is_file())


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
        clip_dir = Path(settings.OV_CLIP_DIR)
        found_files = _list_files(clip_dir)
        image_model_path = clip_dir / "image_encoder.xml"
        text_model_path = clip_dir / "text_encoder.xml"
        combined_model_path = clip_dir / "openvino_model.xml"
        tokenizer_ir_path = clip_dir / "openvino_tokenizer.xml"
        tokenizer_ir_bin_path = clip_dir / "openvino_tokenizer.bin"
        core = ov.Core()
        self.image_model: ov.CompiledModel | None = None
        self.text_model: ov.CompiledModel | None = None
        self.model: ov.CompiledModel | None = None
        self.input_names: list[str] = []
        self.output_names: list[str] = []
        self.combined_text_seq_len: int | None = None
        self._tokenizer_method: str | None = None
        self.clip_dir = clip_dir
        self.found_files = found_files
        if combined_model_path.exists():
            if not tokenizer_ir_path.exists() or not tokenizer_ir_bin_path.exists():
                raise AiServiceError(
                    code="MODEL_NOT_AVAILABLE",
                    message=(
                        "CLIP OpenVINO tokenizer IR is missing for single-graph CLIP. "
                        f"{model_fetch_hint()}"
                    ),
                    details={
                        "model": "clip",
                        "missing": [
                            str(path)
                            for path in (tokenizer_ir_path, tokenizer_ir_bin_path)
                            if not path.exists()
                        ],
                        "directory": str(clip_dir),
                        "found_files": found_files,
                        "hint": model_fetch_hint(),
                    },
                    http_status=503,
                )
            model = core.read_model(combined_model_path)
            self.model = core.compile_model(model, device)
            self.input_names = [tensor.get_any_name() for tensor in self.model.inputs]
            self.output_names = [tensor.get_any_name() for tensor in self.model.outputs]
            logger.info(
                "CLIP loaded as single-graph OpenVINO model (openvino_model.xml) inputs=%s",
                self.input_names,
            )
            input_ids_name = self._find_input_name(["input_ids"])
            if input_ids_name:
                text_shape = model.input(input_ids_name).get_partial_shape()
            else:
                text_shape = None
            if text_shape is not None and not text_shape.is_dynamic and len(text_shape) > 1:
                self.combined_text_seq_len = int(text_shape[1])
        elif image_model_path.exists() and text_model_path.exists():
            if not tokenizer_ir_path.exists() or not tokenizer_ir_bin_path.exists():
                raise AiServiceError(
                    code="MODEL_NOT_AVAILABLE",
                    message=(
                        "CLIP OpenVINO tokenizer IR is missing for dual-encoder CLIP. "
                        f"{model_fetch_hint()}"
                    ),
                    details={
                        "model": "clip",
                        "missing": [
                            str(path)
                            for path in (tokenizer_ir_path, tokenizer_ir_bin_path)
                            if not path.exists()
                        ],
                        "directory": str(clip_dir),
                        "found_files": found_files,
                        "hint": model_fetch_hint(),
                    },
                    http_status=503,
                )
            logger.info("CLIP loaded as dual-encoder (image_encoder.xml/text_encoder.xml)")
            self.image_model = core.compile_model(core.read_model(image_model_path), device)
            self.text_model = core.compile_model(core.read_model(text_model_path), device)
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
                        "openvino_tokenizer.xml",
                        "openvino_tokenizer.bin",
                    ],
                    "hint": model_fetch_hint(),
                },
                http_status=503,
            )
        self.tokenizer = ov_genai.Tokenizer(str(clip_dir))
        try:
            self.tokenizer.encode(["test"], add_special_tokens=True)
        except Exception as exc:
            raise AiServiceError(
                code="MODEL_NOT_AVAILABLE",
                message="OpenVINO tokenizer failed to load; encode() unavailable.",
                details={
                    "clip_dir": str(clip_dir),
                    "found_files": sorted(
                        [path.name for path in clip_dir.iterdir() if path.is_file()]
                    ),
                    "hint": (
                        "Ensure openvino_tokenizer.xml/bin exist and package versions "
                        "openvino/openvino-genai/openvino-tokenizers are compatible."
                    ),
                },
                http_status=503,
            ) from exc
        logger.info(
            "CLIP tokenizer loaded from %s, files_present=%s",
            clip_dir,
            found_files,
        )

    def _raise_model_unavailable(self, message: str) -> None:
        raise AiServiceError(
            code="MODEL_NOT_AVAILABLE",
            message=message,
            details={
                "clip_dir": str(self.clip_dir),
                "found_files": self.found_files,
                "model_inputs": self.input_names,
                "model_outputs": self.output_names,
            },
            http_status=503,
        )

    def _find_input_name(self, keywords: list[str]) -> str | None:
        for name in self.input_names:
            lowered = name.lower()
            if any(keyword in lowered for keyword in keywords):
                return name
        return None

    def _select_output(
        self,
        output: dict[object, np.ndarray],
        keywords: list[str],
        fallback_label: str,
    ) -> np.ndarray:
        name_map: dict[str, str] = {}
        for key in output.keys():
            if isinstance(key, str):
                name_map[key] = key
            elif hasattr(key, "get_any_name"):
                name_map[key.get_any_name()] = key  # type: ignore[assignment]
            else:
                name_map[str(key)] = key  # type: ignore[assignment]
        candidates = [
            name
            for name in name_map.keys()
            if any(keyword in name.lower() for keyword in keywords)
        ]
        if len(candidates) > 1:
            self._raise_model_unavailable(
                f"CLIP output selection for {fallback_label} is ambiguous.",
            )
        if len(candidates) == 1:
            return output[name_map[candidates[0]]]
        shape_candidates = [
            name
            for name, key in name_map.items()
            if output[key].ndim == 2 and output[key].shape[0] == 1
        ]
        if len(shape_candidates) != 1:
            self._raise_model_unavailable(
                f"CLIP output selection for {fallback_label} is not available.",
            )
        chosen = shape_candidates[0]
        logger.info(
            "CLIP output selection for %s used fallback output=%s",
            fallback_label,
            chosen,
        )
        return output[name_map[chosen]]

    def _prepare_text_inputs(
        self, texts: list[str]
    ) -> tuple[np.ndarray | ov.Tensor, np.ndarray | ov.Tensor]:
        tokenized = self.tokenizer.encode(texts)
        if self._tokenizer_method is None:
            self._tokenizer_method = "encode"
            logger.info(
                "CLIP tokenizer type=%s using method=%s",
                type(self.tokenizer),
                self._tokenizer_method,
            )
        input_ids = tokenized.input_ids
        attention_mask = tokenized.attention_mask
        if isinstance(input_ids, list):
            input_ids = np.array(input_ids, dtype=np.int64)
        if isinstance(attention_mask, list):
            attention_mask = np.array(attention_mask, dtype=np.int64)
        if isinstance(input_ids, np.ndarray) and input_ids.dtype != np.int64:
            input_ids = input_ids.astype(np.int64)
        if isinstance(attention_mask, np.ndarray) and attention_mask.dtype != np.int64:
            attention_mask = attention_mask.astype(np.int64)
        if self.combined_text_seq_len and isinstance(input_ids, np.ndarray):
            input_ids = self._pad_or_trim(input_ids, self.combined_text_seq_len)
        if self.combined_text_seq_len and isinstance(attention_mask, np.ndarray):
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

    @staticmethod
    def _dummy_image() -> np.ndarray:
        return np.zeros((1, 3, 224, 224), dtype=np.float32)

    @staticmethod
    def _dummy_text_inputs() -> tuple[np.ndarray, np.ndarray]:
        input_ids = np.zeros((1, 1), dtype=np.int64)
        attention_mask = np.ones((1, 1), dtype=np.int64)
        return input_ids, attention_mask

    def _encode_text(self, texts: list[str]) -> np.ndarray:
        if self.model:
            input_ids, attention_mask = self._prepare_text_inputs(texts)
            inputs: dict[str, np.ndarray | ov.Tensor] = {}
            input_ids_name = self._find_input_name(["input_ids"])
            attention_mask_name = self._find_input_name(["attention_mask"])
            if not input_ids_name or not attention_mask_name:
                self._raise_model_unavailable("CLIP text inputs are missing from model.")
            inputs[input_ids_name] = input_ids
            inputs[attention_mask_name] = attention_mask
            pixel_values_name = self._find_input_name(["pixel", "image"])
            if pixel_values_name:
                inputs[pixel_values_name] = self._dummy_image()
            output = self.model(inputs)
            return self._select_output(output, ["text", "text_embeds"], "text")
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
        if self.model:
            inputs: dict[str, np.ndarray] = {}
            pixel_values_name = self._find_input_name(["pixel", "image"])
            if not pixel_values_name:
                self._raise_model_unavailable("CLIP image inputs are missing from model.")
            inputs[pixel_values_name] = tensor
            input_ids_name = self._find_input_name(["input_ids"])
            attention_mask_name = self._find_input_name(["attention_mask"])
            if input_ids_name or attention_mask_name:
                input_ids, attention_mask = self._dummy_text_inputs()
                if not input_ids_name or not attention_mask_name:
                    self._raise_model_unavailable(
                        "CLIP text inputs are incomplete for image encoding."
                    )
                inputs[input_ids_name] = input_ids
                inputs[attention_mask_name] = attention_mask
            output = self.model(inputs)
            return self._select_output(output, ["image", "image_embeds"], "image")
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
