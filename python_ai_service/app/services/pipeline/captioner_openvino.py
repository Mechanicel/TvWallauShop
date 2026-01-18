from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image
import openvino as ov
import openvino_genai as ov_genai

from ...config import get_settings
from ...contracts_models import Caption
from ...model_manager import build_model_specs, check_assets, model_fetch_hint
from ..errors import AiServiceError

settings = get_settings()


def _resolve_caption_paths() -> tuple[Path, Path]:
    spec = build_model_specs(settings)["caption"]
    base = spec.target_dir
    model_path = base / "model.xml"
    tokenizer_path = base / "tokenizer.json"
    missing = check_assets(spec)
    if missing:
        raise AiServiceError(
            code="MODEL_NOT_AVAILABLE",
            message=f"Caption model assets are missing. {model_fetch_hint()}",
            details={
                "model": "caption",
                "missing": missing,
                "directory": str(base),
                "hint": model_fetch_hint(),
            },
            http_status=503,
        )
    return model_path, tokenizer_path


def _preprocess(image: Image.Image, size: int = 384) -> np.ndarray:
    resized = image.resize((size, size))
    array = np.asarray(resized).astype(np.float32) / 255.0
    array = np.transpose(array, (2, 0, 1))
    return np.expand_dims(array, axis=0)


class Captioner:
    def __init__(self, device: str) -> None:
        model_path, tokenizer_path = _resolve_caption_paths()
        core = ov.Core()
        self.model = core.compile_model(core.read_model(model_path), device)
        self.tokenizer = ov_genai.Tokenizer(str(tokenizer_path))

    def generate(self, images: list[Image.Image], max_captions: int) -> list[Caption]:
        captions: list[Caption] = []
        for index, image in enumerate(images):
            for _ in range(max(1, max_captions)):
                tensor = _preprocess(image)
                outputs = self.model({self.model.input(0): tensor})
                tokens = next(iter(outputs.values()))
                if tokens.size == 0:
                    raise AiServiceError(
                        code="INFERENCE_FAILED",
                        message="Caption model returned empty output.",
                        details={"imageIndex": index},
                        http_status=500,
                    )
                text = self.tokenizer.decode(tokens.tolist()[0]).strip()
                if not text:
                    raise AiServiceError(
                        code="INFERENCE_FAILED",
                        message="Caption model returned empty caption.",
                        details={"imageIndex": index},
                        http_status=500,
                    )
                captions.append(Caption(image_index=index, text=text, source="blip"))

        return captions
