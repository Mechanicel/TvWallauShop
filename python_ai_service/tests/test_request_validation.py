import pytest
from pydantic import ValidationError

from app.contracts_models import AnalyzeProductRequest, ImageRef, Money


def test_request_requires_images():
    with pytest.raises(ValidationError):
        AnalyzeProductRequest(price=Money(amount=12.0), images=[])


def test_request_requires_positive_price():
    with pytest.raises(ValidationError):
        AnalyzeProductRequest(
            price=Money(amount=0),
            images=[ImageRef(kind="path", value="image.jpg")],
        )
