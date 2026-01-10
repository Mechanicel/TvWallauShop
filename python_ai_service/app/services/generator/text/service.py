from __future__ import annotations

import inspect
import logging
import re
from typing import List, Tuple

from app.config import get_settings

from .engine import build_bad_words_ids, generate_many, get_text_engine
from .postprocess import normalize_text, postprocess_description, postprocess_title
from .scoring import BAD_PHRASES, score_desc, score_title
from .tasks import extract_product_facts, build_desc_prompt_de, build_title_prompt_de

settings = get_settings()
logger = logging.getLogger("tvwallau-ai")


def _call_scorer(scorer, text: str, brand_norm: str, limit: int) -> float:
    """Call scorer with a flexible signature.
    Supports scorer(text) or scorer(text, limit) or scorer(text, brand_norm, limit).
    """
    try:
        sig = inspect.signature(scorer)
        n = len(
            [
                p
                for p in sig.parameters.values()
                if p.kind in (p.POSITIONAL_ONLY, p.POSITIONAL_OR_KEYWORD) and p.default is p.empty
            ]
        )
    except Exception:
        n = 1

    try:
        if n <= 1:
            return float(scorer(text))
        if n == 2:
            return float(scorer(text, limit))
        return float(scorer(text, brand_norm, limit))
    except TypeError:
        # last resort: try keyword args
        try:
            return float(scorer(text=text, brand_norm=brand_norm, limit=limit))
        except Exception:
            return float(scorer(text))


def _pick_best(cands, scorer, brand_norm: str, limit: int) -> str:
    """Pick candidate with the BEST (= lowest) score."""
    cands = [c for c in (cands or []) if c and str(c).strip()]
    if not cands:
        return ""
    scored = [(_call_scorer(scorer, c, brand_norm, limit), c) for c in cands]
    scored.sort(key=lambda x: x[0])  # score_* are penalties => smaller is better
    return scored[0][1]


def _clean_hard_echo(text: str) -> str:
    """Last-resort stripping of prompt-echo artifacts."""
    s = (text or "").strip()
    if not s:
        return ""

    # if model repeats our marker, keep only content after it
    if "OUTPUT:" in s:
        s = s.split("OUTPUT:", 1)[-1].strip()
    if "ANTWORT:" in s:
        s = s.split("ANTWORT:", 1)[-1].strip()

    # drop obvious meta prefixes
    s = re.sub(r"(?i)^\s*(kontext|aufgabe|antwort|output)\s*:\s*", "", s).strip()

    # collapse lines
    lines = [ln.strip() for ln in s.splitlines() if ln.strip()]
    if lines:
        s = " ".join(lines)

    return s.strip()


def _generate(
        prompt: str,
        *,
        max_new_tokens: int,
        num_beams: int,
        num_return_sequences: int,
) -> List[str]:
    model, tokenizer = get_text_engine()

    # Stop common leak tokens/phrases already at generation time
    extra = [
        "KONTEXT:",
        "AUFGABE:",
        "ANTWORT:",
        "OUTPUT:",
        "Marke:",
        "Tags:",
        "Preis:",
        "Bild:",
        "Bildbeschreibung:",
    ]
    bad_words_ids = build_bad_words_ids(tokenizer, list(BAD_PHRASES) + extra)

    outs = generate_many(
        model,
        tokenizer,
        prompt,
        max_new_tokens=max_new_tokens,
        num_beams=num_beams,
        num_return_sequences=num_return_sequences,
        bad_words_ids=bad_words_ids,
        no_repeat_ngram_size=3,
        repetition_penalty=1.15,
        length_penalty=1.0,
        early_stopping=True,
    )

    cleaned: List[str] = []
    for s in outs:
        s = _clean_hard_echo(s)
        if s:
            cleaned.append(s)
    return cleaned


def generate_title_and_description(
        *,
        caption: str,
        tags: List[str],
        brand: str,
        price: float | None = None,
        title_limit: int | None = None,
        desc_limit: int | None = None,
) -> Tuple[str, str]:
    title_limit = int(title_limit or getattr(settings, "TEXT_MAX_TITLE_CHARS", 60))
    desc_limit = int(desc_limit or getattr(settings, "TEXT_MAX_DESC_CHARS", 1000))

    caption_raw = (caption or "").strip()
    tags_raw = [str(t).strip() for t in (tags or []) if t and str(t).strip()]
    brand_raw = (brand or "").strip()

    # Display brand for text (Adidas), but keep normalized for scoring
    brand_disp = brand_raw[:1].upper() + brand_raw[1:] if brand_raw else ""
    brand_norm = normalize_text(brand_raw)

    facts = extract_product_facts(caption=caption_raw, brand=brand_disp, tags=tags_raw, price=price)

    title_prompt = build_title_prompt_de(facts=facts, tags=tags_raw, caption=caption_raw, char_limit=title_limit)
    desc_prompt = build_desc_prompt_de(facts=facts, tags=tags_raw, caption=caption_raw, char_limit=desc_limit)

    # Debug: prompts
    logger.debug("TITLE PROMPT:\n%s", title_prompt)
    logger.debug("DESC  PROMPT:\n%s", desc_prompt)

    max_new = int(getattr(settings, "TEXT_MAX_NEW_TOKENS", 160))

    title_cands = _generate(
        title_prompt,
        max_new_tokens=min(56, max_new),
        num_beams=6,
        num_return_sequences=4,
    )
    desc_cands = _generate(
        desc_prompt,
        max_new_tokens=max(160, max_new),
        num_beams=6,
        num_return_sequences=6,
    )

    logger.debug("TITLE CANDS RAW (%d): %s", len(title_cands), title_cands)
    logger.debug("DESC  CANDS RAW (%d): %s", len(desc_cands), desc_cands)

    title_pp = [postprocess_title(t, brand=brand_disp, char_limit=title_limit) for t in title_cands if t]
    desc_pp = [postprocess_description(d, brand=brand_disp, char_limit=desc_limit) for d in desc_cands if d]

    logger.debug("TITLE CANDS PP (%d): %s", len(title_pp), title_pp)
    logger.debug("DESC  CANDS PP (%d): %s", len(desc_pp), desc_pp)

    # Score debug (why picked)
    title_scored = [(score_title(t, brand_norm, title_limit), t) for t in title_pp]
    title_scored.sort(key=lambda x: x[0])
    logger.debug("TITLE SCORED: %s", title_scored[:8])

    desc_scored = [(score_desc(d, brand_norm, desc_limit), d) for d in desc_pp]
    desc_scored.sort(key=lambda x: x[0])
    logger.debug("DESC SCORED: %s", desc_scored[:8])

    title = _pick_best(title_pp, score_title, brand_norm, title_limit) or (title_pp[0] if title_pp else "")
    description = _pick_best(desc_pp, score_desc, brand_norm, desc_limit) or (desc_pp[0] if desc_pp else "")

    return title, description
