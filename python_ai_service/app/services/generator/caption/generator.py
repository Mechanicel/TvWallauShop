from __future__ import annotations

import re
import time
from typing import List, Sequence, Union, Optional

import torch

from app.config import get_settings
from app.services.loader.caption_model_loader import get_caption_model

from .cleanup import cleanup_caption
from .image_loader import load_image
from .merge import merge_captions
from .translate_de import germanize_caption

settings = get_settings()


def _to_device(batch: dict, device: torch.device) -> dict:
    if device.type == "cpu":
        return batch
    out = {}
    for k, v in batch.items():
        if hasattr(v, "to"):
            out[k] = v.to(device)
        else:
            out[k] = v
    return out


def _build_bad_words_ids(tokenizer) -> List[List[int]]:
    bad = (getattr(settings, "CAPTION_BAD_WORDS", "") or "").strip()
    if not bad or tokenizer is None:
        return []
    words = [w.strip() for w in bad.split(",") if w.strip()]
    ids: List[List[int]] = []
    for w in words:
        try:
            enc = tokenizer(w, add_special_tokens=False).get("input_ids") or []
            if enc:
                ids.append(enc)
        except Exception:
            pass
    return ids


def generate_caption(path_or_urls: Union[str, Sequence[str]]) -> str:
    model, processor, device, backend = get_caption_model()

    paths: List[str]
    if isinstance(path_or_urls, str):
        paths = [path_or_urls]
    else:
        paths = [p for p in list(path_or_urls) if p]

    if not paths:
        return ""

    base_prompt = (getattr(settings, "CAPTION_PROMPT_PREFIX", None) or "a product photo of").strip()

    max_new_tokens = int(getattr(settings, "CAPTION_MAX_NEW_TOKENS", 24))
    min_new_tokens = int(getattr(settings, "CAPTION_MIN_NEW_TOKENS", 6))
    num_beams = int(getattr(settings, "CAPTION_NUM_BEAMS", 4))
    num_return_sequences = int(getattr(settings, "CAPTION_NUM_RETURN_SEQUENCES", 2))
    do_sample = bool(getattr(settings, "CAPTION_DO_SAMPLE", False))
    repetition_penalty = float(getattr(settings, "CAPTION_REPETITION_PENALTY", 1.2))
    no_repeat_ngram_size = int(getattr(settings, "CAPTION_NO_REPEAT_NGRAM_SIZE", 3))

    cleanup_max_sentences = int(getattr(settings, "CAPTION_CLEANUP_MAX_SENTENCES", 2))
    merge_max_sentences = int(getattr(settings, "CAPTION_MERGE_MAX_SENTENCES", 3))
    merge_max_chars = int(getattr(settings, "CAPTION_MERGE_MAX_CHARS", 220))
    sim_threshold = float(getattr(settings, "CAPTION_MERGE_SIM_THRESHOLD", 0.85))

    tokenizer = getattr(processor, "tokenizer", None)
    bad_words_ids = _build_bad_words_ids(tokenizer) if tokenizer is not None else []

    use_decoder_prompt = bool(getattr(settings, "CAPTION_USE_DECODER_PROMPT", True))

    if settings.DEBUG:
        print(f"[DEBUG] CAPTION backend={backend}", flush=True)
        print(
            "[DEBUG] CAPTION SETTINGS:",
            f"max_new_tokens={max_new_tokens}",
            f"min_new_tokens={min_new_tokens}",
            f"beams={num_beams}",
            f"return_sequences={num_return_sequences}",
            f"do_sample={do_sample}",
            f"repetition_penalty={repetition_penalty}",
            f"no_repeat_ngram_size={no_repeat_ngram_size}",
            f"use_decoder_prompt={use_decoder_prompt}",
            f"bad_words={len(bad_words_ids)}",
            f"cleanup_max_sentences={cleanup_max_sentences}",
            f"merge_max_sentences={merge_max_sentences}",
            f"merge_max_chars={merge_max_chars}",
            f"sim_threshold={sim_threshold}",
            flush=True,
        )
        if not getattr(processor, "supports_prompt", True):
            print(
                "[DEBUG] CAPTION NOTE: processor unterstützt keinen Text-Prompt -> decoder_input_ids-Prompt ist standardmäßig AUS (Stabilität).",
                flush=True,
            )

    caps: List[str] = []
    t_total = time.perf_counter()

    for img_idx, p in enumerate(paths):
        image = load_image(p, timeout_sec=int(getattr(settings, "CAPTION_HTTP_TIMEOUT", 12)))

        # Prompt nur dann an den Processor geben, wenn er es wirklich unterstützt (z.B. BLIP)
        text_prompt = base_prompt if (use_decoder_prompt and getattr(processor, "supports_prompt", False)) else None
        batch = processor(images=image, text=text_prompt, return_tensors="pt")
        batch = _to_device(batch, device)

        gen_kwargs = dict(
            max_new_tokens=max_new_tokens,
            min_new_tokens=min_new_tokens,
            num_beams=max(num_beams, num_return_sequences),
            num_return_sequences=num_return_sequences,
            do_sample=do_sample,
            repetition_penalty=repetition_penalty,
            no_repeat_ngram_size=no_repeat_ngram_size,
            early_stopping=True,
            length_penalty=1.0,
        )

        # Optional: decoder_input_ids-Prompt (standardmäßig AUS; nur wenn processor das explizit erlaubt)
        if (
                use_decoder_prompt
                and tokenizer is not None
                and (not getattr(processor, "supports_prompt", False))
                and getattr(processor, "allow_decoder_input_prompt", False)
        ):
            prompt_enc = tokenizer(base_prompt, return_tensors="pt", add_special_tokens=False)
            decoder_input_ids = prompt_enc["input_ids"].to(torch.device("cpu"))
            decoder_attention_mask = torch.ones_like(decoder_input_ids).to(torch.device("cpu"))
            gen_kwargs["decoder_input_ids"] = decoder_input_ids
            gen_kwargs["decoder_attention_mask"] = decoder_attention_mask

        if bad_words_ids:
            gen_kwargs["bad_words_ids"] = bad_words_ids

        t_inf = time.perf_counter()
        out_ids = model.generate(**batch, **gen_kwargs)
        inf_s = time.perf_counter() - t_inf

        for k in range(out_ids.shape[0]):
            raw = processor.decode(out_ids[k], skip_special_tokens=True).strip()

            if settings.DEBUG:
                print(f"[DEBUG] CAPTION RAW   img#{img_idx+1} seq#{k+1}: {raw}", flush=True)

            # EN -> DE light
            de = germanize_caption(raw)

            # cleanup / normalize
            clean = cleanup_caption(de, max_sentences=cleanup_max_sentences)

            if settings.DEBUG:
                print(f"[DEBUG] CAPTION CLEAN img#{img_idx+1} seq#{k+1}: {clean}", flush=True)
                print(f"[DEBUG] CAPTION INF   img#{img_idx+1}: {inf_s:.2f}s", flush=True)

            if clean:
                caps.append(clean)

    merged = merge_captions(caps, max_sentences=merge_max_sentences, max_chars=merge_max_chars, sim_threshold=sim_threshold)

    if settings.DEBUG:
        print(f"[DEBUG] CAPTION merged_count={len(caps)} chars={len(merged)} total_time={time.perf_counter()-t_total:.2f}s", flush=True)
        print(f"[DEBUG] CAPTION MERGED: {merged}", flush=True)

    return merged
