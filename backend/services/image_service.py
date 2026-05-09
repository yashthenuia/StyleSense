"""Image validation and helpers."""
import io
from PIL import Image

MAX_BYTES = 16 * 1024 * 1024  # 16MB - matches Runway URL upload limit
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MIN_DIM = 256  # pixels


def validate_image_bytes(data: bytes, content_type: str) -> tuple[int, int]:
    """
    Validate an uploaded image. Returns (width, height) on success.
    Raises ValueError on any problem.
    """
    if len(data) > MAX_BYTES:
        raise ValueError(f"Image too large ({len(data)/1024/1024:.1f}MB). Max 16MB.")
    if content_type not in ALLOWED_MIME:
        raise ValueError(f"Unsupported MIME type: {content_type}. Use JPEG, PNG, or WebP.")
    try:
        img = Image.open(io.BytesIO(data))
        img.verify()  # quick integrity check
    except Exception as e:
        raise ValueError(f"Invalid image file: {e}")

    img = Image.open(io.BytesIO(data))  # re-open after verify
    w, h = img.size
    if w < MIN_DIM or h < MIN_DIM:
        raise ValueError(f"Image too small ({w}x{h}). Min {MIN_DIM}x{MIN_DIM}.")
    return w, h
