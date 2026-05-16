"""
Multi-item wardrobe detection via Claude vision.

Given a single user-uploaded photo (flat-lay, closet shelf, person wearing
an outfit, etc.), ask claude-haiku-4-5 to enumerate every distinct clothing
item visible. Returns a list of {name, category, color, brand?, occasion?,
position?} dicts that the wardrobe router uses to drive per-item Runway
isolation + DB inserts.

Single Claude call. ~$0.01 per detection. Cap at 6 items so the downstream
Runway spend stays bounded (~12cr worst case).
"""
import base64
import json
import logging
import re
from typing import Optional

import httpx

from services.anthropic_service import client, MODEL

logger = logging.getLogger(__name__)

VALID_CATEGORIES = {"tops", "bottoms", "dresses", "outerwear", "shoes", "accessories"}
VALID_OCCASIONS = {"casual", "formal", "evening", "sport", "beach", "any"}

DETECTION_PROMPT = """Look at this photograph and list every distinct clothing item or accessory visible. This may be a flat-lay product shot, a closet shelf, or a person wearing an outfit.

Return ONLY a JSON object of this exact shape (no prose, no markdown fences):

{
  "items": [
    {
      "name": "short descriptive name (e.g. 'White cotton t-shirt')",
      "category": "tops" | "bottoms" | "dresses" | "outerwear" | "shoes" | "accessories",
      "color": "primary color (e.g. 'white', 'navy', 'beige')",
      "brand": null | "brand name if a logo is visible",
      "occasion": "casual" | "formal" | "evening" | "sport" | "beach",
      "position": "short hint describing WHERE in the image, e.g. 'top left', 'center bottom', 'on the model's torso' - this helps the next step isolate it"
    }
  ]
}

Rules:
- Include up to 6 items maximum, in roughly the order someone would assemble the outfit (tops, then bottoms, then outerwear, then shoes, then accessories).
- Skip background, furniture, walls, hangers, mannequin parts.
- If you only see ONE item, return one item.
- If the photo contains no clothing at all, return {"items": []}.
- Be specific in the name - 'White cotton t-shirt' not just 'shirt'.
- The position hint will be passed verbatim to a downstream image generator, so make it precise."""


def _encode_image(image_bytes: bytes, content_type: str = "image/jpeg") -> dict:
    """Build the Anthropic image content block from raw bytes."""
    media_type = content_type if content_type in ("image/jpeg", "image/png", "image/webp", "image/gif") else "image/jpeg"
    return {
        "type": "image",
        "source": {
            "type": "base64",
            "media_type": media_type,
            "data": base64.standard_b64encode(image_bytes).decode("ascii"),
        },
    }


def _strip_json(text: str) -> str:
    """Claude sometimes wraps JSON in ```json fences despite instructions. Strip them."""
    text = text.strip()
    if text.startswith("```"):
        # Remove leading fence (with optional language tag)
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def _normalize(item: dict) -> Optional[dict]:
    """Coerce a raw model output into the shape we'll actually use. Returns None if unsalvageable."""
    name = (item.get("name") or "").strip()
    category = (item.get("category") or "").strip().lower()
    if not name or category not in VALID_CATEGORIES:
        return None
    occasion = (item.get("occasion") or "casual").strip().lower()
    if occasion not in VALID_OCCASIONS:
        occasion = "casual"
    color = item.get("color")
    if isinstance(color, str):
        color = color.strip() or None
    brand = item.get("brand")
    if isinstance(brand, str):
        brand = brand.strip() or None
    position = item.get("position")
    if isinstance(position, str):
        position = position.strip() or None
    return {
        "name": name[:80],
        "category": category,
        "color": color,
        "brand": brand,
        "occasion": occasion,
        "position": position,
    }


async def detect_items_from_url(image_url: str) -> list[dict]:
    """Download a public image URL then call detect_items_from_bytes."""
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as c:
        r = await c.get(image_url)
        r.raise_for_status()
        ctype = r.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        return detect_items_from_bytes(r.content, ctype)


def detect_items_from_bytes(image_bytes: bytes, content_type: str = "image/jpeg") -> list[dict]:
    """
    Call Claude vision once. Returns a list of normalized item dicts
    (see _normalize). On any failure returns []. Caller decides what to do.
    """
    try:
        resp = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": [
                        _encode_image(image_bytes, content_type),
                        {"type": "text", "text": DETECTION_PROMPT},
                    ],
                }
            ],
        )
    except Exception as e:
        logger.warning(f"Claude vision call failed: {type(e).__name__}: {e}")
        return []

    text = "".join(b.text for b in resp.content if hasattr(b, "text"))
    raw = _strip_json(text)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning(f"Claude vision returned non-JSON: {raw[:200]}")
        return []

    items = data.get("items") if isinstance(data, dict) else None
    if not isinstance(items, list):
        return []

    out: list[dict] = []
    for item in items[:6]:
        if isinstance(item, dict):
            norm = _normalize(item)
            if norm:
                out.append(norm)
    return out
