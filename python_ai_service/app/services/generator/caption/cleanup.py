from __future__ import annotations

import re
from collections import Counter

_GENERIC_PREFIX_RE = re.compile(
    r"^(a|an)\s+(product\s+)?(photo|image|picture)\s+of\s+",
    flags=re.IGNORECASE,
)

_PERSON_ANYWHERE_RE = re.compile(
    r"\b(woman|women|man|men|person|people|model|boy|girl|child|kid|little\s+boy|little\s+girl)\b",
    flags=re.IGNORECASE,
)

_WEARING_RE = re.compile(r"\bwearing\b", flags=re.IGNORECASE)


def cleanup_caption(text: str, max_sentences: int = 2) -> str:
    t = (text or "").strip()
    if not t:
        return ""

    t = re.sub(r"\s+", " ", t).strip()
    t = _GENERIC_PREFIX_RE.sub("", t).strip()

    # Personen raus
    t = _PERSON_ANYWHERE_RE.sub("", t).strip()
    t = _WEARING_RE.sub("", t).strip()
    t = re.sub(r"\s+", " ", t).strip()

    # Doppelte Worte reduzieren
    words = re.findall(r"[A-Za-zÄÖÜäöüß0-9]+|[^\w\s]", t, flags=re.UNICODE)
    c = Counter(w.lower() for w in words if re.match(r"[A-Za-zÄÖÜäöüß0-9]+$", w))
    # wenn extrem repetitiv: kurze Normalisierung
    if c and max(c.values()) >= 4:
        t = re.sub(r"\b(\w+)(\s+\1\b)+", r"\1", t, flags=re.IGNORECASE)

    # Sätze begrenzen
    sents = re.split(r"(?<=[.!?])\s+", t)
    sents = [s.strip() for s in sents if s.strip()]
    if sents:
        t = " ".join(sents[: max(1, int(max_sentences))]).strip()

    # blöde Enden weg
    t = re.sub(r"\b(und|mit)\s*$", "", t, flags=re.IGNORECASE).strip()
    t = re.sub(r"\s+\.\s*$", ".", t).strip()

    t = t.strip(" \t\n\r\f\v\"'").strip()
    if not t:
        return ""

    if not t.endswith((".", "!", "?")):
        t += "."

    return t
