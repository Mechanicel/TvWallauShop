from __future__ import annotations

import time

import openvino as ov

from ...config import get_settings
from ...contracts_models import (
    AnalyzeProductRequest,
    AnalyzeProductResponse,
    PipelineMeta,
    PipelineModels,
    PipelineTimings,
)
from ..errors import AiServiceError
from .captioner_openvino import Captioner
from .image_loader import load_images
from .llm_openvino_genai import LlmCopywriter
from .normalize import normalize_tags
from .tagger_openvino import ClipTagger

settings = get_settings()


def _resolve_device() -> str:
    mapping = {
        "openvino:GPU": "GPU",
        "openvino:NPU": "NPU",
    }
    if settings.AI_DEVICE not in mapping:
        raise AiServiceError(
            code="INVALID_INPUT",
            message="Unsupported AI_DEVICE value.",
            details={"device": settings.AI_DEVICE},
            http_status=400,
        )
    device = mapping[settings.AI_DEVICE]
    core = ov.Core()
    if device not in core.available_devices:
        raise AiServiceError(
            code="DEVICE_NOT_AVAILABLE",
            message="Requested OpenVINO device is not available.",
            details={"device": settings.AI_DEVICE, "available": core.available_devices},
            http_status=503,
        )
    return device


def run_pipeline(payload: AnalyzeProductRequest) -> AnalyzeProductResponse:
    if settings.ENABLE_CPU_FALLBACK:
        raise AiServiceError(
            code="INVALID_INPUT",
            message="CPU fallback is disabled for this service.",
            details={"ENABLE_CPU_FALLBACK": settings.ENABLE_CPU_FALLBACK},
            http_status=400,
        )

    device = _resolve_device()
    start = time.perf_counter()

    image_start = time.perf_counter()
    image_assets = load_images(payload.images)
    image_load_ms = (time.perf_counter() - image_start) * 1000

    tagger_start = time.perf_counter()
    tagger = ClipTagger(device)
    max_tags = payload.max_tags or settings.MAX_TAGS
    tags = tagger.predict([asset.image for asset in image_assets], max_tags=max_tags)
    tagger_ms = (time.perf_counter() - tagger_start) * 1000

    caption_start = time.perf_counter()
    captioner = Captioner(device)
    max_captions = payload.max_captions or settings.MAX_CAPTIONS_PER_IMAGE
    captions = captioner.generate(
        [asset.image for asset in image_assets],
        max_captions=max_captions,
    )
    captioner_ms = (time.perf_counter() - caption_start) * 1000

    llm_start = time.perf_counter()
    llm = LlmCopywriter(device)
    tag_values = normalize_tags([tag.value for tag in tags])
    caption_texts = [caption.text for caption in captions]
    title, description = llm.generate(
        payload.price.amount,
        payload.price.currency or "USD",
        tag_values,
        caption_texts,
    )
    llm_ms = (time.perf_counter() - llm_start) * 1000

    total_ms = (time.perf_counter() - start) * 1000

    meta = PipelineMeta(
        contract_version="1.0",
        device=settings.AI_DEVICE,
        models=PipelineModels(
            tagger=f"openvino:clip:{settings.OV_CLIP_DIR}",
            captioner=f"openvino:caption:{settings.OV_CAPTION_DIR}",
            llm=f"openvino-genai:{settings.OV_LLM_DIR}",
        ),
        timings=PipelineTimings(
            image_load_ms=image_load_ms,
            tagger_ms=tagger_ms,
            captioner_ms=captioner_ms,
            llm_ms=llm_ms,
            total_ms=total_ms,
        ),
    )

    return AnalyzeProductResponse(
        job_id=payload.job_id,
        title=title,
        description=description,
        tags=tags,
        captions=captions,
        meta=meta,
    )
