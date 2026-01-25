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
    TagStat,
    Tag,
)
from ..errors import AiServiceError
from ...model_manager import ensure_models
from .captioner_openvino import Captioner
from .image_loader import load_images
from .llm_openvino_genai import get_llm_copywriter
from .multi_image import (
    build_caption_consensus,
    build_tag_sets,
    captions_per_image,
    clean_caption_text,
    merge_tags_for_images,
    TagStats,
)
from .normalize import normalize_tags
from .tagger_openvino import ClipTagger

settings = get_settings()
logger = logging.getLogger("tvwallau-ai")


def _normalize_brand(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _detect_brand(
    brand_list: tuple[str, ...],
    tags_strict: list[str],
    tags_soft: list[str],
    tag_stats: dict[str, TagStats],
) -> tuple[str | None, float | None]:
    if not brand_list:
        return None, None
    normalized_map = {
        _normalize_brand(brand): brand.strip()
        for brand in brand_list
        if brand.strip()
    }
    if not normalized_map:
        return None, None
    tags_source = tags_strict or tags_soft
    candidates = [
        brand for brand in normalized_map.keys() if brand in tags_source
    ]
    if not candidates:
        return None, None
    sorted_candidates = sorted(
        candidates,
        key=lambda brand: (
            -(tag_stats.get(brand).frequency if tag_stats.get(brand) else 0.0),
            -(tag_stats.get(brand).mean_score if tag_stats.get(brand) else 0.0),
            brand,
        ),
    )
    selected = sorted_candidates[0]
    stats = tag_stats.get(selected)
    if stats:
        confidence = max(0.0, min(1.0, stats.frequency * stats.mean_score))
    else:
        confidence = 0.0
    return normalized_map[selected], confidence


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
        tag_sets = build_tag_sets(
            tags_per_image,
            min_shared_ratio=settings.TAG_SHARED_MIN_RATIO,
            max_soft_tags=settings.MAX_SOFT_TAGS,
        )
        tag_stats = tag_sets.tag_stats
        tags_strict = tag_sets.tags_strict
        tags_soft = tag_sets.tags_soft
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
            debug_info.tags_strict = tags_strict
            debug_info.tags_soft = tags_soft
            debug_info.tag_stats = [
                TagStat(
                    tag=tag,
                    count=stats.count,
                    mean_score=stats.mean_score,
                    max_score=stats.max_score,
                    frequency=stats.frequency,
                )
                for tag, stats in sorted(
                    tag_stats.items(),
                    key=lambda item: (-item[1].frequency, -item[1].mean_score, item[0]),
                )[: settings.DEBUG_AI_MAX_TAGS_LOG]
            ]
        for idx, tags_for_image in enumerate(tags_per_image, start=1):
            logged_tags = [tag.value for tag in tags_for_image][
                : settings.DEBUG_AI_MAX_TAGS_LOG
            ]
            logger.info("CLIP tags image %s: %s", idx, logged_tags)
        logger.info("CLIP tags intersection: %s", merged.intersection)
        logger.info("CLIP tags strict: %s", tags_strict)
        logger.info("CLIP tags soft: %s", tags_soft)
        if tag_stats:
            tag_stats_summary = [
                {
                    "tag": tag,
                    "count": stats.count,
                    "mean_score": stats.mean_score,
                    "max_score": stats.max_score,
                    "frequency": stats.frequency,
                }
                for tag, stats in sorted(
                    tag_stats.items(),
                    key=lambda item: (
                        -item[1].frequency,
                        -item[1].mean_score,
                        item[0],
                    ),
                )[: settings.DEBUG_AI_MAX_TAGS_LOG]
            ]
            logger.info("CLIP tag stats: %s", tag_stats_summary)
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
        caption_texts_raw = captions_per_image(captions, len(images))
        caption_texts = [
            clean_caption_text(
                caption,
                max_chars=settings.CAPTION_MAX_CHARS,
                repetition_threshold=settings.CAPTION_DEDUP_REPETITION_THRESHOLD,
            )
            for caption in caption_texts_raw
        ]
        caption_consensus = build_caption_consensus(caption_texts)
        brand_candidate, brand_confidence = _detect_brand(
            settings.BRAND_LIST,
            tags_strict,
            tags_soft,
            tag_stats,
        )
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
            debug_info.caption_consensus = caption_consensus
            debug_info.brand_candidate = brand_candidate
            debug_info.brand_confidence = brand_confidence
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
        logger.info("Caption consensus: %s", caption_consensus)
        if brand_candidate:
            logger.info(
                "Brand candidate: %s (confidence=%.3f)",
                brand_candidate,
                brand_confidence or 0.0,
            )
        product_facts = {
            "tags_strict": tags_strict,
            "tags_soft": tags_soft,
            "tag_stats": {
                tag: {
                    "count": stats.count,
                    "mean_score": stats.mean_score,
                    "max_score": stats.max_score,
                    "frequency": stats.frequency,
                }
                for tag, stats in tag_stats.items()
            },
            "brand_candidate": brand_candidate,
            "brand_confidence": brand_confidence,
            "captions_per_image": caption_texts,
            "caption_consensus": caption_consensus,
        }
        title, description = llm.generate(
            payload.price.amount,
            payload.price.currency or "USD",
            tag_values,
            caption_texts,
            product_facts=product_facts,
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
