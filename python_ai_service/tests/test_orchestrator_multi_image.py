from PIL import Image

from app.contracts_models import AnalyzeProductRequest, ImageRef, Money, Tag, Caption
from app.services.pipeline.image_loader import ImageAsset
from app.services.pipeline import orchestrator


class DummyTagger:
    def __init__(self, device: str) -> None:
        self.call_count = 0

    def predict(self, images, max_tags, debug=None, include_prompt=False):
        self.call_count += 1
        index = self.call_count
        return [
            Tag(value="Common", score=0.9 - index * 0.01, source="clip"),
            Tag(value=f"Unique {index}", score=0.5, source="clip"),
        ]


class DummyCaptioner:
    def __init__(self, device: str) -> None:
        self.device = device

    def generate(self, images, max_captions, debug=None):
        return [
            Caption(image_index=index, text=f"caption {index}", source="blip")
            for index, _ in enumerate(images)
        ]


class DummyLlmCopywriter:
    def __init__(self, device: str, debug=None) -> None:
        self.device = device
        self.calls = []

    def generate(
        self,
        price_amount,
        currency,
        tags,
        captions,
        product_facts,
        debug=None,
        include_prompt=False,
        allow_debug_failure=False,
    ):
        self.calls.append(
            {"tags": tags, "captions": captions, "product_facts": product_facts}
        )
        return "Short", "First sentence. Second sentence."


def test_run_pipeline_multi_image_intersection_and_captions(monkeypatch):
    images = [Image.new("RGB", (1, 1), color="white") for _ in range(5)]
    assets = [
        ImageAsset(image=image, index=index, source="base64")
        for index, image in enumerate(images)
    ]

    dummy_llm = DummyLlmCopywriter("GPU")

    monkeypatch.setattr(orchestrator, "load_images", lambda _: assets)
    monkeypatch.setattr(orchestrator, "ensure_models", lambda **_: None)
    monkeypatch.setattr(orchestrator, "ClipTagger", DummyTagger)
    monkeypatch.setattr(orchestrator, "Captioner", DummyCaptioner)
    monkeypatch.setattr(
        orchestrator, "get_llm_copywriter", lambda *args, **kwargs: dummy_llm
    )

    payload = AnalyzeProductRequest(
        price=Money(amount=10.0, currency="USD"),
        images=[ImageRef(kind="base64", value="AA==") for _ in range(5)],
    )

    response = orchestrator.run_pipeline(payload)

    assert response.title == "Short"
    assert dummy_llm.calls[0]["captions"] == [
        "caption 0",
        "caption 1",
        "caption 2",
        "caption 3",
        "caption 4",
    ]
    assert dummy_llm.calls[0]["tags"] == ["common"]
    assert response.tags[0].value == "common"
