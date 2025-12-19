from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import Iterable

import numpy as np
import requests
import torch
from PIL import Image

from .model_loader import get_clip
from ..config import get_settings

settings = get_settings()


@dataclass(frozen=True)
class Candidate:
    key: str          # "sock", "tennis socks", "white", "adidas", ...
    de: str
    en: str


# Minimal, aber sinnvoll für deinen Usecase.
# (Erweiterst du später easy – ohne neue Dateien.)
CANDIDATES: list[Candidate] = [
    # garment types
    Candidate("socks", "socken", "socks"),
    Candidate("tennis socks", "tennissocken", "tennis socks"),
    Candidate("crew socks", "sportsocken", "crew socks"),
    Candidate("t-shirt", "t-shirt", "t-shirt"),
    Candidate("hoodie", "hoodie", "hoodie"),
    Candidate("sweatshirt", "sweatshirt", "sweatshirt"),
    Candidate("jacket", "jacke", "jacket"),
    Candidate("pants", "hose", "pants"),
    Candidate("shorts", "shorts", "shorts"),
    Candidate("shoes", "schuhe", "shoes"),
    Candidate("sneakers", "sneaker", "sneakers"),

    # colors
    Candidate("white", "weiß", "white"),
    Candidate("black", "schwarz", "black"),
    Candidate("beige", "beige", "beige"),
    Candidate("brown", "braun", "brown"),
    Candidate("blue", "blau", "blue"),
    Candidate("red", "rot", "red"),
    Candidate("green", "grün", "green"),
    Candidate("grey", "grau", "grey"),

    # patterns / style
    Candidate("striped", "gestreift", "striped"),
    Candidate("leopard print", "leopardenmuster", "leopard print"),
    Candidate("animal print", "tiermuster", "animal print"),
    Candidate("logo", "logo", "logo"),
    Candidate("sport", "sport", "sport"),
    Candidate("casual", "casual", "casual"),

    # brands (nur ein kleiner Start – später eigener Brand-Stage)
    Candidate("adidas", "adidas", "adidas"),
    Candidate("nike", "nike", "nike"),
    Candidate("puma", "puma", "puma"),
]


def _load_image(path_or_url: str) -> Image.Image:
    if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
        r = requests.get(path_or_url, timeout=settings.REQUEST_TIMEOUT_SEC)
        r.raise_for_status()
        return Image.open(BytesIO(r.content)).convert("RGB")
    return Image.open(path_or_url).convert("RGB")


def _lang_label(c: Candidate) -> str:
    return c.de if settings.TAG_LANG == "de" else c.en


def _build_prompts(cands: Iterable[Candidate]) -> list[str]:
    # Prompts bewusst auf Englisch halten (CLIP/FashionCLIP versteht das am stabilsten),
    # aber wir mappen am Ende auf de/en via _lang_label().
    return [f"a photo of {c.key}" for c in cands]


@torch.inference_mode()
def predict_tags(image_paths: list[str], price: float) -> list[str]:
    """
    Stage 1 Tagging:
    - lädt Bilder (lokal/URL)
    - FashionCLIP Similarity gegen Candidates
    - liefert max. 8 Tags (FREE_TAG_MAX), min. 5 (FREE_TAG_MIN)
    """
    model, processor, device = get_clip()

    if not image_paths:
        return []

    max_k = max(1, int(settings.FREE_TAG_MAX))
    min_k = max(0, int(settings.FREE_TAG_MIN))
    min_k = min(min_k, max_k)

    # Candidates je nach Mode
    # restricted: später → aus Datei; aktuell fallback auf eingebaut (kein File nötig)
    candidates = CANDIDATES

    prompts = _build_prompts(candidates)

    # Text-Embeddings (einmal pro Request; wenn du willst, kann man das später cachen)
    text_inputs = processor(text=prompts, return_tensors="pt", padding=True, truncation=True).to(device)
    text_features = model.get_text_features(**text_inputs)
    text_features = text_features / text_features.norm(dim=-1, keepdim=True)

    all_selected: list[str] = []

    for p in image_paths:
        img = _load_image(p)
        image_inputs = processor(images=img, return_tensors="pt").to(device)
        image_features = model.get_image_features(**image_inputs)
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)

        # Similarity (cosine, weil normalisiert)
        sims = (image_features @ text_features.T).squeeze(0)  # (N,)
        sims_np = sims.detach().float().cpu().numpy()

        # Top-K
        top_idx = np.argsort(sims_np)[::-1][:max_k]

        picked = [_lang_label(candidates[i]) for i in top_idx]
        all_selected.extend(picked)

        if settings.DEBUG:
            debug_pairs = [(candidates[i].key, float(sims_np[i]), _lang_label(candidates[i])) for i in top_idx]
            print(f"[DEBUG] Top candidates for image='{p}':")
            for key, score, out_label in debug_pairs:
                print(f"        score={score:.4f}  key='{key}'  out='{out_label}'")

    # dedupe, aber Reihenfolge behalten
    seen = set()
    uniq = []
    for t in all_selected:
        norm = t.strip().lower()
        if norm and norm not in seen:
            seen.add(norm)
            uniq.append(norm)

    # Falls durch Dedupe < min_k: wir nehmen trotzdem was wir haben (realistisch).
    # Du kannst später eine zweite “fallback vocabulary” Stage bauen.
    uniq = uniq[:max_k]

    if settings.DEBUG:
        print(f"[DEBUG] Final selected tags ({len(uniq)}): {uniq}")

    return uniq
