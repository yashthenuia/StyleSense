"""
Programmatic Custom Character (avatar) creation via Runway REST API.

Discovered schema (verified by API probing 2026-05-10):
  POST https://api.dev.runwayml.com/v1/avatars
  body: {
    "name":          string,
    "referenceImage": string (public HTTPS URL of selfie),
    "personality":   string (system prompt for the stylist),
    "voice":         { "type": "custom", "id": <voice_id> }
  }

Voice creation (one-time, see tests/setup_default_voice.py):
  POST /v1/voices  body: { "name": ..., "from": { "type": "audio", "audio": <wav URL> } }

Knowledge documents:
  POST /v1/documents -> returns { id }
  PATCH /v1/avatars/{id} with { document_ids: [...] } to attach
"""
import os
import httpx
import logging

logger = logging.getLogger(__name__)

API_BASE = "https://api.dev.runwayml.com/v1"
API_VERSION = "2024-11-06"
_API_KEY = os.getenv("RUNWAY_API_KEY") or os.getenv("RUNWAYML_API_SECRET")
_DEFAULT_VOICE_ID = os.getenv("RUNWAY_DEFAULT_VOICE_ID")


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
    voice_id: str | None = None,
) -> dict:
    """
    Create a Custom Character (avatar) programmatically.

    Args:
        selfie_url: public HTTPS URL of the user's selfie (Supabase Storage works)
        name: display name for the character
        instructions: system prompt that defines the stylist persona
        starting_script: not used by current API but kept for future
        voice_id: Runway voice ID. If None, uses RUNWAY_DEFAULT_VOICE_ID env var.

    Returns dict with 'id' (the avatar UUID to store) plus full Runway response.
    Raises RuntimeError on API rejection with details for fallback.
    """
    voice = voice_id or _DEFAULT_VOICE_ID
    if not voice:
        raise RuntimeError(
            "No voice configured. Run `python -m tests.setup_default_voice` once "
            "to create a shared voice, then add RUNWAY_DEFAULT_VOICE_ID to backend/.env."
        )

    payload = {
        "name": name,
        "referenceImage": selfie_url,
        "personality": instructions,
        "voice": {"type": "custom", "id": voice},
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(f"{API_BASE}/avatars", headers=_headers(), json=payload)

    if resp.status_code >= 400:
        logger.error(f"Runway create_character failed {resp.status_code}: {resp.text}")
        raise RuntimeError(
            f"Could not create character ({resp.status_code}): {resp.text[:500]}"
        )

    return resp.json()


async def upload_knowledge_document(content: str, name: str = "wardrobe.txt") -> dict:
    """Upload a knowledge document. Returns dict with 'id'."""
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


async def update_character_personality(character_id: str, personality: str) -> dict:
    """
    Replace the personality (system prompt) on an existing avatar. The
    realtime voice agent reads this on every reply, so this is the load-bearing
    way to inject up-to-date wardrobe context for the shared admin stylist.

    For the shared stylist setup this is destructive (replaces persona for
    every concurrent caller). Hackathon-acceptable, single-laptop scope.
    """
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.patch(
            f"{API_BASE}/avatars/{character_id}",
            headers=_headers(),
            json={"personality": personality},
        )
    if resp.status_code >= 400:
        raise RuntimeError(f"Could not update personality ({resp.status_code}): {resp.text[:300]}")
    return resp.json()


async def update_character_voice(character_id: str, voice_id: str | None = None) -> dict:
    """
    Swap the voice on an existing avatar without recreating it.
    voice_id defaults to RUNWAY_DEFAULT_VOICE_ID env var.
    """
    voice = voice_id or _DEFAULT_VOICE_ID
    if not voice:
        raise RuntimeError("No voice configured. Set RUNWAY_DEFAULT_VOICE_ID in backend/.env.")

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.patch(
            f"{API_BASE}/avatars/{character_id}",
            headers=_headers(),
            json={"voice": {"type": "custom", "id": voice}},
        )
    if resp.status_code >= 400:
        raise RuntimeError(f"Could not update voice ({resp.status_code}): {resp.text[:300]}")
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
    return (
        f"You are a friendly, expert personal stylist for {user_name}. You can see "
        f"{user_name}'s entire wardrobe in your knowledge base. "
        f"Suggest specific outfits using items from {user_name}'s actual wardrobe (reference items by name). "
        f"Give honest opinions on color, fit, and occasion. Keep replies short and conversational "
        f"(2-3 sentences for the spoken portion). If the user wants to try something on, "
        f"encourage them to use the Studio tab. Never invent items that aren't in the wardrobe."
    )


def build_dynamic_persona(user_name: str, items: list, max_items: int = 40) -> str:
    """
    PATCH-time personality string for the shared admin stylist (Aria).

    Embeds the calling user's wardrobe directly in the persona so the realtime
    voice agent can name specific items and reference them by ID. Capped at
    max_items to stay under any reasonable Runway personality length limit;
    when over, drops accessories first, then shoes, then outerwear, keeping
    tops/bottoms/dresses (the highest-signal categories for outfit picks).
    """
    name = user_name.strip() or "the user"

    # Drop priority (lowest first) when capping
    drop_order = ["accessories", "shoes", "outerwear", "tops", "bottoms", "dresses"]
    if len(items) > max_items:
        items = sorted(items, key=lambda it: drop_order.index(it.get("category") or "tops") if (it.get("category") or "tops") in drop_order else 0, reverse=True)
        items = items[:max_items]

    if items:
        lines = []
        for it in items:
            iid = it.get("id") or "?"
            iname = it.get("name") or "(unnamed)"
            cat = it.get("category") or "tops"
            color = it.get("color") or "?"
            lines.append(f"- ID:{iid} | {iname} | {cat} | {color}")
        wardrobe_block = "\n".join(lines)
    else:
        wardrobe_block = "(empty - the user has not added any clothes yet)"

    return f"""You are Aria, {name}'s personal stylist for the StyleSense app. You can SEE their entire wardrobe (listed below) and you make specific outfit recommendations from it.

# HARD RULES
1. NEVER invent items. ONLY reference clothes that appear in the wardrobe list below by their EXACT name.
2. After you mention an item by name, append its ID in this exact format: [ITEM:<id>]
   Example: "Try the Navy linen blazer [ITEM:abc-123-def] over the cream chinos [ITEM:ghi-456-jkl]."
3. Keep voice replies SHORT and conversational - 2 to 3 spoken sentences plus a list when suggesting an outfit. The user is hearing you, not reading.
4. If the wardrobe is empty, tell the user they need to add items first - do NOT make up clothes.
5. Be warm, confident, and specific. Honest opinions on color, fit, occasion welcome.

# {name.upper()}'S WARDROBE ({len(items)} items)
{wardrobe_block}

# EXAMPLES
User: "What should I wear to a brunch tomorrow?"
You: "For a relaxed brunch I'd pair the Cream linen shirt [ITEM:xxx] with the Tan chinos [ITEM:yyy] and finish with the White leather sneakers [ITEM:zzz] - light, easy, and put-together."

User: "Help me pick a top to go with these black jeans."
You: "The Striped knit polo [ITEM:xxx] keeps it cool and contrast-y. Or if you want sharper, the Charcoal merino crewneck [ITEM:yyy] with the jeans is a clean monochrome look."
"""


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
            extra = f" - tags: {tags}" if tags else ""
            lines.append(
                f"- {item['name']} | {color} | {brand} | occasion: {occasion}{extra}"
            )
    return "\n".join(lines)
