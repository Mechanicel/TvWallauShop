from __future__ import annotations

from io import BytesIO
import ipaddress
import logging
import socket
from typing import Iterable, Union
from urllib.parse import urlparse

import requests
from PIL import Image

from app.config import get_settings

settings = get_settings()
logger = logging.getLogger("tvwallau-ai.caption.image_loader")


def _iter_host_ips(host: str) -> Iterable[ipaddress.ip_address]:
    if not host:
        return []

    try:
        return [ipaddress.ip_address(host)]
    except ValueError:
        pass

    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror as e:
        raise ValueError(f"Hostname konnte nicht aufgelöst werden: {host}") from e

    ips = []
    for info in infos:
        ip_str = info[4][0]
        try:
            ips.append(ipaddress.ip_address(ip_str))
        except ValueError:
            continue
    return ips


def _is_private_or_local(ip: ipaddress.ip_address) -> bool:
    return any(
        (
            ip.is_private,
            ip.is_loopback,
            ip.is_link_local,
            ip.is_reserved,
            ip.is_multicast,
            ip.is_unspecified,
        )
    )


def _validate_remote_url(url: str) -> None:
    parsed = urlparse(url)
    if parsed.scheme not in {s.strip().lower() for s in settings.CAPTION_ALLOWED_SCHEMES.split(",") if s.strip()}:
        raise ValueError(f"Nicht erlaubtes URL-Schema: {parsed.scheme}")

    if not parsed.hostname:
        raise ValueError("Ungültige URL: Hostname fehlt.")

    if not settings.CAPTION_ALLOW_PRIVATE_NETWORKS:
        for ip in _iter_host_ips(parsed.hostname):
            if _is_private_or_local(ip):
                raise ValueError(f"Private/Local Adresse nicht erlaubt: {ip}")


def _fetch_image_bytes(url: str, timeout_sec: int) -> bytes:
    headers = {"User-Agent": settings.CAPTION_HTTP_USER_AGENT}
    max_bytes = max(1024, int(settings.CAPTION_MAX_IMAGE_BYTES))

    response = requests.get(url, timeout=timeout_sec, stream=True, headers=headers)
    response.raise_for_status()

    content_length = response.headers.get("Content-Length")
    if content_length and int(content_length) > max_bytes:
        raise ValueError(f"Bild zu groß ({content_length} bytes), Limit={max_bytes} bytes")

    chunks = []
    total = 0
    for chunk in response.iter_content(chunk_size=64 * 1024):
        if not chunk:
            continue
        total += len(chunk)
        if total > max_bytes:
            raise ValueError(f"Bild zu groß (>{max_bytes} bytes)")
        chunks.append(chunk)

    if settings.DEBUG:
        logger.debug("image_loader: downloaded %s bytes from %s", total, url)

    return b"".join(chunks)


def load_image(path_or_url: Union[str, bytes], timeout_sec: int = 12) -> Image.Image:
    if isinstance(path_or_url, (bytes, bytearray)):
        Image.MAX_IMAGE_PIXELS = int(settings.CAPTION_MAX_IMAGE_PIXELS)
        return Image.open(BytesIO(path_or_url)).convert("RGB")

    s = (path_or_url or "").strip()
    if s.lower().startswith(("http://", "https://")):
        _validate_remote_url(s)
        image_bytes = _fetch_image_bytes(s, timeout_sec=timeout_sec)
        Image.MAX_IMAGE_PIXELS = int(settings.CAPTION_MAX_IMAGE_PIXELS)
        return Image.open(BytesIO(image_bytes)).convert("RGB")

    if not settings.CAPTION_ALLOW_LOCAL_FILES:
        raise ValueError("Lokale Dateipfade sind deaktiviert (CAPTION_ALLOW_LOCAL_FILES=0).")

    Image.MAX_IMAGE_PIXELS = int(settings.CAPTION_MAX_IMAGE_PIXELS)
    return Image.open(s).convert("RGB")
