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


def merge_tags_for_two_images(
    tags_image_1: list[Tag],
    tags_image_2: list[Tag],
    max_tags: int,
) -> TagMergeResult:
    normalized_1 = normalize_scored_tags(tags_image_1)
    normalized_2 = normalize_scored_tags(tags_image_2)
    values_1 = [tag.value for tag in normalized_1]
    values_2 = [tag.value for tag in normalized_2]
    intersection_set = set(values_1) & set(values_2)
    intersection_ordered = [value for value in values_1 if value in intersection_set]
    if intersection_ordered:
        score_map_1 = {tag.value: tag.score or 0.0 for tag in normalized_1}
        score_map_2 = {tag.value: tag.score or 0.0 for tag in normalized_2}
        merged_tags = [
            Tag(
                value=value,
                score=max(score_map_1.get(value, 0.0), score_map_2.get(value, 0.0)),
                source="clip",
            )
            for value in intersection_ordered
        ]
        tags_for_llm = normalize_tags(intersection_ordered)[:max_tags]
        return TagMergeResult(
            tags_for_llm=tags_for_llm,
            merged_tags=merged_tags[:max_tags],
            intersection=intersection_ordered,
            strategy="intersection",
            fallback=None,
        )

    avg_score_1 = _average_tag_score(normalized_1)
    avg_score_2 = _average_tag_score(normalized_2)
    if avg_score_2 > avg_score_1:
        selected = normalized_2
        fallback = "image_2_higher_avg_score"
    else:
        selected = normalized_1
        fallback = "image_1_higher_avg_score"
    tags_for_llm = normalize_tags([tag.value for tag in selected])[:max_tags]
    return TagMergeResult(
        tags_for_llm=tags_for_llm,
        merged_tags=selected[:max_tags],
        intersection=[],
        strategy="intersection",
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
