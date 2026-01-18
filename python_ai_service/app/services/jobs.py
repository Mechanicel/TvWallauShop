from __future__ import annotations

from ..contracts_models import AnalyzeProductRequest, AnalyzeProductResponse
from .pipeline.orchestrator import run_pipeline


def analyze(payload: AnalyzeProductRequest) -> AnalyzeProductResponse:
    return run_pipeline(payload)
