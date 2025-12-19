from __future__ import annotations

from ..config import get_settings

settings = get_settings()


def _quality_word(price: float) -> str:
    # Preis beeinflusst die Tonalität – aber wir nennen die Zahl NICHT.
    if price >= 80:
        return "hochwertiges" if settings.TAG_LANG == "de" else "premium"
    if price >= 30:
        return "solides" if settings.TAG_LANG == "de" else "solid"
    return "preiswertes" if settings.TAG_LANG == "de" else "budget"


def generate_description(tags: list[str], price: float) -> str:
    q = _quality_word(price)

    if settings.TAG_LANG == "de":
        if not tags:
            return f"{q.capitalize()} Produkt. (KI generiert)"
        # Kurz + shop-tauglich
        core = ", ".join(tags[:6])
        return f"{q.capitalize()} Produkt mit Fokus auf: {core}. (KI generiert)"
    else:
        if not tags:
            return f"{q.capitalize()} product. (AI generated)"
        core = ", ".join(tags[:6])
        return f"{q.capitalize()} product featuring: {core}. (AI generated)"
