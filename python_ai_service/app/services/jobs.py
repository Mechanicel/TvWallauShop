from __future__ import annotations

from ..schemas import AnalyzeProductRequest, AnalyzeProductResponse
from .image_inference import predict_tags
from .description_gen import generate_description
from ..config import get_settings

settings = get_settings()


def _display_name_from_tags(tags: list[str]) -> str:
    if settings.TAG_LANG == "de":
        main = tags[0] if tags else "Produkt"
        return f"AI Produkt ({main})"
    main = tags[0] if tags else "Product"
    return f"AI Product ({main})"


def analyze(payload: AnalyzeProductRequest) -> AnalyzeProductResponse:
    tags = predict_tags(payload.image_paths, payload.price)
    description = generate_description(tags, payload.price)
    display_name = _display_name_from_tags(tags)

    return AnalyzeProductResponse(
        job_id=payload.job_id,
        display_name=display_name,
        description=description,
        tags=tags,
    )
