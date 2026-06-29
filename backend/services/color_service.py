"""
Color profile analysis - Claude vision on the user's selfie.

Derives the user's skin undertone, seasonal color type, contrast level, and a
short list of flattering / avoid colors. Run once per selfie and cached on
users.color_profile (JSONB) so the Aria agent can reason about it cheaply on
every chat turn without re-analyzing the image.
"""
import base64
import json
import logging
import re
from typing import Optional

import httpx

from services.anthropic_service import client, MODEL

logger = logging.getLogger(__name__)

COLOR_PROMPT = """Analyze the person in this photo for personal styling (color analysis + body-aware fashion advice).

Reply with ONLY a JSON object of this exact shape (no prose, no markdown fences):
{
  "undertone": "warm" | "cool" | "neutral",
  "season": "spring" | "summer" | "autumn" | "winter",
  "contrast": "low" | "medium" | "high",
  "flattering_colors": ["6-10 specific colors that suit them"],
  "avoid_colors": ["3-6 colors that wash them out or clash"],
  "body_type": "rectangle" | "hourglass" | "pear" | "inverted_triangle" | "apple" | "unknown",
  "face_shape": "oval" | "round" | "square" | "heart" | "oblong" | "diamond" | "unknown",
  "hair": "short phrase: length, color, texture (e.g. 'short black curly')",
  "photo_scope": "face" | "upper_body" | "full_body",
  "notes": "one short sentence of styling guidance for their coloring + body"
}

Base coloring on visible skin undertone, hair, and eye color. Judge body_type ONLY if the
torso/full body is visible; if only the face/head is visible, set body_type and face guidance
to "unknown" and photo_scope to "face". If lighting is poor, make your best reasonable
estimate. Return ONLY the JSON."""

VALID_UNDERTONE = {"warm", "cool", "neutral"}
VALID_SEASON = {"spring", "summer", "autumn", "winter"}
VALID_CONTRAST = {"low", "medium", "high"}
VALID_BODY = {"rectangle", "hourglass", "pear", "inverted_triangle", "apple", "unknown"}
VALID_FACE = {"oval", "round", "square", "heart", "oblong", "diamond", "unknown"}
VALID_SCOPE = {"face", "upper_body", "full_body"}


def _strip_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def _normalize(data: dict) -> dict:
    undertone = str(data.get("undertone", "")).strip().lower()
    season = str(data.get("season", "")).strip().lower()
    contrast = str(data.get("contrast", "")).strip().lower()
    body = str(data.get("body_type", "")).strip().lower().replace(" ", "_").replace("-", "_")
    face = str(data.get("face_shape", "")).strip().lower()
    scope = str(data.get("photo_scope", "")).strip().lower().replace(" ", "_").replace("-", "_")
    return {
        "undertone": undertone if undertone in VALID_UNDERTONE else "neutral",
        "season": season if season in VALID_SEASON else "",
        "contrast": contrast if contrast in VALID_CONTRAST else "medium",
        "flattering_colors": [str(c).strip() for c in (data.get("flattering_colors") or [])][:10],
        "avoid_colors": [str(c).strip() for c in (data.get("avoid_colors") or [])][:6],
        "body_type": body if body in VALID_BODY else "unknown",
        "face_shape": face if face in VALID_FACE else "unknown",
        "hair": str(data.get("hair", "")).strip()[:80],
        "photo_scope": scope if scope in VALID_SCOPE else "face",
        "notes": str(data.get("notes", "")).strip()[:300],
    }


def analyze_color_profile(selfie_url: str) -> Optional[dict]:
    """
    Download the selfie, run one Claude-vision call, and return a normalized
    color profile dict. Returns None on any failure (caller keeps whatever was
    cached, or proceeds without a profile).
    """
    try:
        with httpx.Client(timeout=20.0, follow_redirects=True) as c:
            r = c.get(selfie_url)
            r.raise_for_status()
        content_type = r.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        media_type = content_type if content_type in ("image/jpeg", "image/png", "image/webp", "image/gif") else "image/jpeg"

        resp = client.messages.create(
            model=MODEL,
            max_tokens=400,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type,
                                                  "data": base64.standard_b64encode(r.content).decode("ascii")}},
                    {"type": "text", "text": COLOR_PROMPT},
                ],
            }],
        )
        text = "".join(b.text for b in resp.content if hasattr(b, "text"))
        data = json.loads(_strip_json(text))
        return _normalize(data)
    except Exception as e:
        logger.warning(f"analyze_color_profile failed: {type(e).__name__}: {e}")
        return None


def _primary_selfie(user_row: dict) -> Optional[str]:
    return user_row.get("avatar_selfie_url") or (user_row.get("selfie_urls") or [None])[0]


def best_profile_source(user_row: dict) -> Optional[str]:
    """Pick the best photo to analyze: the full-body photo (covers color + body + hair)
    if present, else the primary face selfie. Used by every profile-analysis caller."""
    if not user_row:
        return None
    return user_row.get("full_body_url") or _primary_selfie(user_row)


def best_face_source(user_row: dict) -> Optional[str]:
    """Best photo for FACE/identity (try-on): the face selfie, else the full-body photo
    (which still contains a face). None if the user has uploaded neither."""
    if not user_row:
        return None
    return _primary_selfie(user_row) or user_row.get("full_body_url")


def best_body_source(user_row: dict) -> Optional[str]:
    """Best photo for BODY/proportions (avatar, optional try-on ref): the full-body photo,
    else the face selfie. None if neither exists."""
    if not user_row:
        return None
    return user_row.get("full_body_url") or _primary_selfie(user_row)


def format_color_profile(profile: Optional[dict]) -> str:
    """Render a profile into a compact line for an LLM system prompt."""
    if not profile:
        return "(no color profile yet)"
    flattering = ", ".join(profile.get("flattering_colors") or []) or "?"
    avoid = ", ".join(profile.get("avoid_colors") or []) or "?"
    body = profile.get("body_type") or "unknown"
    face = profile.get("face_shape") or "unknown"
    hair = profile.get("hair") or "?"
    return (
        f"Undertone: {profile.get('undertone', '?')}; "
        f"Season: {profile.get('season') or '?'}; "
        f"Contrast: {profile.get('contrast', '?')}. "
        f"Flattering colors: {flattering}. Avoid: {avoid}. "
        f"Body type: {body}; Face shape: {face}; Hair: {hair}. "
        f"{profile.get('notes', '')}"
    ).strip()
