from app.contracts_models import Caption, Tag
from app.services.pipeline.multi_image import captions_per_image, merge_tags_for_images


def test_merge_tags_for_images_uses_intersection():
    tags_image_1 = [
        Tag(value="Red   Shoes", score=0.9, source="clip"),
        Tag(value="Leather", score=0.7, source="clip"),
    ]
    tags_image_2 = [
        Tag(value="red shoes", score=0.6, source="clip"),
        Tag(value="Running", score=0.5, source="clip"),
    ]
    merged = merge_tags_for_images([tags_image_1, tags_image_2], max_tags=5)

    assert merged.strategy == "intersection_all"
    assert merged.fallback is None
    assert merged.intersection == ["red shoes"]
    assert merged.tags_for_llm == ["red shoes"]
    assert merged.merged_tags[0].value == "red shoes"


def test_merge_tags_for_images_fallbacks_to_higher_score_image():
    tags_image_1 = [
        Tag(value="Floral", score=0.9, source="clip"),
        Tag(value="Dress", score=0.8, source="clip"),
    ]
    tags_image_2 = [
        Tag(value="Denim", score=0.3, source="clip"),
        Tag(value="Jacket", score=0.2, source="clip"),
    ]
    merged = merge_tags_for_images([tags_image_1, tags_image_2], max_tags=2)

    assert merged.fallback == "highest_avg_score_image_1"
    assert merged.tags_for_llm == ["floral", "dress"]


def test_captions_per_image_returns_ordered_list():
    captions = [
        Caption(image_index=1, text="Second image caption", source="blip"),
        Caption(image_index=0, text="First image caption", source="blip"),
    ]
    assert captions_per_image(captions, 2) == [
        "First image caption",
        "Second image caption",
    ]
