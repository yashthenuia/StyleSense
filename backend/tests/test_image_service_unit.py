"""
Unit tests for image_service.validate_image_bytes.

These are pure unit tests -- no network, no Supabase, no Runway credits.
Run with: .\\venv\\Scripts\\python.exe -m pytest tests/test_image_service_unit.py -v
"""
import io
import sys
import struct
from pathlib import Path

import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.image_service import validate_image_bytes


# ── fixtures ───────────────────────────────────────────────────────────────── #

def _make_jpeg(width: int = 400, height: int = 600, quality: int = 85) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color=(210, 190, 160)).save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


def _make_png(width: int = 400, height: int = 600) -> bytes:
    buf = io.BytesIO()
    Image.new("RGBA", (width, height), color=(210, 190, 160, 255)).save(buf, format="PNG")
    return buf.getvalue()


def _make_webp(width: int = 400, height: int = 600) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color=(210, 190, 160)).save(buf, format="WEBP")
    return buf.getvalue()


# ── happy-path tests ───────────────────────────────────────────────────────── #

@pytest.mark.parametrize("make_fn,content_type", [
    (_make_jpeg, "image/jpeg"),
    (_make_png,  "image/png"),
    (_make_webp, "image/webp"),
])
def test_valid_image_passes(make_fn, content_type):
    validate_image_bytes(make_fn(), content_type)


def test_valid_jpeg_large_dimensions():
    validate_image_bytes(_make_jpeg(2048, 2048), "image/jpeg")


def test_returns_dimensions():
    w, h = validate_image_bytes(_make_jpeg(400, 600), "image/jpeg")
    assert w == 400
    assert h == 600


# ── rejection tests ────────────────────────────────────────────────────────── #

def test_empty_bytes_raises():
    with pytest.raises(ValueError):
        validate_image_bytes(b"", "image/jpeg")


def test_random_bytes_raises():
    with pytest.raises(ValueError):
        validate_image_bytes(b"\x00\x01\x02\x03" * 100, "image/jpeg")


def test_text_file_raises():
    with pytest.raises(ValueError):
        validate_image_bytes(b"Hello, world!", "image/jpeg")


def test_truncated_jpeg_raises():
    raw = _make_jpeg()
    with pytest.raises(ValueError):
        validate_image_bytes(raw[:50], "image/jpeg")


@pytest.mark.parametrize("mime", ["image/gif", "image/bmp", "application/octet-stream", "text/plain"])
def test_unsupported_mime_raises(mime):
    with pytest.raises(ValueError, match="Unsupported MIME type"):
        validate_image_bytes(_make_jpeg(), mime)


@pytest.mark.parametrize("width,height", [(255, 600), (600, 255), (100, 100)])
def test_image_too_small_raises(width, height):
    with pytest.raises(ValueError, match="too small"):
        validate_image_bytes(_make_jpeg(width, height), "image/jpeg")


def test_image_exactly_min_dimension_passes():
    validate_image_bytes(_make_jpeg(256, 256), "image/jpeg")


def test_image_too_large_raises():
    oversized = b"\xff\xd8" + b"\x00" * (17 * 1024 * 1024)
    with pytest.raises(ValueError, match="too large"):
        validate_image_bytes(oversized, "image/jpeg")
