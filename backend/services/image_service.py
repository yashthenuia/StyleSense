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


def pad_to_ratio_range(data: bytes, min_ratio: float = 0.5, max_ratio: float = 2.0) -> bytes:
    """
    Runway references require width/height ratio within [0.5, 2.0]. Tall phone
    photos (e.g. 0.46) get rejected. Pad such images with white into range; return
    the original bytes if already valid or on any error (caller still has a usable image).
    """
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
        w, h = img.size
        ratio = w / h
        if min_ratio <= ratio <= max_ratio:
            return data
        if ratio < min_ratio:                       # too tall -> pad width
            new_w, new_h = int(h * min_ratio) + 2, h
            canvas = Image.new("RGB", (new_w, new_h), (255, 255, 255))
            canvas.paste(img, ((new_w - w) // 2, 0))
        else:                                       # too wide -> pad height
            new_w, new_h = w, int(w / max_ratio) + 2
            canvas = Image.new("RGB", (new_w, new_h), (255, 255, 255))
            canvas.paste(img, (0, (new_h - h) // 2))
        out = io.BytesIO()
        canvas.save(out, format="JPEG", quality=92)
        return out.getvalue()
    except Exception:
        return data
