from __future__ import annotations

from io import BytesIO
from typing import Union

import requests
from PIL import Image


def load_image(path_or_url: Union[str, bytes], timeout_sec: int = 12) -> Image.Image:
    if isinstance(path_or_url, (bytes, bytearray)):
        return Image.open(BytesIO(path_or_url)).convert("RGB")

    s = (path_or_url or "").strip()
    if s.lower().startswith(("http://", "https://")):
        r = requests.get(s, timeout=timeout_sec)
        r.raise_for_status()
        return Image.open(BytesIO(r.content)).convert("RGB")

    return Image.open(s).convert("RGB")
