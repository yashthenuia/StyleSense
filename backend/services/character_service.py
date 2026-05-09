"""
Programmatic Custom Character + Knowledge Base creation via Runway REST API.

The official 'create-your-own' guide documents the manual portal flow, but
POST /v1/avatars and POST /v1/documents endpoints exist in the REST surface.
We hit them directly with httpx since they're not in the Python SDK yet.

Reference: https://docs.dev.runwayml.com/api/
If these endpoints reject the request, we fall back to portal instructions
(see avatar router /create-character endpoint).
"""
import os
import httpx
import logging

logger = logging.getLogger(__name__)

API_BASE = "https://api.runwayml.com/v1"
API_VERSION = "2024-11-06"
_API_KEY = os.getenv("RUNWAY_API_KEY") or os.getenv("RUNWAYML_API_SECRET")


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {_API_KEY}",
        "Content-Type": "application/json",
        "X-Runway-Version": API_VERSION,
    }


async def create_character(
    selfie_url: str,
    name: str,
    instructions: str,
    starting_script: str = "Hi! I'm your personal stylist. What would you like to put together today?",
    voice: str | None = None,
) -> dict:
    """
    Create a Custom Character (avatar) programmatically.

    Returns dict with 'id' (the avatar UUID to store) and full Runway response.
    Raises RuntimeError if the API rejects the request, with details for fallback.
    """
    payload = {
        "name": name,
        "image_url": selfie_url,
        "instructions": instructions,
        "starting_script": starting_script,
    }
    if voice:
        payload["voice"] = voice

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(f"{API_BASE}/avatars", headers=_headers(), json=payload)

    if resp.status_code >= 400:
        logger.error(f"Runway create_character failed {resp.status_code}: {resp.text}")
        raise RuntimeError(
            f"Could not create character via API ({resp.status_code}). "
            f"Response: {resp.text[:500]}. "
            "Falling back to manual portal flow may be required."
        )

    data = resp.json()
    return data


async def upload_knowledge_document(content: str, name: str = "wardrobe.txt") -> dict:
    """
    Upload a knowledge document. Returns dict with 'id' (document UUID).
    """
    payload = {
        "name": name,
        "content": content,
        "content_type": "text/plain",
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(f"{API_BASE}/documents", headers=_headers(), json=payload)

    if resp.status_code >= 400:
        logger.error(f"Runway upload_document failed {resp.status_code}: {resp.text}")
        raise RuntimeError(
            f"Could not upload knowledge document ({resp.status_code}). {resp.text[:300]}"
        )
    return resp.json()


async def attach_document_to_character(character_id: str, document_id: str) -> dict:
    """Link a knowledge document to a character so the avatar can reference it."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.patch(
            f"{API_BASE}/avatars/{character_id}",
            headers=_headers(),
            json={"document_ids": [document_id]},
        )
    if resp.status_code >= 400:
        raise RuntimeError(
            f"Could not attach document to character ({resp.status_code}). {resp.text[:300]}"
        )
    return resp.json()


def build_stylist_instructions(user_name: str = "the user") -> str:
    """The system prompt that defines the avatar's stylist persona."""
    return f"""You are a friendly, expert personal stylist for {user_name}. You can see {user_name}'s entire wardrobe — every item, color, brand, and category — in your knowledge base.

Your job:
- Suggest specific outfits using items from {user_name}'s actual wardrobe (reference items by name).
- Give honest, kind opinions on color, fit, and occasion-appropriateness.
- When asked "what should I wear to X", recommend a top + bottom + shoes combo from the wardrobe.
- Keep responses short and conversational (2-3 sentences for the spoken portion).
- If the user wants to try something on, encourage them to use the Studio tab.
- Never invent items that aren't in the wardrobe knowledge base."""


def build_wardrobe_knowledge_text(items: list, user_name: str = "User") -> str:
    """Format the wardrobe items list into a text document for the knowledge base."""
    lines = [
        f"# {user_name}'s Wardrobe",
        f"# Total items: {len(items)}",
        "",
    ]
    by_category: dict[str, list] = {}
    for item in items:
        by_category.setdefault(item.get("category", "uncategorized"), []).append(item)

    for category, group in by_category.items():
        lines.append(f"\n## {category.upper()} ({len(group)} items)")
        for item in group:
            tags = ", ".join(item.get("tags") or [])
            color = item.get("color") or "color unknown"
            brand = item.get("brand") or "brand unknown"
            occasion = item.get("occasion") or "any"
            extra = f" — tags: {tags}" if tags else ""
            lines.append(
                f"- {item['name']} | {color} | {brand} | occasion: {occasion}{extra}"
            )
    return "\n".join(lines)
