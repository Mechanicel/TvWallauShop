from app.services.pipeline.normalize import normalize_tags


def test_normalize_tags_dedupes_and_lowercases():
    tags = ["Sneakers", " sneakers ", "BLUE", "blue", "", "Red   Shoes"]
    assert normalize_tags(tags) == ["sneakers", "blue", "red shoes"]
