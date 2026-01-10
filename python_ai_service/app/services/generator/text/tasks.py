# app/services/generator/text/tasks.py
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, List, Optional


# ----------------------------
# Data models
# ----------------------------

@dataclass(frozen=True)
class ProductFacts:
    typ: str
    brand: str
    colors: List[str]
    pattern: str
    pack: str
    price: float | None


@dataclass(frozen=True)
class TaskSpec:
    name: str
    marker: str
    char_limit: int
    max_new_tokens: int
    num_beams: int
    num_return_sequences: int
    extra_bad_phrases: tuple[str, ...]
    prompt_builder: Callable[..., str]


# ----------------------------
# Fact extraction (cheap & robust)
# ----------------------------

_COLOR_WORDS = [
    "weiß", "schwarz", "grau", "silber",
    "blau", "navy", "rot", "grün", "gelb", "beige", "creme", "braun",
    "pink", "lila", "orange", "gold",
]

_PATTERNS = [
    "gestreift", "streifen", "kariert", "punkte", "gepunktet", "logo", "schriftzug",
    "3 streifen", "3-stripes", "three stripes",
]


def _norm(s: str) -> str:
    s = (s or "").strip().lower()
    s = s.replace("–", "-").replace("—", "-")
    s = re.sub(r"\s+", " ", s)
    return s


def _extract_pack(caption_n: str) -> str:
    m = re.search(r"\b(\d+)\s*(paar|pairs|pair)\b", caption_n)
    if m:
        return f"{m.group(1)} Paar"
    m = re.search(r"\b(\d+)\s*(pack|er)\b", caption_n)
    if m:
        return f"{m.group(1)}er Pack"
    return ""


def _infer_colors(tags: List[str], caption_n: str) -> List[str]:
    found: List[str] = []
    low_tags = " ".join([_norm(t) for t in (tags or [])])
    for c in _COLOR_WORDS:
        if c in low_tags or re.search(rf"\b{re.escape(c)}\b", caption_n):
            if c not in found:
                found.append(c)
    return found


def _infer_pattern(tags: List[str], caption_n: str) -> str:
    low_tags = " ".join([_norm(t) for t in (tags or [])])
    for p in _PATTERNS:
        if p in low_tags or p in caption_n:
            return p
    return ""


def _infer_type(tags: List[str], caption_n: str) -> str:
    low = " ".join([_norm(t) for t in (tags or [])]) + " " + caption_n
    if "sock" in low or "socken" in low:
        return "Socken"
    if "shirt" in low or "t-shirt" in low:
        return "T-Shirt"
    if "hose" in low or "pants" in low:
        return "Hose"
    return "Produkt"


def extract_product_facts(*, caption: str, brand: str, tags: List[str], price: float | None) -> ProductFacts:
    caption_n = _norm(caption)
    brand_n = (brand or "").strip()
    pack = _extract_pack(caption_n)
    typ = _infer_type(tags, caption_n)
    colors = _infer_colors(tags, caption_n)
    pattern = _infer_pattern(tags, caption_n)

    return ProductFacts(
        typ=typ,
        brand=brand_n,
        colors=colors,
        pattern=pattern,
        pack=pack,
        price=price,
    )


# ----------------------------
# Prompt builders (German)
# ----------------------------

def build_title_prompt_de(
        facts: ProductFacts,
        tags: List[str],
        caption: str,
        char_limit: int,
) -> str:
    # Titel: nur der Titel, kein Prompt-Echo
    # Wichtig: bewusst keine Formulierungen wie "Schreibe/Erstelle" am Anfang,
    # da FLAN-T5 diese gerne paraphrasiert.
    brand = (facts.brand or "").strip()
    typ = (facts.typ or "Produkt").strip()

    pack = facts.pack or ""
    colors = ", ".join([c for c in (facts.colors or []) if c])
    pattern = (facts.pattern or "").strip()

    ctx_lines: list[str] = []
    if brand:
        ctx_lines.append(f"Marke: {brand}")
    if typ:
        ctx_lines.append(f"Typ: {typ}")
    if pack:
        ctx_lines.append(f"Menge: {pack}")
    if colors:
        ctx_lines.append(f"Farbe: {colors}")
    if pattern:
        ctx_lines.append(f"Merkmal: {pattern}")
    if tags:
        ctx_lines.append(f"Tags: {', '.join(tags[:8])}")
    if caption:
        ctx_lines.append(f"Bild: {caption}")

    ctx = "\n".join(ctx_lines)

    return (
        "DU ERSTELLST NUR DEN TITEL.\n"
        f"Maximal {int(char_limit)} Zeichen.\n"
        "Keine Anführungszeichen. Keine Labels (nicht 'Marke:', nicht 'Tags:').\n"
        "Kein Satz wie 'Schreiben Sie...' oder 'professionell'.\n"
        "Kein ganzer Fließtext, sondern ein normaler Shop-Titel.\n"
        "\n"
        "Fakten:\n"
        f"{ctx}\n"
        "\n"
        "OUTPUT:\n"
    )


def build_desc_prompt_de(
        facts: ProductFacts,
        tags: List[str],
        caption: str,
        char_limit: int,
) -> str:
    # Beschreibung: nur Beschreibung, 2-4 Sätze, kein Prompt-Echo
    brand = (facts.brand or "").strip()
    typ = (facts.typ or "Produkt").strip()

    pack = facts.pack or ""
    colors = ", ".join([c for c in (facts.colors or []) if c])
    pattern = (facts.pattern or "").strip()

    ctx_lines: list[str] = []
    if brand:
        ctx_lines.append(f"Marke: {brand}")
    if typ:
        ctx_lines.append(f"Typ: {typ}")
    if pack:
        ctx_lines.append(f"Menge: {pack}")
    if colors:
        ctx_lines.append(f"Farbe: {colors}")
    if pattern:
        ctx_lines.append(f"Merkmal: {pattern}")
    if tags:
        ctx_lines.append(f"Tags: {', '.join(tags[:8])}")
    if caption:
        ctx_lines.append(f"Bild: {caption}")
    if facts.price is not None and facts.price > 0:
        ctx_lines.append(f"Preis: {facts.price:.2f} EUR")

    ctx = "\n".join(ctx_lines)

    return (
        "DU ERSTELLST NUR DIE BESCHREIBUNG.\n"
        f"Maximal {int(char_limit)} Zeichen.\n"
        "2 bis 4 Sätze, natürliches Deutsch, verkaufsstark.\n"
        "Keine Aufzählungen. Keine Labels. Kein Prompt-Text.\n"
        "Kein Satz wie 'Das Produkt ist von ...' – schreibe wie im Shop.\n"
        "Keine erfundenen Details (Material/Technologie/Größe), wenn nicht genannt.\n"
        "\n"
        "Fakten:\n"
        f"{ctx}\n"
        "\n"
        "OUTPUT:\n"
    )
