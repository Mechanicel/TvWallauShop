from __future__ import annotations

import re
from collections import Counter, defaultdict
from dataclasses import dataclass

from ...contracts_models import Caption, Tag, TagStat
from .normalize import normalize_tags


@dataclass(frozen=True)
class TagMergeResult:
    tags_for_llm: list[str]
    merged_tags: list[Tag]
    intersection: list[str]
    strategy: str
    fallback: str | None


@dataclass(frozen=True)
class TagStats:
    count: int
    mean_score: float
    max_score: float
    frequency: float


@dataclass(frozen=True)
class TagSetResult:
    tags_strict: list[str]
    tags_soft: list[str]
    tag_stats: dict[str, TagStats]


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


def _compute_tag_stats(
    normalized_per_image: list[list[Tag]],
) -> dict[str, TagStats]:
    image_count = len(normalized_per_image)
    if image_count == 0:
        return {}
    score_totals: dict[str, float] = defaultdict(float)
    max_scores: dict[str, float] = defaultdict(float)
    counts: dict[str, int] = defaultdict(int)
    for normalized_tags in normalized_per_image:
        for tag in normalized_tags:
            counts[tag.value] += 1
            score = tag.score or 0.0
            score_totals[tag.value] += score
            if score > max_scores[tag.value]:
                max_scores[tag.value] = score

    tag_stats: dict[str, TagStats] = {}
    for tag, count in counts.items():
        mean_score = score_totals[tag] / count if count else 0.0
        frequency = count / image_count if image_count else 0.0
        tag_stats[tag] = TagStats(
            count=count,
            mean_score=mean_score,
            max_score=max_scores.get(tag, 0.0),
            frequency=frequency,
        )
    return tag_stats


def build_tag_stats(tags_per_image: list[list[Tag]]) -> dict[str, TagStats]:
    normalized_per_image = [
        normalize_scored_tags(tags) for tags in tags_per_image
    ]
    return _compute_tag_stats(normalized_per_image)


def build_tag_stat_models(
    tag_stats: dict[str, TagStats],
) -> list[TagStat]:
    return [
        TagStat(
            tag=tag,
            count=stats.count,
            mean_score=stats.mean_score,
            max_score=stats.max_score,
            frequency=stats.frequency,
        )
        for tag, stats in sorted(
            tag_stats.items(),
            key=lambda item: (-item[1].frequency, -item[1].mean_score, item[0]),
        )
    ]


def build_tag_sets(
    tags_per_image: list[list[Tag]],
    min_shared_ratio: float,
    max_soft_tags: int,
) -> TagSetResult:
    image_count = len(tags_per_image)
    if image_count == 0:
        return TagSetResult(tags_strict=[], tags_soft=[], tag_stats={})

    min_shared_ratio = min(max(min_shared_ratio, 0.0), 1.0)
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
    tags_strict = [
        value for value in values_per_image[0] if value in intersection_set
    ]

    tag_stats = _compute_tag_stats(normalized_per_image)

    shared_tags = [
        tag
        for tag, stats in tag_stats.items()
        if stats.frequency >= min_shared_ratio
    ]
    sorted_shared = sorted(
        shared_tags,
        key=lambda tag: (
            -tag_stats[tag].frequency,
            -tag_stats[tag].mean_score,
            tag,
        ),
    )
    max_soft_tags = max(0, max_soft_tags)
    tags_soft = sorted_shared[:max_soft_tags] if max_soft_tags else []

    return TagSetResult(
        tags_strict=normalize_tags(tags_strict),
        tags_soft=normalize_tags(tags_soft),
        tag_stats=tag_stats,
    )


def clean_caption_text(
    text: str,
    max_chars: int,
    repetition_threshold: int,
) -> str:
    if not text:
        return ""
    cleaned = re.sub(r"[\\/|]{4,}", " ", text)
    tokens = cleaned.split()
    deduped: list[str] = []
    last_token = ""
    last_token_normalized = ""
    repeat_count = 0
    token_histogram: Counter[str] = Counter()
    for token in tokens:
        normalized_token = token.lower()
        token_histogram[normalized_token] += 1
        if normalized_token == last_token_normalized:
            repeat_count += 1
        else:
            repeat_count = 1
            last_token = token
            last_token_normalized = normalized_token
        if repeat_count > repetition_threshold:
            continue
        deduped.append(token)
    if deduped:
        most_common_token, count = token_histogram.most_common(1)[0]
        if count / max(1, len(tokens)) >= 0.8 and count > repetition_threshold:
            deduped = [most_common_token]
    cleaned = " ".join(deduped).strip()
    if len(cleaned) > max_chars:
        cleaned = cleaned[:max_chars].rstrip()
    return cleaned


def build_caption_consensus(
    captions: list[str],
    max_items: int = 8,
) -> list[str]:
    stopwords = {
        "a",
        "an",
        "and",
        "are",
        "as",
        "at",
        "be",
        "by",
        "for",
        "from",
        "in",
        "is",
        "it",
        "its",
        "of",
        "on",
        "or",
        "that",
        "the",
        "this",
        "to",
        "with",
    }
    unigram_counts = Counter()
    for caption in captions:
        tokens = [
            token
            for token in re.findall(r"[a-z0-9]+", caption.lower())
            if token and token not in stopwords
        ]
        if not tokens:
            continue
        unigram_counts.update(tokens)
    if not unigram_counts:
        return []
    ranked = sorted(
        unigram_counts.items(),
        key=lambda item: (-item[1], item[0]),
    )
    return [item[0] for item in ranked[:max_items]]


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
