from __future__ import annotations

import time
from typing import Dict, List, Optional

from app.config import get_settings
from app.schemas import AnalyzeProductRequest, AnalyzeProductResponse
from app.services.generator.caption.generator import generate_caption

settings = get_settings()


def _split_pipeline(pipeline_str: str) -> List[str]:
    p = (pipeline_str or "").strip()
    if not p:
        return ["caption"]
    parts = [x.strip().lower() for x in p.split(",")]
    return [x for x in parts if x]


def analyze(req: AnalyzeProductRequest) -> AnalyzeProductResponse:
    t0 = time.perf_counter()

    pipeline = _split_pipeline(settings.ANALYZE_PIPELINE)
    stop_after_caption = bool(getattr(settings, "STOP_AFTER_CAPTION", False))

    if settings.DEBUG:
        print(f"[DEBUG] JOB pipeline={pipeline} stop_after_caption={stop_after_caption}", flush=True)

    # 1) Caption
    caption_text = ""
    if "caption" in pipeline:
        caption_text = generate_caption(req.image_urls)

    if stop_after_caption:
        if settings.DEBUG:
            print(
                f"[DEBUG] STOP_AFTER_CAPTION=1 -> returning early (total={time.perf_counter() - t0:.2f}s)",
                flush=True,
            )
        return AnalyzeProductResponse(
            job_id=req.job_id,
            display_name=caption_text.strip() or "",
            description=caption_text.strip() or "",
            tags=[],
        )

    # (Hier könntest du später tags/brand usw. ergänzen – ohne die Response-Struktur zu ändern)
    return AnalyzeProductResponse(
        job_id=req.job_id,
        display_name=caption_text.strip() or "",
        description=caption_text.strip() or "",
        tags=[],
    )
