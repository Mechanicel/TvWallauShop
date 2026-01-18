from __future__ import annotations

from dataclasses import dataclass
import logging
from pathlib import Path

import numpy as np
from PIL import Image
import openvino as ov
from transformers import CLIPProcessor

from ...config import get_settings
from ...contracts_models import ClipDebug, ClipTagScore, Tag
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


class ClipTagger:
    def __init__(self, device: str) -> None:
        clip_dir = Path(settings.OV_CLIP_DIR)
        found_files = _list_files(clip_dir)
        image_model_path = clip_dir / "image_encoder.xml"
        text_model_path = clip_dir / "text_encoder.xml"
        core = ov.Core()
        self.image_model: ov.CompiledModel | None = None
        self.text_model: ov.CompiledModel | None = None
        self.clip_dir = clip_dir
        self.found_files = found_files
        self.text_batch = 1
        self.text_seq_len = 16
        if image_model_path.exists() and text_model_path.exists():
            logger.info("CLIP loaded as dual-encoder (image_encoder.xml/text_encoder.xml)")
            self.image_model = core.compile_model(core.read_model(image_model_path), device)
            self.text_model = core.compile_model(core.read_model(text_model_path), device)
        else:
            raise AiServiceError(
                code="MODEL_NOT_AVAILABLE",
                message=(
                    "CLIP model assets are missing. Expected image_encoder.xml + "
                    "text_encoder.xml with tokenizer.json."
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
                        "tokenizer.json",
                        "config.json",
                    ],
                    "hint": model_fetch_hint(),
                },
                http_status=503,
            )
        self.processor = CLIPProcessor.from_pretrained(clip_dir)
        if self.text_model:
            text_input = self.text_model.inputs[0]
            expected = list(text_input.shape)
            if len(expected) >= 2:
                batch_dim, seq_dim = expected[0], expected[1]
                if hasattr(batch_dim, "is_dynamic") and batch_dim.is_dynamic:
                    self.text_batch = 1
                else:
                    self.text_batch = int(batch_dim)
                if hasattr(seq_dim, "is_dynamic") and seq_dim.is_dynamic:
                    self.text_seq_len = 16
                else:
                    self.text_seq_len = int(seq_dim)
            logger.info(
                "CLIP text encoder expects shape=[B,S] -> B=%s S=%s",
                self.text_batch,
                self.text_seq_len,
            )
        logger.info(
            "CLIP processor loaded from %s, files_present=%s",
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
            },
            http_status=503,
        )

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
    ) -> tuple[np.ndarray, np.ndarray]:
        encoded = self.processor.tokenizer(
            texts,
            padding="max_length",
            truncation=True,
            max_length=self.text_seq_len,
            return_tensors="np",
        )
        input_ids = encoded["input_ids"].astype(np.int64)
        attention_mask = encoded["attention_mask"].astype(np.int64)
        return input_ids, attention_mask

    def _encode_text(self, texts: list[str]) -> np.ndarray:
        if not self.text_model:
            raise AiServiceError(
                code="MODEL_NOT_AVAILABLE",
                message="CLIP text encoder is not available.",
                details={"model": "clip", "hint": model_fetch_hint()},
                http_status=503,
            )
        input_ids, attention_mask = self._prepare_text_inputs(texts)
        expected_shape = (self.text_batch, self.text_seq_len)
        features: list[np.ndarray] = []
        if self.text_batch == 1:
            for i in range(len(texts)):
                ids_i = input_ids[i : i + 1, :]
                mask_i = attention_mask[i : i + 1, :]
                if ids_i.shape != expected_shape:
                    raise AiServiceError(
                        code="INFERENCE_FAILED",
                        message="Tokenizer shape mismatch for CLIP text encoder",
                        details={"expected": expected_shape, "got": ids_i.shape},
                        http_status=500,
                    )
                inputs = {}
                for input_tensor in self.text_model.inputs:
                    name = input_tensor.get_any_name()
                    if "attention" in name:
                        inputs[name] = mask_i
                    else:
                        inputs[name] = ids_i
                output = self.text_model(inputs)
                features.append(
                    self._select_output(output, ["text", "text_embeds"], "text")
                )
        else:
            for i in range(0, len(texts), self.text_batch):
                ids_i = input_ids[i : i + self.text_batch, :]
                mask_i = attention_mask[i : i + self.text_batch, :]
                if ids_i.shape != expected_shape:
                    raise AiServiceError(
                        code="INFERENCE_FAILED",
                        message="Tokenizer shape mismatch for CLIP text encoder",
                        details={"expected": expected_shape, "got": ids_i.shape},
                        http_status=500,
                    )
                inputs = {}
                for input_tensor in self.text_model.inputs:
                    name = input_tensor.get_any_name()
                    if "attention" in name:
                        inputs[name] = mask_i
                    else:
                        inputs[name] = ids_i
                output = self.text_model(inputs)
                features.append(
                    self._select_output(output, ["text", "text_embeds"], "text")
                )
        return np.vstack(features)

    def _prepare_image_inputs(self, images: list[Image.Image]) -> np.ndarray:
        processed = self.processor(images=images, return_tensors="np")
        return processed["pixel_values"].astype(np.float32)

    def _encode_image(self, image: Image.Image) -> np.ndarray:
        if not self.image_model:
            raise AiServiceError(
                code="MODEL_NOT_AVAILABLE",
                message="CLIP image encoder is not available.",
                details={"model": "clip", "hint": model_fetch_hint()},
                http_status=503,
            )
        tensor = self._prepare_image_inputs([image])
        inputs = {self.image_model.input(0): tensor}
        output = self.image_model(inputs)
        return self._select_output(output, ["image", "image_embeds"], "image")

    def predict(
        self,
        images: list[Image.Image],
        max_tags: int,
        debug: ClipDebug | None = None,
        include_prompt: bool = False,
    ) -> list[Tag]:
        max_tags = max(1, max_tags)
        prompts = [f"a photo of {c.value}" for c in CANDIDATES_EN]
        if debug:
            debug.candidate_prompts_count = len(prompts)
            debug.num_images = len(images)
            if include_prompt:
                debug.prompt_examples = prompts[:10]
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

        if debug:
            sorted_tags = sorted(
                scored_tags, key=lambda tag: tag.score or 0.0, reverse=True
            )
            top_tags = sorted_tags[: settings.DEBUG_AI_MAX_TAGS_LOG]
            debug.top_tags = [
                ClipTagScore(tag=tag.value, score=float(tag.score or 0.0))
                for tag in top_tags
            ]
            summary_top = top_tags[:10]
            summary = ", ".join(
                f"{tag.value}({tag.score:.3f})" if tag.score is not None else tag.value
                for tag in summary_top
            )
            logger.info("CLIP tags top10: %s", summary)
            logger.info(
                "CLIP tags summary",
                extra={
                    "clip_top_tags": [
                        {"tag": tag.value, "score": tag.score} for tag in summary_top
                    ]
                },
            )

        normalized = normalize_tags(selected)
        normalized_set = set(normalized)
        filtered = [tag for tag in scored_tags if tag.value in normalized_set]
        deduped: dict[str, Tag] = {}
        for tag in filtered:
            if tag.value not in deduped:
                deduped[tag.value] = tag
        return list(deduped.values())[:max_tags]
