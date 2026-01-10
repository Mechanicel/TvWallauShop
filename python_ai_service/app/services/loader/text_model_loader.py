from __future__ import annotations

from functools import lru_cache
import os
import torch
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

from app.config import get_settings

settings = get_settings()


def _resolve_device() -> torch.device:
    if settings.TEXT_DEVICE == "cuda" and torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


@lru_cache(maxsize=1)
def get_text_model():
    """
    Lädt Tokenizer + Seq2Seq Modell einmalig (cached).
    Offline wird respektiert (nur Cache).
    """
    local_only = bool(settings.HF_HUB_OFFLINE or settings.TRANSFORMERS_OFFLINE)

    # Zusätzlich Env setzen (hilft bei einigen HF-Komponenten)
    if settings.HF_HUB_OFFLINE:
        os.environ["HF_HUB_OFFLINE"] = "1"
    if settings.TRANSFORMERS_OFFLINE:
        os.environ["TRANSFORMERS_OFFLINE"] = "1"

    device = _resolve_device()

    tokenizer = AutoTokenizer.from_pretrained(
        settings.TEXT_MODEL_NAME,
        local_files_only=local_only,
    )
    model = AutoModelForSeq2SeqLM.from_pretrained(
        settings.TEXT_MODEL_NAME,
        local_files_only=local_only,
    )

    model.eval()
    model.to(device)

    if settings.DEBUG:
        print(f"[DEBUG] Loaded TEXT model='{settings.TEXT_MODEL_NAME}' on device='{device}' (local_only={local_only})")

    return model, tokenizer, device
