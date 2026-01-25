from __future__ import annotations

import json


COPYWRITER_SYSTEM = """You are an e-commerce copywriter.
Return ONLY valid JSON, no markdown, no extra text.
Language: English.
Use ONLY the product_facts provided by the user. Do not speculate.
If brand_candidate is present, do not mention other brands.
"""


def build_copy_prompt(
    price_amount: float,
    currency: str,
    product_facts: dict[str, object],
) -> str:
    facts_json = json.dumps(product_facts, ensure_ascii=False, sort_keys=True)
    return f"""
Create an English product title and a product description for an online shop.

Constraints:
- Output MUST be valid JSON.
- JSON keys: "title", "description".
- Title: product-focused, concise, no quotes.
- Description: 2-4 sentences, concrete, based only on product_facts, no "AI generated", no disclaimers.
- Do NOT mention that you are an AI.
- Do NOT include bullet lists.
- Do NOT include the exact price number.

Inputs:
- price_amount: {price_amount}
- currency: {currency}
- product_facts: {facts_json}

Return JSON now.
""".strip()
