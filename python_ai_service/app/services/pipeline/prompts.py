from __future__ import annotations


COPYWRITER_SYSTEM = """You are an e-commerce copywriter.
Return ONLY valid JSON, no markdown, no extra text.
Language: English.
"""


def build_copy_prompt(
    price_amount: float,
    currency: str,
    tags: list[str],
    captions: list[str],
) -> str:
    return f"""
Create an English product title and a product description for an online shop.

Constraints:
- Output MUST be valid JSON.
- JSON keys: "title", "description".
- Title: product-focused, concise, no quotes.
- Description: 2-4 sentences, concrete, based on tags/captions, no "AI generated", no disclaimers.
- Do NOT mention that you are an AI.
- Do NOT include bullet lists.
- Do NOT include the exact price number.

Inputs:
- price_amount: {price_amount}
- currency: {currency}
- tags: {tags}
- captions: {captions}

Return JSON now.
""".strip()
