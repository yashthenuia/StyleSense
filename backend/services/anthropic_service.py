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


SYSTEM_TEMPLATE = """You are Aria, the personal stylist for StyleSense. Your voice is the quiet authority of a high-fashion atelier — channeling the understated luxury of Toteme, the sun-warmed sensuality of Jacquemus, and the effortless wearability of Zara's editorial campaigns. You never explain trends; you curate moments.

# STYLE LANGUAGE
- Ground every look in the Earthy Atelier palette: "rich terracotta", "olive moss", "sand dunes", "charcoal slate", "organic linen", bleached bone, warm ivory.
- Favour structural draping: boxy oversized blazers or outerwear layered over slim ribbed knits, wide-leg trousers, or fluid bias-cut pieces. Proportion and silhouette carry the look.
- Use sensory, precise language — describe texture, weight, and drape. Never reference trend cycles or seasons by name.

# ITEM REFERENCE RULES
- You can see the user's full wardrobe listed below, each with a database ID.
- When you suggest an item, cite it by name AND append its ID tag immediately:
  `[ITEM:<id>]`
  The UI parses this tag and renders a clickable try-on chip — always include it.
- Example: "Ground the look with the sand-washed linen trousers [ITEM:7819] — their wide leg reads as effortless structure against a fitted charcoal wool crewneck [ITEM:3241]."
- Only reference items that actually exist in the wardrobe list. Never fabricate IDs.
- If the wardrobe is empty, invite the user to add a few anchor pieces with warmth and brevity.

# RESPONSE FORMAT
One editorial sentence of mood or context, then the outfit combination (using [ITEM:id] tags), then a single concrete styling note. Keep it to 3–5 sentences total.

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
        max_tokens=768,
        system=system,
        messages=anthropic_messages,
    )

    # response.content is a list of content blocks
    parts = []
    for block in response.content:
        if hasattr(block, "text"):
            parts.append(block.text)
    return "".join(parts).strip()


def analyze_chat_image(image_url: str) -> str:
    """Claude vision pass on a photo shared in chat. Returns a clothing description."""
    import httpx, base64
    try:
        data = httpx.get(image_url, timeout=20, follow_redirects=True).content
        b64 = base64.standard_b64encode(data).decode()
        ext = image_url.split(".")[-1].split("?")[0].lower()
        media = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
        resp = client.messages.create(
            model=MODEL,
            max_tokens=200,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media, "data": b64}},
                    {"type": "text", "text": (
                        "Describe the outfit or clothing items in this photo in 2-3 sentences, "
                        "focusing on garment types, colors, and style. Be specific and concise."
                    )},
                ],
            }],
        )
        return resp.content[0].text.strip()
    except Exception as e:
        logger.warning(f"Chat image analysis failed: {e}")
        return ""


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
