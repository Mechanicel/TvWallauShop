from __future__ import annotations

import logging
import time

from ...config import get_settings
from ...contracts_models import (
    AnalyzeDebug,
    AnalyzeProductRequest,
    AnalyzeProductResponse,
    ClipTagScore,
    LlmDebug,
    PipelineMeta,
    PipelineModels,
    PipelineTimings,
    Tag,
)
from ..errors import AiServiceError
from ...model_manager import ensure_models
from .captioner_openvino import Captioner
from .image_loader import load_images
from .llm_openvino_genai import get_llm_copywriter
from .multi_image import captions_per_image, merge_tags_for_images
from .normalize import normalize_tags
from .tagger_openvino import ClipTagger

settings = get_settings()
logger = logging.getLogger("tvwallau-ai")


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
    debug_enabled = (
        settings.DEBUG
        or settings.DEBUG_AI
        or payload.debug
        or settings.DEBUG_AI_RESPONSE
    )
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
        images = [asset.image for asset in image_assets]
        tags_per_image: list[list[Tag]] = []
        for image in images:
            tags_per_image.append(
                tagger.predict(
                    [image],
                    max_tags=max_tags,
                    debug=None,
                    include_prompt=include_prompt,
                )
            )
        merged = merge_tags_for_images(
            tags_per_image,
            max_tags=max_tags,
        )
        tags = merged.merged_tags
        if debug_info:
            debug_info.clip_tags_per_image = [
                [
                    ClipTagScore(tag=tag.value, score=float(tag.score or 0.0))
                    for tag in tags_for_image[: settings.DEBUG_AI_MAX_TAGS_LOG]
                ]
                for tags_for_image in tags_per_image
            ]
            if tags_per_image:
                debug_info.clip_tags_image_1 = [
                    ClipTagScore(tag=tag.value, score=float(tag.score or 0.0))
                    for tag in tags_per_image[0]
                ]
            if len(tags_per_image) > 1:
                debug_info.clip_tags_image_2 = [
                    ClipTagScore(tag=tag.value, score=float(tag.score or 0.0))
                    for tag in tags_per_image[1]
                ]
            debug_info.clip_tags_intersection = merged.intersection
            debug_info.tag_merge_strategy = merged.strategy
            debug_info.tag_merge_fallback = merged.fallback
            sorted_tags = sorted(tags, key=lambda tag: tag.score or 0.0, reverse=True)
            debug_info.clip_tags_top = [
                ClipTagScore(tag=tag.value, score=float(tag.score or 0.0))
                for tag in sorted_tags[: settings.DEBUG_AI_MAX_TAGS_LOG]
            ]
        for idx, tags_for_image in enumerate(tags_per_image, start=1):
            logged_tags = [tag.value for tag in tags_for_image][
                : settings.DEBUG_AI_MAX_TAGS_LOG
            ]
            logger.info("CLIP tags image %s: %s", idx, logged_tags)
        logger.info("CLIP tags intersection: %s", merged.intersection)
        logger.info("CLIP tag merge strategy: %s", merged.strategy)
        if merged.fallback:
            logger.info("CLIP tag merge fallback: %s", merged.fallback)
        logger.info("CLIP tags sent to LLM: %s", merged.tags_for_llm)
        tagger_ms = (time.perf_counter() - tagger_start) * 1000

        caption_start = time.perf_counter()
        captioner = Captioner(routing.blip)
        max_captions = payload.max_captions or settings.MAX_CAPTIONS_PER_IMAGE
        captions = captioner.generate(
            images,
            max_captions=max_captions,
            debug=debug_info if debug_info else None,
        )
        captioner_ms = (time.perf_counter() - caption_start) * 1000

        llm_start = time.perf_counter()
        llm = get_llm_copywriter(
            routing.llm, debug=debug_info.llm if debug_info else None
        )
        tag_values = merged.tags_for_llm or normalize_tags(
            [tag.value for tag in tags]
        )
        caption_texts = captions_per_image(captions, len(images))
        if debug_info:
            debug_info.blip_captions_per_image = caption_texts
            debug_info.blip_caption = caption_texts[0] if caption_texts else None
            debug_info.blip_caption_image_1 = (
                caption_texts[0] if len(caption_texts) > 0 else None
            )
            debug_info.blip_caption_image_2 = (
                caption_texts[1] if len(caption_texts) > 1 else None
            )
            debug_info.captions_sent_to_llm = caption_texts
        for idx, caption_text in enumerate(caption_texts, start=1):
            logger.info(
                "BLIP caption image %s: %s",
                idx,
                caption_text[: settings.DEBUG_AI_MAX_CHARS],
            )
        logger.info(
            "Captions sent to LLM: %s",
            [
                caption[: settings.DEBUG_AI_MAX_CHARS]
                for caption in caption_texts
            ],
        )
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
