from __future__ import annotations

import re


# erkennt typische Instruktions-/Prompt-Zeilen
INSTRUCTION_PAT = re.compile(
    r"\b("
    r"schreibe|write|antwort|answer|regeln|rules|max\s*\d+|keine\s+links|no\s+links|"
    r"nur\s+mit|only\s+with|output|ausgabe|format|kontext|antwort"
    r")\b",
    re.IGNORECASE,
)

_PREFIX_PAT = re.compile(r"^\s*(titel|title|beschreibung|description)\s*:\s*", re.IGNORECASE)
_ARROW_PAT = re.compile(r"\s*(->|→)\s*.*$", re.IGNORECASE)

# Meta-/Instruktions-Paraphrasen am Anfang (Model gibt Aufgabe zurück)
_META_START = re.compile(
    r"^\s*(schreiben\s+sie|schreibe|erstelle|erstellen|generiere|create|write|"
    r"professionell|produkttitel|produktbeschreibung|du\s+erstellst|output)\b",
    re.IGNORECASE,
)


def _drop_if_meta(text: str) -> str:
    s = (text or "").strip()
    if not s:
        return ""
    if _META_START.search(s):
        return ""
    return s


# häufige „Müll“-Tokens aus Model-Outputs
_REPLACE = [
    (re.compile(r"\s+"), " "),
    (re.compile(r"^[\"'“”‘’]+|[\"'“”‘’]+$"), ""),
    (re.compile(r"\s+\."), "."),
    (re.compile(r"\s+,"), ","),  # <-- FIX: re.compile bekommt nur pattern (keine ","-flags)
]


def _apply_replacements(s: str) -> str:
    out = s
    for pat, repl in _REPLACE:
        out = pat.sub(repl, out)
    return out


def enforce_char_limit(text: str, limit: int) -> str:
    """
    Schneidet möglichst "sauber" auf limit Zeichen:
    - bevorzugt Satzende (., !, ?)
    - sonst hart schneiden
    """
    s = (text or "").strip()
    if not limit or limit <= 0:
        return s
    if len(s) <= limit:
        return s

    cut = s[:limit].rstrip()

    # falls danach direkt ein Satzzeichen kommt, nehmen wir's noch mit (wenn es passt)
    if limit < len(s) and s[limit : limit + 1] in ".!?":
        cut = (cut + s[limit]).strip()

    # sonst auf letztes Satzende innerhalb der letzten ~80 Zeichen kürzen
    last = max(cut.rfind("."), cut.rfind("!"), cut.rfind("?"))
    if last >= max(20, len(cut) - 80):
        cut = cut[: last + 1].strip()

    return cut


def clean(text: str, limit: int | None = None) -> str:
    """
    Entfernt Prefixe/Instruktionen/Arrow-Müll und normalisiert Whitespace.
    """
    s = (text or "").strip()
    if not s:
        return ""

    # Zeilen mit Instruktionen rauswerfen (oft: "Write a title..." etc.)
    lines = [ln.strip() for ln in s.splitlines() if ln.strip()]
    kept = []
    for ln in lines:
        if INSTRUCTION_PAT.search(ln) and len(ln) < 140:
            continue
        kept.append(ln)
    s = " ".join(kept) if kept else s

    s = _PREFIX_PAT.sub("", s)
    s = _ARROW_PAT.sub("", s)

    s = _apply_replacements(s).strip()

    if limit:
        s = enforce_char_limit(s, int(limit))

    return s


def first_non_instruction_line(text: str) -> str:
    """
    Gibt die erste "sinnvolle" Zeile zurück, die nicht nach Instruktion/Prompt aussieht.
    Falls nichts gefunden wird, fällt es auf den bereinigten Gesamttext zurück.
    """
    s = (text or "").strip()
    if not s:
        return ""

    lines = [ln.strip() for ln in s.splitlines() if ln.strip()]
    for ln in lines:
        cand = _PREFIX_PAT.sub("", ln).strip()
        cand = _ARROW_PAT.sub("", cand).strip()

        if INSTRUCTION_PAT.search(cand) and len(cand) < 140:
            continue

        if cand:
            return cand

    return clean(s)


def normalize_text(text: str) -> str:
    if not text:
        return ""

    t = text.lower()
    t = t.replace("–", "-").replace("—", "-")
    t = re.sub(r"[^\wäöüß\s\-.,]", "", t)
    t = re.sub(r"\s+", " ", t)
    return t.strip()


def postprocess_title(
        text: str,
        *,
        brand: str,
        char_limit: int,
) -> str:
    if not text:
        return ""

    t = clean(text)
    t = _PREFIX_PAT.sub("", t)

    # Marke nicht doppeln
    if brand:
        b = brand.lower()
        if t.lower().startswith(b + " "):
            t = t[len(brand) :].strip()

    t = _apply_replacements(t)
    t = re.sub(r"[.!?]+$", "", t).strip()

    t = _drop_if_meta(t)
    if not t:
        return ""

    if char_limit and len(t) > char_limit:
        t = t[:char_limit].rstrip()

    return t


def postprocess_description(
        text: str,
        *,
        brand: str,
        char_limit: int,
) -> str:
    if not text:
        return ""

    t = clean(text)
    t = _PREFIX_PAT.sub("", t)
    t = first_non_instruction_line(t)

    t = _apply_replacements(t)
    t = re.sub(r"\s+", " ", t).strip()

    t = _drop_if_meta(t)
    if not t:
        return ""

    # Falls es zu kurz / leer wirkt → minimal aufblasen
    if len(t.split()) < 6:
        if brand:
            t = f"{brand} {t}"
        t = t + " Geeignet für Sport und Alltag."

    if not re.search(r"[.!?]$", t):
        t += "."

    if char_limit and len(t) > char_limit:
        t = t[:char_limit].rstrip()
        if not t.endswith("."):
            t += "."

    return t
