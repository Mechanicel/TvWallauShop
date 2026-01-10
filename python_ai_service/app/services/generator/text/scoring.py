from __future__ import annotations

import re
from typing import Callable, List


# Alles, was NIE im finalen Output stehen soll.
# Wird auch für bad_words_ids genutzt -> großer Hebel.
BAD_PHRASES = (
    # Prompt-/Instruktions-Leak
    "schreibe",
    "write",
    "aufgabe",
    "regeln",
    "format",
    "ausgabe",
    "output",
    "schreiben sie",
    "erstelle",
    "erstellen",
    "generiere",
    "professionell",
    "produkttitel",
    "produktbeschreibung",
    "du erstellst",
    "output:",

    # Links
    "links",
    "website",
    "http",
    "www",

    # Feldnamen / Labels
    "brand:",
    "brand",
    "marke:",
    "marke",
    "label:",
    "label",
    "tag:",
    "tag",
    "tags:",
    "tags",
    "caption:",
    "caption",
    "bildbeschreibung:",
    "bildbeschreibung",
    "preis:",
    "preis",

    # Sonstiges
    "unknown",
    "unbekannt",
    "beispielmarke",
)

_BAD_RE = re.compile("|".join(re.escape(p) for p in BAD_PHRASES), re.IGNORECASE)


def _penalize_bad_phrases(text: str) -> float:
    if not text:
        return 999.0
    hits = len(_BAD_RE.findall(text))
    return float(hits * 5.0)


def _penalize_too_long(text: str, limit: int) -> float:
    if not text or not limit:
        return 0.0
    if len(text) <= limit:
        return 0.0
    return float((len(text) - limit) * 0.2)


def _penalize_repetition(text: str) -> float:
    if not text:
        return 10.0
    toks = re.findall(r"\w+", text.lower())
    if len(toks) < 6:
        return 0.0
    uniq = len(set(toks))
    ratio = uniq / max(1, len(toks))
    # je kleiner ratio, desto mehr Wiederholung -> stärker bestrafen
    return float(max(0.0, (0.65 - ratio)) * 30.0)


def score_title(text: str, brand_norm: str, limit: int) -> float:
    """Smaller is better."""
    t = (text or "").strip()
    s = 0.0
    s += _penalize_bad_phrases(t)
    s += _penalize_too_long(t, limit)
    s += _penalize_repetition(t)

    # Titel sollte kein ganzer Satz sein (Punkt am Ende)
    if t.endswith("."):
        s += 2.0

    # Wenn Brand doppelt vorkommt -> leicht bestrafen
    if brand_norm and t.lower().count(brand_norm.lower()) >= 2:
        s += 1.5

    return float(s)


def score_desc(text: str, brand_norm: str, limit: int) -> float:
    """Smaller is better."""
    t = (text or "").strip()
    s = 0.0
    s += _penalize_bad_phrases(t)
    s += _penalize_too_long(t, limit)
    s += _penalize_repetition(t)

    # Beschreibung sollte nicht super kurz sein
    if len(re.findall(r"\w+", t)) < 12:
        s += 3.0

    # Brand sollte nicht dauernd wiederholt werden
    if brand_norm and t.lower().count(brand_norm.lower()) >= 3:
        s += 2.0

    return float(s)
