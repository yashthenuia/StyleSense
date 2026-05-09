"""Anthropic-powered text stylist - reliable fallback / complement to the Runway avatar.

Uses claude-haiku-4-5-20251001 (the fast, cheap Haiku 4.5) so chat is snappy.
The stylist is given the user's full wardrobe as context and can recommend
specific items by ID.
"""
import os
import json
import logging
from anthropic import Anthropic

logger = logging.getLogger(__name__)

_API_KEY = os.getenv("ANTHROPIC_API_KEY")
if not _API_KEY:
    raise RuntimeError("Missing ANTHROPIC_API_KEY in backend/.env")

client = Anthropic(api_key=_API_KEY)
MODEL = "claude-haiku-4-5-20251001"


SYSTEM_TEMPLATE = """You are StyleAI's personal stylist for the user. You can see their full wardrobe (provided below) and you give specific, actionable outfit recommendations.

# RULES
- Always recommend items that exist in the wardrobe by their exact name and ID.
- Format any item suggestion as `[ITEM:<id>]` after mentioning it (the UI parses this and lets the user click to try it on).
  Example: "Try the Navy linen blazer [ITEM:abc-123] with the cream chinos [ITEM:def-456]."
- Be warm, honest, and concise. Aim for 2-4 sentences plus a list when suggesting outfits.
- If asked something you don't know (e.g. weather), say so politely.
- If the wardrobe is empty, suggest the user adds items first.

# USER'S WARDROBE
{wardrobe}
"""


def _format_wardrobe(items: list) -> str:
    if not items:
        return "(empty - user has no wardrobe items yet)"
    lines = []
    for it in items:
        tags = ", ".join(it.get("tags") or [])
        line = f"- ID:{it['id']} | {it['name']} | {it.get('category')} | {it.get('color') or '?'} | {it.get('occasion') or 'any'}"
        if tags:
            line += f" | tags: {tags}"
        if it.get("brand"):
            line += f" | brand: {it['brand']}"
        lines.append(line)
    return "\n".join(lines)


def stylist_chat(messages: list, wardrobe_items: list) -> str:
    """
    Send a chat turn to the stylist and get a reply.

    Args:
        messages: list of {role, content} dicts
        wardrobe_items: full wardrobe (ID + metadata) for context

    Returns the assistant's reply text.
    """
    system = SYSTEM_TEMPLATE.format(wardrobe=_format_wardrobe(wardrobe_items))

    # Convert our schema to Anthropic format
    anthropic_messages = [
        {"role": m["role"], "content": m["content"]}
        for m in messages
        if m["role"] in ("user", "assistant")
    ]
    if not anthropic_messages or anthropic_messages[-1]["role"] != "user":
        raise ValueError("Last message must be from the user.")

    response = client.messages.create(
        model=MODEL,
        max_tokens=512,
        system=system,
        messages=anthropic_messages,
    )

    # response.content is a list of content blocks
    parts = []
    for block in response.content:
        if hasattr(block, "text"):
            parts.append(block.text)
    return "".join(parts).strip()


def extract_item_ids(reply_text: str) -> list:
    """Pull out [ITEM:<id>] mentions from a stylist reply."""
    import re
    return re.findall(r"\[ITEM:([a-zA-Z0-9\-]+)\]", reply_text)


def suggest_category_from_url(page_title: str) -> str | None:
    """Quick LLM call to guess category from a scraped product title."""
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=20,
            system="You categorize clothing items. Reply with EXACTLY ONE of: tops, bottoms, dresses, outerwear, shoes, accessories. Nothing else.",
            messages=[{"role": "user", "content": f"Category for: {page_title}"}],
        )
        text = response.content[0].text.strip().lower()
        if text in ("tops", "bottoms", "dresses", "outerwear", "shoes", "accessories"):
            return text
    except Exception as e:
        logger.warning(f"Category suggestion failed: {e}")
    return None
