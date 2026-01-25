from __future__ import annotations

import time

from ...config import get_settings
from ...contracts_models import (
    AnalyzeDebug,
    AnalyzeProductRequest,
    AnalyzeProductResponse,
    LlmDebug,
    PipelineMeta,
    PipelineModels,
    PipelineTimings,
)
from ..errors import AiServiceError
from ...model_manager import ensure_models
from .captioner_openvino import Captioner
from .image_loader import load_images
from .llm_openvino_genai import LlmCopywriter
from .normalize import normalize_tags
from .tagger_openvino import ClipTagger

settings = get_settings()


def run_pipeline(payload: AnalyzeProductRequest) -> AnalyzeProductResponse:
    if settings.ENABLE_CPU_FALLBACK:
        raise AiServiceError(
            code="INVALID_INPUT",
            message="CPU fallback is disabled for this service.",
            details={"ENABLE_CPU_FALLBACK": settings.ENABLE_CPU_FALLBACK},
            http_status=400,
        )

    ensure_models(mode="never", offline=settings.OFFLINE, settings=settings)
    routing = settings.device_routing()
    debug_enabled = settings.DEBUG or settings.DEBUG_AI or payload.debug
    include_prompt = settings.DEBUG_AI_INCLUDE_PROMPT or payload.debug_include_prompt
    debug_response = settings.DEBUG or (debug_enabled and settings.DEBUG_AI_RESPONSE)
    debug_info: AnalyzeDebug | None = None
    if debug_enabled:
        debug_info = AnalyzeDebug(llm=LlmDebug())

    start = time.perf_counter()
    try:
        image_start = time.perf_counter()
        image_assets = load_images(payload.images)
        image_load_ms = (time.perf_counter() - image_start) * 1000

        tagger_start = time.perf_counter()
        tagger = ClipTagger(routing.clip)
        max_tags = payload.max_tags or settings.MAX_TAGS
        tags = tagger.predict(
            [asset.image for asset in image_assets],
            max_tags=max_tags,
            debug=debug_info if debug_info else None,
            include_prompt=include_prompt,
        )
        tagger_ms = (time.perf_counter() - tagger_start) * 1000

        caption_start = time.perf_counter()
        captioner = Captioner(routing.blip)
        max_captions = payload.max_captions or settings.MAX_CAPTIONS_PER_IMAGE
        captions = captioner.generate(
            [asset.image for asset in image_assets],
            max_captions=max_captions,
            debug=debug_info if debug_info else None,
        )
        captioner_ms = (time.perf_counter() - caption_start) * 1000

        llm_start = time.perf_counter()
        llm = LlmCopywriter(routing.llm, debug=debug_info.llm if debug_info else None)
        tag_values = normalize_tags([tag.value for tag in tags])
        caption_texts = [caption.text for caption in captions]
        title, description = llm.generate(
            payload.price.amount,
            payload.price.currency or "USD",
            tag_values,
            caption_texts,
            debug=debug_info.llm if debug_info else None,
            include_prompt=include_prompt,
            allow_debug_failure=debug_response,
        )
        llm_ms = (time.perf_counter() - llm_start) * 1000

        total_ms = (time.perf_counter() - start) * 1000

        meta = PipelineMeta(
            contract_version="1.0",
            device=routing.llm,
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
            debug=debug_info if debug_response else None,
        )
    except AiServiceError as exc:
        if debug_response and debug_info:
            exc.debug = debug_info
        raise
