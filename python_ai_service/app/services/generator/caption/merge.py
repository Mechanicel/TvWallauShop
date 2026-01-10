from __future__ import annotations

import re
from typing import List

from .similarity import jaccard_similarity


def merge_captions(
        captions: List[str],
        max_sentences: int = 3,
        max_chars: int = 220,
        sim_threshold: float = 0.85,
) -> str:
    caps = [c.strip() for c in (captions or []) if c and c.strip()]
    if not caps:
        return ""

    # Duplikate raus (ähnliche Sätze)
    kept: List[str] = []
    for c in caps:
        if not kept:
            kept.append(c)
            continue
        if max(jaccard_similarity(c, k) for k in kept) < sim_threshold:
            kept.append(c)

    text = " ".join(kept).strip()

    # Satzlimit
    sents = re.split(r"(?<=[.!?])\s+", text)
    sents = [s.strip() for s in sents if s.strip()]
    if sents:
        text = " ".join(sents[: max(1, int(max_sentences))]).strip()

    if len(text) > int(max_chars):
        text = text[: int(max_chars)].rstrip()
        text = re.sub(r"\s+\S*$", "", text).rstrip()
        if text and text[-1].isalnum():
            text += "."

    return text
