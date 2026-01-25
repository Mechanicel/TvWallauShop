from __future__ import annotations

import base64
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image

from ...contracts_models import ImageRef
from ..errors import AiServiceError
from ...config import get_settings

settings = get_settings()


@dataclass(frozen=True)
class ImageAsset:
    image: Image.Image
    index: int
    source: str


def _load_from_path(path: str) -> Image.Image:
    file_path = Path(path)
    if not file_path.exists():
        raise AiServiceError(
            code="INVALID_IMAGE",
            message="Image path does not exist.",
            details={"path": path},
            http_status=400,
        )
    try:
        return Image.open(file_path).convert("RGB")
    except Exception as exc:  # pragma: no cover - error mapping
        raise AiServiceError(
            code="INVALID_IMAGE",
            message="Failed to decode image from path.",
            details={"path": path, "error": str(exc)},
            http_status=400,
        ) from exc


def _load_from_url(url: str) -> Image.Image:
    try:
        response = requests.get(url, timeout=settings.REQUEST_TIMEOUT_SEC)
        response.raise_for_status()
        return Image.open(BytesIO(response.content)).convert("RGB")
    except Exception as exc:
        raise AiServiceError(
            code="INVALID_IMAGE",
            message="Failed to download or decode image from URL.",
            details={"url": url, "error": str(exc)},
            http_status=400,
        ) from exc


def _load_from_base64(value: str) -> Image.Image:
    try:
        if value.startswith("data:"):
            _, encoded = value.split(",", 1)
        else:
            encoded = value
        raw = base64.b64decode(encoded)
        return Image.open(BytesIO(raw)).convert("RGB")
    except Exception as exc:
        raise AiServiceError(
            code="INVALID_IMAGE",
            message="Failed to decode base64 image payload.",
            details={"error": str(exc)},
            http_status=400,
        ) from exc


def load_images(image_refs: list[ImageRef]) -> list[ImageAsset]:
    if not image_refs:
        raise AiServiceError(
            code="INVALID_INPUT",
            message="At least one image is required.",
            http_status=400,
        )

    assets: list[ImageAsset] = []
    for idx, image_ref in enumerate(image_refs):
        if image_ref.kind == "path":
            image = _load_from_path(image_ref.value)
        elif image_ref.kind == "url":
            image = _load_from_url(image_ref.value)
        elif image_ref.kind == "base64":
            image = _load_from_base64(image_ref.value)
        else:
            raise AiServiceError(
                code="INVALID_INPUT",
                message="Unsupported image reference kind.",
                details={"kind": image_ref.kind},
                http_status=400,
            )

        assets.append(ImageAsset(image=image, index=idx, source=image_ref.kind))

    return assets
