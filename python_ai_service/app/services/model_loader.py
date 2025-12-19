from functools import lru_cache
import torch
from transformers import CLIPModel, CLIPProcessor

from ..config import get_settings

settings = get_settings()


def _resolve_device() -> torch.device:
    if settings.CLIP_DEVICE == "cuda" and torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


@lru_cache(maxsize=1)
def get_clip() -> tuple[CLIPModel, CLIPProcessor, torch.device]:
    """
    Lädt FashionCLIP + Processor einmalig (cached).
    """
    device = _resolve_device()
    model = CLIPModel.from_pretrained(settings.CLIP_MODEL_NAME)
    processor = CLIPProcessor.from_pretrained(settings.CLIP_MODEL_NAME)

    model.eval()
    model.to(device)

    if settings.DEBUG:
        print(f"[DEBUG] Loaded CLIP model='{settings.CLIP_MODEL_NAME}' on device='{device}'")

    return model, processor, device
