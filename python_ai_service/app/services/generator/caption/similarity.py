from __future__ import annotations

import re
from typing import Set


def _tok(s: str) -> Set[str]:
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9äöüß\s]+", " ", s, flags=re.IGNORECASE)
    s = re.sub(r"\s+", " ", s).strip()
    return set(s.split()) if s else set()


def jaccard_similarity(a: str, b: str) -> float:
    A = _tok(a)
    B = _tok(b)
    if not A and not B:
        return 1.0
    if not A or not B:
        return 0.0
    return len(A & B) / float(len(A | B))
