from __future__ import annotations

import re

_PHRASE_MAP = [
    (r"\btrack pants\b", "Trainingshose"),
    (r"\btrack jacket\b", "Trainingsjacke"),
    (r"\btrack suit\b", "Trainingsanzug"),
    (r"\bbomber jacket\b", "Bomberjacke"),
    (r"\bfrom the head down\b", "von Kopf bis Fuß"),
    (r"\bfrom head down\b", "von Kopf bis Fuß"),
    (r"\bon a (black and white )?boards\b", "auf schwarz-weißen Brettern"),
]

_WORD_MAP = {
    r"\bcrew socks\b": "Crew-Socken",
    r"\bsocks\b": "Socken",
    r"\bsock\b": "Socke",
    r"\bshoes\b": "Schuhe",
    r"\bshoe\b": "Schuh",
    r"\bboards\b": "Bretter",
    r"\bboard\b": "Brett",
    r"\bon\b": "auf",
    r"\brow\b": "Reihe",
    r"\bsome\b": "",
    r"\btime\b": "",
    r"\bjacket\b": "Jacke",
    r"\bcoat\b": "Mantel",
    r"\bhoodie\b": "Hoodie",
    r"\bsweatshirt\b": "Sweatshirt",
    r"\bt-shirt\b": "T-Shirt",
    r"\btee\b": "T-Shirt",
    r"\bshirt\b": "Shirt",
    r"\bshorts\b": "Shorts",
    r"\bshort\b": "Kurz",
    r"\bpants\b": "Hose",
    r"\btrousers\b": "Hose",
    r"\bjeans\b": "Jeans",
    r"\bdress\b": "Kleid",
    r"\bskirt\b": "Rock",
    r"\bshoes?\b": "Schuhe",
    r"\bsneakers?\b": "Sneaker",
    r"\bcap\b": "Cap",
    r"\bhat\b": "Hut",
    r"\bgloves?\b": "Handschuhe",
    r"\bbag\b": "Tasche",
    r"\bbackpack\b": "Rucksack",
    r"\bhandbag\b": "Handtasche",
    r"\bwatch\b": "Uhr",
    r"\bsunglasses\b": "Sonnenbrille",
    r"\bstripes?\b": "Streifen",
}

_COLOR_MAP = [
    (r"\bblack\b", "schwarz"),
    (r"\bwhite\b", "weiß"),
    (r"\bgrey\b", "grau"),
    (r"\bgray\b", "grau"),
    (r"\bblue\b", "blau"),
    (r"\bnavy\b", "navy"),
    (r"\bred\b", "rot"),
    (r"\bgreen\b", "grün"),
    (r"\byellow\b", "gelb"),
    (r"\bpink\b", "pink"),
    (r"\bpurple\b", "lila"),
    (r"\bbeige\b", "beige"),
    (r"\bbrown\b", "braun"),
    (r"\borange\b", "orange"),
    (r"\bgold\b", "gold"),
    (r"\bsilver\b", "silber"),
]


def germanize_caption(text: str) -> str:
    t = (text or "").strip()
    if not t:
        return ""

    # normalize whitespace
    t = re.sub(r"\s+", " ", t).strip()

    # phrases first
    for pat, repl in _PHRASE_MAP:
        t = re.sub(pat, repl, t, flags=re.IGNORECASE)

    # words
    for pat, repl in _WORD_MAP.items():
        t = re.sub(pat, repl, t, flags=re.IGNORECASE)

    # colors
    for pat, repl in _COLOR_MAP:
        t = re.sub(pat, repl, t, flags=re.IGNORECASE)

    # kleine Grammatik-Glättung
    t = re.sub(r"\bweiß\s+Jacke\b", "weiße Jacke", t, flags=re.IGNORECASE)
    t = re.sub(r"\bgold\s+Streifen\b", "goldenen Streifen", t, flags=re.IGNORECASE)
    t = re.sub(r"\bweiß\s+Trainingsjacke\b", "weiße Trainingsjacke", t, flags=re.IGNORECASE)

    # hässliche Enden entfernen
    t = re.sub(r"\b(und|mit)\s*\.\s*$", ".", t, flags=re.IGNORECASE)
    t = re.sub(r"\s+\.\s*$", ".", t).strip()

    t = t.strip(" \t\n\r\f\v\"'").strip()
    if t and not t.endswith((".", "!", "?")):
        t += "."
    if t:
        t = t[0].upper() + t[1:]
    return t
