from __future__ import annotations


def normalize_tags(tags: list[str]) -> list[str]:
    seen: set[str] = set()
    normalized: list[str] = []
    for tag in tags:
        value = " ".join(tag.strip().lower().split())
        if not value or value in seen:
            continue
        seen.add(value)
        normalized.append(value)
    return normalized
