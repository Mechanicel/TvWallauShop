from __future__ import annotations

from dataclasses import dataclass

from ...contracts_models import Caption, Tag
from .normalize import normalize_tags


@dataclass(frozen=True)
class TagMergeResult:
    tags_for_llm: list[str]
    merged_tags: list[Tag]
    intersection: list[str]
    strategy: str
    fallback: str | None


def normalize_tag_value(value: str) -> str:
    return " ".join(value.strip().lower().split())


def normalize_scored_tags(tags: list[Tag]) -> list[Tag]:
    deduped: dict[str, Tag] = {}
    order: list[str] = []
    for tag in tags:
        normalized_value = normalize_tag_value(tag.value)
        if not normalized_value:
            continue
        if normalized_value not in deduped:
            deduped[normalized_value] = Tag(
                value=normalized_value,
                score=tag.score,
                source=tag.source,
            )
            order.append(normalized_value)
            continue
        existing = deduped[normalized_value]
        existing_score = existing.score or 0.0
        incoming_score = tag.score or 0.0
        if incoming_score > existing_score:
            deduped[normalized_value] = Tag(
                value=normalized_value,
                score=tag.score,
                source=tag.source,
            )
    return [deduped[value] for value in order]


def _average_tag_score(tags: list[Tag]) -> float:
    scores = [tag.score for tag in tags if tag.score is not None]
    if not scores:
        return 0.0
    return sum(scores) / len(scores)


def merge_tags_for_images(
    tags_per_image: list[list[Tag]],
    max_tags: int,
) -> TagMergeResult:
    if not tags_per_image:
        return TagMergeResult(
            tags_for_llm=[],
            merged_tags=[],
            intersection=[],
            strategy="intersection_all",
            fallback=None,
        )

    normalized_per_image = [
        normalize_scored_tags(tags) for tags in tags_per_image
    ]
    values_per_image = [
        [tag.value for tag in normalized_tags]
        for normalized_tags in normalized_per_image
    ]
    intersection_set = set(values_per_image[0])
    for values in values_per_image[1:]:
        intersection_set &= set(values)
    intersection_ordered = [
        value for value in values_per_image[0] if value in intersection_set
    ]
    if intersection_ordered:
        score_map: dict[str, float] = {}
        for normalized_tags in normalized_per_image:
            for tag in normalized_tags:
                score = tag.score or 0.0
                if score > score_map.get(tag.value, 0.0):
                    score_map[tag.value] = score
        merged_tags = [
            Tag(
                value=value,
                score=score_map.get(value, 0.0),
                source="clip",
            )
            for value in intersection_ordered
        ]
        tags_for_llm = normalize_tags(intersection_ordered)[:max_tags]
        return TagMergeResult(
            tags_for_llm=tags_for_llm,
            merged_tags=merged_tags[:max_tags],
            intersection=intersection_ordered,
            strategy="intersection_all",
            fallback=None,
        )

    avg_scores = [
        _average_tag_score(tags) for tags in normalized_per_image
    ]
    selected_index = max(range(len(avg_scores)), key=lambda idx: avg_scores[idx])
    selected = normalized_per_image[selected_index]
    fallback = f"highest_avg_score_image_{selected_index + 1}"
    tags_for_llm = normalize_tags([tag.value for tag in selected])[:max_tags]
    return TagMergeResult(
        tags_for_llm=tags_for_llm,
        merged_tags=selected[:max_tags],
        intersection=[],
        strategy="intersection_all",
        fallback=fallback,
    )


def captions_per_image(
    captions: list[Caption],
    image_count: int,
) -> list[str]:
    results: list[str] = []
    for index in range(image_count):
        text = ""
        for caption in captions:
            if caption.image_index == index:
                text = caption.text
                break
        results.append(text)
    return results
