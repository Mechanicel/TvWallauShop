# app/services/loader/brand_model_loader.py
from __future__ import annotations

from functools import lru_cache
from typing import Tuple

import torch
from transformers import AutoImageProcessor, AutoModelForImageClassification

from app.config import get_settings

settings = get_settings()


def _local_only() -> bool:
    # Respect both flags; either one means "don't hit the internet".
    return bool(getattr(settings, "HF_HUB_OFFLINE", False) or getattr(settings, "TRANSFORMERS_OFFLINE", False))


@lru_cache(maxsize=1)
def get_brand_model() -> Tuple[torch.nn.Module, object, torch.device]:
    """
    Loads the dedicated brand model (image classification).
    Returns: (model, processor, device)
    """
    model_name = str(getattr(settings, "BRAND_MODEL_NAME", "")).strip()
    if not model_name:
        raise RuntimeError("BRAND_MODEL_NAME is empty but BRAND_ENABLE=1")

    device_str = str(getattr(settings, "BRAND_DEVICE", "cpu")).strip().lower()
    device = torch.device(device_str)

    processor = AutoImageProcessor.from_pretrained(model_name, local_files_only=_local_only())
    model = AutoModelForImageClassification.from_pretrained(model_name, local_files_only=_local_only())
    model.to(device)
    model.eval()
    return model, processor, device
