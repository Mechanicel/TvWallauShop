# app/services/generator/image_inference.py
from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import Iterable, Literal, Optional

import numpy as np
import requests
import torch
from PIL import Image

from app.services.loader.model_loader import get_clip
from app.config import get_settings

settings = get_settings()

Group = Literal[
    "type:socks",
    "type:tops",
    "type:outerwear",
    "type:pants",
    "type:shoes",
    "color",
    "pattern",
    "style",
]


@dataclass(frozen=True)
class Candidate:
    key: str
    de: str
    en: str
    group: Group


# Kandidaten (ohne Marken – Brand kommt aus eigener Stage)
CANDIDATES: list[Candidate] = [
    # types
    Candidate("socks", "socken", "socks", "type:socks"),
    Candidate("tennis socks", "tennissocken", "tennis socks", "type:socks"),
    Candidate("crew socks", "sportsocken", "crew socks", "type:socks"),

    Candidate("t-shirt", "t-shirt", "t-shirt", "type:tops"),
    Candidate("shirt", "shirt", "shirt", "type:tops"),
    Candidate("sweatshirt", "sweatshirt", "sweatshirt", "type:tops"),
    Candidate("hoodie", "hoodie", "hoodie", "type:tops"),

    Candidate("jacket", "jacke", "jacket", "type:outerwear"),
    Candidate("bomber jacket", "bomberjacke", "bomber jacket", "type:outerwear"),
    Candidate("track jacket", "trainingsjacke", "track jacket", "type:outerwear"),

    Candidate("pants", "hose", "pants", "type:pants"),
    Candidate("track pants", "trainingshose", "track pants", "type:pants"),
    Candidate("joggers", "jogginghose", "joggers", "type:pants"),
    Candidate("shorts", "shorts", "shorts", "type:pants"),

    Candidate("shoes", "schuhe", "shoes", "type:shoes"),
    Candidate("sneakers", "sneaker", "sneakers", "type:shoes"),

    # colors
    Candidate("white", "weiß", "white", "color"),
    Candidate("black", "schwarz", "black", "color"),
    Candidate("beige", "beige", "beige", "color"),
    Candidate("brown", "braun", "brown", "color"),
    Candidate("blue", "blau", "blue", "color"),
    Candidate("red", "rot", "red", "color"),
    Candidate("green", "grün", "green", "color"),
    Candidate("grey", "grau", "grey", "color"),
    Candidate("pink", "pink", "pink", "color"),

    # pattern / style
    Candidate("striped", "gestreift", "striped", "pattern"),
    Candidate("logo", "logo", "logo", "style"),
    Candidate("sport", "sport", "sport", "style"),
    Candidate("casual", "casual", "casual", "style"),
]


def _load_image(path_or_url: str) -> Image.Image:
    if path_or_url.startswith("http://") or path_or_url.startswith("https://"):
        r = requests.get(path_or_url, timeout=float(settings.REQUEST_TIMEOUT_SEC))
        r.raise_for_status()
        return Image.open(BytesIO(r.content)).convert("RGB")
    return Image.open(path_or_url).convert("RGB")


def _lang_label(c: Candidate) -> str:
    return c.de if settings.TAG_LANG == "de" else c.en


def _build_prompts(cands: Iterable[Candidate]) -> list[str]:
    # Prompts auf Englisch (CLIP ist damit stabiler).
    return [f"a photo of {c.key}" for c in cands]


_TEXT_FEAT_CACHE: dict[str, torch.Tensor] = {}


@torch.inference_mode()
def _get_text_features(model, processor, device) -> torch.Tensor:
    key = f"{settings.TAG_LANG}|{getattr(settings, 'CLIP_MODEL_NAME', '')}|{device}"
    if key in _TEXT_FEAT_CACHE:
        return _TEXT_FEAT_CACHE[key]

    prompts = _build_prompts(CANDIDATES)
    text_inputs = processor(
        text=prompts,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=77,  # verhindert "no maximum length provided"
    ).to(device)
    text_features = model.get_text_features(**text_inputs)
    text_features = text_features / text_features.norm(dim=-1, keepdim=True)

    _TEXT_FEAT_CACHE[key] = text_features
    return text_features


def _best_type_family(cands: list[Candidate], scores: np.ndarray) -> Optional[str]:
    fam_scores: dict[str, float] = {}
    for i, c in enumerate(cands):
        if c.group.startswith("type:"):
            fam_scores[c.group] = max(fam_scores.get(c.group, -1e9), float(scores[i]))
    if not fam_scores:
        return None
    return max(fam_scores.items(), key=lambda kv: kv[1])[0]


@torch.inference_mode()
def predict_tags(image_paths: list[str], price: float) -> list[str]:
    """
    Stage 1 Tagging:
    - FashionCLIP Similarity gegen Candidates
    - Filtert auf EINEN Kleidungs-Family-Cluster (z.B. socks ODER pants),
      damit keine Jogginghose bei Socken landet.
    """
    model, processor, device = get_clip()

    if not image_paths:
        return []

    max_k = max(1, int(settings.FREE_TAG_MAX))
    min_k = max(0, int(settings.FREE_TAG_MIN))
    min_k = min(min_k, max_k)

    text_features = _get_text_features(model, processor, device)

    all_selected: list[str] = []

    for p in image_paths:
        img = _load_image(p)
        image_inputs = processor(images=img, return_tensors="pt").to(device)
        image_features = model.get_image_features(**image_inputs)
        image_features = image_features / image_features.norm(dim=-1, keepdim=True)

        sims = (image_features @ text_features.T).squeeze(0)  # (N,)
        sims_np = sims.detach().float().cpu().numpy()

        best_family = _best_type_family(CANDIDATES, sims_np)

        picked: list[str] = []
        colors = 0
        patterns = 0

        for idx in np.argsort(sims_np)[::-1]:
            c = CANDIDATES[int(idx)]

            # nur 1 type-family
            if c.group.startswith("type:") and best_family and c.group != best_family:
                continue

            if c.group == "color" and colors >= 2:
                continue
            if c.group == "pattern" and patterns >= 1:
                continue

            label = _lang_label(c).strip().lower()
            if label and label not in picked:
                picked.append(label)

            if c.group == "color":
                colors += 1
            elif c.group == "pattern":
                patterns += 1

            if len(picked) >= max_k:
                break

        all_selected.extend(picked)

        if settings.DEBUG:
            top_idx = np.argsort(sims_np)[::-1][:max_k]
            print(f"[DEBUG] Top candidates for image='{p}':")
            for i in top_idx:
                cand = CANDIDATES[int(i)]
                print(f"        score={float(sims_np[int(i)]):.4f}  key='{cand.key}'  out='{_lang_label(cand)}'")

    # dedupe but keep order
    seen = set()
    uniq = []
    for t in all_selected:
        norm = t.strip().lower()
        if norm and norm not in seen:
            seen.add(norm)
            uniq.append(norm)

    uniq = uniq[:max_k]

    if settings.DEBUG:
        print(f"[DEBUG] Final selected tags ({len(uniq)}): {uniq}")

    return uniq
