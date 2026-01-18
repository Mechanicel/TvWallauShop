from app.services.pipeline.normalize import normalize_tags


def test_normalize_tags_dedupes_and_lowercases():
    tags = ["Sneakers", " sneakers ", "BLUE", "blue", ""]
    assert normalize_tags(tags) == ["sneakers", "blue"]
