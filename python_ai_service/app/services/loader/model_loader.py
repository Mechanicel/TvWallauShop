# app/services/model_loader.py
from __future__ import annotations

from functools import lru_cache
import os
import torch
from transformers import CLIPModel, CLIPProcessor

from app.config import get_settings

settings = get_settings()


def _resolve_device() -> torch.device:
    """
    Entscheidet, ob das Modell auf CPU oder CUDA laufen soll.
    - Wenn .env CLIP_DEVICE=cuda gesetzt ist UND CUDA verfügbar ist → cuda
    - sonst → cpu
    """
    if settings.CLIP_DEVICE == "cuda" and torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


@lru_cache(maxsize=1)
def get_clip() -> tuple[CLIPModel, CLIPProcessor, torch.device]:
    """
    Lädt das *Bild*-Modell (FashionCLIP / CLIP) + Processor EINMALIG pro Prozess.

    Warum lru_cache?
    - FastAPI/Uvicorn verarbeitet viele Requests.
    - Ohne Cache würdest du das Modell bei jedem Request neu laden → extrem langsam.
    - Mit Cache wird es pro Prozess genau 1x geladen und dann wiederverwendet.

    Offline-Verhalten:
    - Wenn HF_HUB_OFFLINE oder TRANSFORMERS_OFFLINE in .env aktiv ist,
      wird local_files_only=True gesetzt.
      Dann wird NUR aus dem lokalen HuggingFace-Cache geladen.
    """
    device = _resolve_device()

    # Wenn Offline-Flags gesetzt sind, darf HF nichts aus dem Internet nachladen.
    local_only = bool(settings.HF_HUB_OFFLINE or settings.TRANSFORMERS_OFFLINE)

    # Zusätzlich Environment setzen: hilft, dass HuggingFace wirklich offline bleibt.
    if settings.HF_HUB_OFFLINE:
        os.environ["HF_HUB_OFFLINE"] = "1"
    if settings.TRANSFORMERS_OFFLINE:
        os.environ["TRANSFORMERS_OFFLINE"] = "1"

    # ✅ Hier wird das CLIP/FashionCLIP Modell geladen (nur dieses eine Modell).
    #    Welches genau? → settings.CLIP_MODEL_NAME, z.B. "patrickjohncyh/fashion-clip"
    model = CLIPModel.from_pretrained(
        settings.CLIP_MODEL_NAME,
        local_files_only=local_only,
    )

    # Processor enthält Preprocessing: Resize/Normalize/Text-Tokenization fürs CLIP-Format.
    processor = CLIPProcessor.from_pretrained(
        settings.CLIP_MODEL_NAME,
        local_files_only=local_only,
    )

    # Modell in Inference-Mode setzen und auf Device verschieben.
    model.eval()
    model.to(device)

    if settings.DEBUG:
        print(
            f"[DEBUG] Loaded CLIP model='{settings.CLIP_MODEL_NAME}' "
            f"on device='{device}' (local_only={local_only})"
        )

    return model, processor, device
