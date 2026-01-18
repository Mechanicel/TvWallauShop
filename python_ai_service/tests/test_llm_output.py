import pytest

from app.services.pipeline.llm_openvino_genai import parse_llm_json


def test_parse_llm_json_valid():
    result = (
        '{"title":"Premium Athletic Crew Socks with Cushioned Comfort Fit Everyday",'
        '"description":"Soft knit crew socks with a sporty look. '
        'Designed for daily wear and easy styling."}'
    )
    title, description = parse_llm_json(result)
    assert "Socks" in title
    assert description.endswith(".")


def test_parse_llm_json_invalid_json():
    with pytest.raises(ValueError):
        parse_llm_json("not-json")


def test_parse_llm_json_invalid_length():
    result = '{"title":"Too short","description":"One sentence."}'
    with pytest.raises(ValueError):
        parse_llm_json(result)
