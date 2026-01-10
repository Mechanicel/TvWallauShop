from __future__ import annotations

from functools import lru_cache
from typing import List, Optional, Tuple

import torch


def safe_model_max_len(tokenizer) -> int:
    mml = getattr(tokenizer, "model_max_length", None)
    if isinstance(mml, int) and 0 < mml < 10_000:
        return min(mml, 512)
    return 512


def build_bad_words_ids(tokenizer, phrases: List[str]) -> Optional[List[List[int]]]:
    """
    Wandelt Phrasen in token-ids um (für bad_words_ids).
    Achtung: nicht perfekt zuverlässig, aber kann helfen gegen Prompt-Leaks.
    """
    ids: List[List[int]] = []
    for p in phrases:
        p = (p or "").strip()
        if not p:
            continue
        tid = tokenizer(p, add_special_tokens=False).input_ids
        if tid:
            ids.append(tid)
    return ids or None


@lru_cache(maxsize=1)
def get_text_engine():
    """
    WICHTIG:
    - Gibt absichtlich nur (model, tokenizer) zurück, damit alter Code
      `model, tokenizer = get_text_engine()` NICHT crasht.
    - Das device wird am model abgelegt: model._tv_device
    """
    # lazy import -> vermeidet Zirkular-Imports
    from app.services.loader.text_model_loader import get_text_model

    model, tokenizer, device = get_text_model()

    # device am model merken (für generate_many)
    try:
        setattr(model, "_tv_device", device)
    except Exception:
        pass

    return model, tokenizer


def _infer_device(model) -> str:
    # 1) von uns gesetztes Attribut
    d = getattr(model, "_tv_device", None)
    if isinstance(d, str) and d:
        return d

    # 2) evtl. torch device am model
    try:
        p = next(model.parameters())
        return str(p.device)
    except Exception:
        return "cpu"


@torch.inference_mode()
def generate_many(
        model,
        tokenizer,
        *args,
        **kwargs,
) -> List[str]:
    """
    Abwärtskompatibel:

    ALT:
      generate_many(model, tokenizer, device, prompt, max_new_tokens, num_beams, num_return_sequences, bad_words_ids=None)

    NEU:
      generate_many(model, tokenizer, prompt, max_new_tokens=..., num_beams=..., num_return_sequences=..., bad_words_ids=None, ...)

    Du kannst also sowohl alte als auch neue Call-Sites stehen lassen.
    """
    # --- Args normalisieren ---
    device: Optional[str] = None
    prompt: Optional[str] = None

    # Positional parsing:
    # - Wenn erstes arg ein str ist -> das ist prompt
    # - sonst: erstes arg ist device, zweites ist prompt
    if len(args) >= 1 and isinstance(args[0], str):
        prompt = args[0]
        rest = args[1:]
    else:
        device = args[0] if len(args) >= 1 else None
        prompt = args[1] if len(args) >= 2 else None
        rest = args[2:]

    if prompt is None:
        prompt = kwargs.pop("prompt", "")
    if device is None:
        device = kwargs.pop("device", None)

    if not device:
        device = _infer_device(model)

    # weitere Parameter: entweder positional (alt) oder kwargs (neu)
    def _kw_or_rest(name: str, idx: int, default):
        if name in kwargs:
            return kwargs.pop(name)
        if len(rest) > idx:
            return rest[idx]
        return default

    max_new_tokens = int(_kw_or_rest("max_new_tokens", 0, 160))
    num_beams = int(_kw_or_rest("num_beams", 1, 4))
    num_return_sequences = int(_kw_or_rest("num_return_sequences", 2, 1))
    bad_words_ids = kwargs.pop("bad_words_ids", None)

    # Optional sampling params (falls du sie gibst)
    do_sample = bool(kwargs.pop("do_sample", False))
    temperature = float(kwargs.pop("temperature", 1.0))
    top_p = float(kwargs.pop("top_p", 1.0))
    top_k = int(kwargs.pop("top_k", 50))

    # kleine Defaults gegen Prompt-Echo / Wiederholungen
    no_repeat_ngram_size = int(kwargs.pop("no_repeat_ngram_size", 3))
    encoder_no_repeat_ngram_size = int(kwargs.pop("encoder_no_repeat_ngram_size", 4))
    repetition_penalty = float(kwargs.pop("repetition_penalty", 1.10))
    length_penalty = float(kwargs.pop("length_penalty", 0.95))
    early_stopping = bool(kwargs.pop("early_stopping", True))

    # --- Tokenize ---
    max_len = safe_model_max_len(tokenizer)
    inputs = tokenizer(
        prompt,
        return_tensors="pt",
        truncation=True,
        max_length=max_len,
    ).to(device)

    outs = model.generate(
        **inputs,
        max_new_tokens=max_new_tokens,
        min_new_tokens=max(0, min(18, max_new_tokens // 4)),
        do_sample=do_sample,
        temperature=temperature,
        top_p=top_p,
        top_k=top_k,
        num_beams=max(1, num_beams),
        num_return_sequences=max(1, num_return_sequences),
        no_repeat_ngram_size=no_repeat_ngram_size,
        encoder_no_repeat_ngram_size=encoder_no_repeat_ngram_size,
        repetition_penalty=repetition_penalty,
        length_penalty=length_penalty,
        early_stopping=early_stopping,
        bad_words_ids=bad_words_ids,
    )

    return [tokenizer.decode(outs[i], skip_special_tokens=True).strip() for i in range(outs.shape[0])]

def build_base_prompt(
        *,
        task: str,
        brand: str,
        tags: list[str],
        caption: str,
        price: float | None = None,
) -> str:
    parts: list[str] = []

    # Kontext klar getrennt
    parts.append("KONTEXT:")
    if brand:
        parts.append(f"- Marke: {brand}")
    if tags:
        parts.append(f"- Tags: {', '.join(tags[:10])}")
    if caption:
        parts.append(f"- Bild: {caption}")
    if price is not None:
        parts.append(f"- Preis: {price:.2f} EUR")

    parts.append("")
    parts.append("AUFGABE:")
    parts.append(task.strip())

    # wichtig: endet auf ANTWORT:
    parts.append("")
    parts.append("ANTWORT:")

    return "\n".join(parts).strip()

