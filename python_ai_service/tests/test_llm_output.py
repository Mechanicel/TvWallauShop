import pytest

from app.contracts_models import LlmDebug
from app.services.pipeline.llm_openvino_genai import parse_llm_json, parse_llm_output


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


def test_parse_llm_json_short_title_allowed():
    result = (
        '{"title":"Short title","description":"First sentence. Second sentence."}'
    )
    title, description = parse_llm_json(result)
    assert title == "Short title"
    assert description.endswith(".")


def test_parse_llm_output_debug_fallback_on_invalid_json():
    debug = LlmDebug()
    title, description = parse_llm_output("not-json", debug, allow_debug_failure=True)
    assert title == ""
    assert description == ""
    assert debug.raw_text_chars == len("not-json")
    assert debug.json_parse_error == "No JSON object found."


def test_parse_llm_output_uses_first_json_object():
    debug = LlmDebug()
    raw = (
        "```json\n"
        '{"title":"Premium Athletic Crew Socks with Cushioned Comfort Fit Everyday",'
        '"description":"Soft knit crew socks with a sporty look. '
        'Designed for daily wear and easy styling."}'
        " trailing\n```"
        '{"title":"Second","description":"Not used. Second sentence."}'
    )
    title, description = parse_llm_output(raw, debug, allow_debug_failure=False)
    assert "Socks" in title
    assert description.endswith(".")


def test_parse_llm_output_keeps_short_title():
    debug = LlmDebug()
    raw = (
        '{"title":"Short title","description":"First sentence. Second sentence."}'
    )
    title, description = parse_llm_output(raw, debug, allow_debug_failure=False)
    assert title == "Short title"
    assert description.endswith(".")
    assert debug.title_length_warning is None
