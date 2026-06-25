"""
Aria stylist agent (LangGraph).

A small stateful graph that makes the stylist reason like a real one:

    ensure_profile -> detect_occasion -> retrieve_kb -> advise

- ensure_profile: lazily analyzes the user's selfie into a cached color profile.
- detect_occasion: deterministic keyword match from the latest user message.
- retrieve_kb: pulls color + occasion snippets from the curated knowledge base.
- advise: Claude Haiku reply grounded in wardrobe + color profile + KB, keeping
  the [ITEM:<id>] format the UI parses.

Nodes call the existing anthropic client directly (no langchain-anthropic).
"""
import logging
from typing import Optional, TypedDict

from langgraph.graph import StateGraph, START, END

from services import supabase_service, anthropic_service, style_kb, color_service

logger = logging.getLogger(__name__)


class AriaState(TypedDict, total=False):
    user_id: str
    messages: list           # [{role, content}]
    wardrobe: list
    color_profile: Optional[dict]
    occasion: Optional[str]
    scene: Optional[str]
    kb_snippets: list
    reply: str
    item_ids: list


# Maps a detected occasion to a rich try-on background, used when the user clicks
# "Manifest this look" in chat so the generated photo matches the event they asked about.
_OCCASION_SCENE = {
    "beach wedding": "at a beach wedding by the sea at golden hour, soft warm light",
    "formal": "at an elegant black-tie gala in a grand ballroom, refined lighting",
    "wedding guest": "at a stylish wedding reception, soft romantic lighting",
    "office": "in a bright modern office, clean professional setting",
    "office party": "at a stylish office holiday party, warm ambient evening light",
    "interview": "in a modern office lobby for a job interview, crisp daylight",
    "business": "in a sleek corporate setting, polished professional lighting",
    "date": "at an intimate candlelit restaurant on a date night, warm mood lighting",
    "dinner": "at an upscale restaurant in the evening, warm ambient light",
    "cocktail": "at a chic rooftop cocktail party at night, city lights bokeh",
    "evening": "at an elegant evening event, moody dramatic lighting",
    "party": "at a lively party with warm colorful lighting",
    "brunch": "at a sunny garden brunch, bright airy daylight",
    "casual": "on a relaxed city street in soft daylight",
    "weekend": "on a casual weekend outing, natural daylight",
    "gym": "in a modern fitness studio, bright clean light",
    "sport": "in an athletic outdoor setting, bright natural light",
    "beach": "on a sunny beach with soft ocean light",
    "vacation": "on a scenic vacation backdrop, bright golden light",
}


def _scene_for_occasion(occasion: Optional[str], user_text: str) -> Optional[str]:
    """Best-effort try-on background for a detected occasion (None -> Studio default)."""
    if occasion and occasion in _OCCASION_SCENE:
        return _OCCASION_SCENE[occasion]
    t = (user_text or "").lower()
    for key, scene in _OCCASION_SCENE.items():
        if key in t:
            return scene
    return None


SYSTEM_TEMPLATE = """You are Aria, StyleSense's personal stylist for the user. Warm, specific, honest, concise.

# HOW TO RECOMMEND
- START FROM THE OCCASION and its dress code, then build a COMPLETE outfit appropriate to it
  (top + bottom, or a dress, plus a layer / shoes / one accessory when relevant) - not a single item.
- VARY BY OCCASION: a formal event, a beach day and a casual brunch must get clearly DIFFERENT outfits.
  Never default to the same hero piece for every occasion. If one item genuinely works for several
  occasions, style it DIFFERENTLY each time and say how (layers, tuck, shoes, accessories).
- Recommend real wardrobe items by exact name, tagging each `[ITEM:<id>]` so the UI makes it clickable.
- The STYLE PROFILE is a REFINEMENT, not the selector: among the occasion-appropriate pieces, prefer
  ones in their flattering colors and silhouettes for their body type; briefly say why.
- GAPS: if the wardrobe can't cover the occasion, recommend the specific garment TYPES to add
  (e.g. "a tailored navy blazer") with one reason each - while still tagging items that DO work.
- If body type is "unknown", give solid general advice and gently suggest adding a full-body photo in
  Avatar Setup. If the wardrobe is empty, name the key pieces to add. If you can't know something
  (e.g. weather), say so.

# FORMAT (render as Markdown)
- One short intro line, then a bulleted outfit list (ONE piece per bullet), then ONE short styling tip.
- Use **bold** only for the key pieces. Keep the whole reply under ~120 words.

# USER'S STYLE PROFILE
{color_profile}

# STYLING KNOWLEDGE (reference, research-grounded)
{kb}

# USER'S WARDROBE (each item shows category + occasion - match them to the asked occasion)
{wardrobe}
"""


def _ensure_profile(state: AriaState) -> dict:
    if state.get("color_profile"):
        return {}
    user = supabase_service.get_user(state["user_id"]) or {}
    cached = user.get("color_profile")
    if cached:
        return {"color_profile": cached}
    # Derive from the best available photo (full-body preferred, else selfie)
    selfie = color_service.best_profile_source(user)
    if not selfie:
        return {}
    profile = color_service.analyze_color_profile(selfie)
    if profile:
        try:
            supabase_service.upsert_user(
                state["user_id"], color_profile=profile, color_profile_source_selfie=selfie
            )
        except Exception as e:
            logger.warning(f"Could not cache color profile: {e}")
        return {"color_profile": profile}
    return {}


def _last_user_text(messages: list) -> str:
    for m in reversed(messages or []):
        if m.get("role") == "user":
            return m.get("content", "") or ""
    return ""


def _detect_occasion(state: AriaState) -> dict:
    text = _last_user_text(state.get("messages", []))
    occasion = style_kb.detect_occasion(text)
    return {"occasion": occasion, "scene": _scene_for_occasion(occasion, text)}


def _retrieve_kb(state: AriaState) -> dict:
    snippets = style_kb.retrieve(
        query=_last_user_text(state.get("messages", [])),
        color_profile=state.get("color_profile"),
        occasion=state.get("occasion"),
    )
    return {"kb_snippets": snippets}


def _advise(state: AriaState) -> dict:
    system = SYSTEM_TEMPLATE.format(
        color_profile=color_service.format_color_profile(state.get("color_profile")),
        kb="\n".join(f"- {s}" for s in state.get("kb_snippets", [])) or "(none)",
        wardrobe=anthropic_service._format_wardrobe(state.get("wardrobe", [])),
    )
    msgs = [
        {"role": m["role"], "content": m["content"]}
        for m in state.get("messages", [])
        if m.get("role") in ("user", "assistant")
    ]
    if not msgs or msgs[-1]["role"] != "user":
        raise ValueError("Last message must be from the user.")

    resp = anthropic_service.client.messages.create(
        model=anthropic_service.MODEL,
        max_tokens=512,
        temperature=0.7,  # a little variety so occasions don't collapse to one outfit
        system=system,
        messages=msgs,
    )
    reply = "".join(b.text for b in resp.content if hasattr(b, "text")).strip()
    return {"reply": reply, "item_ids": anthropic_service.extract_item_ids(reply)}


def _build():
    g = StateGraph(AriaState)
    g.add_node("ensure_profile", _ensure_profile)
    g.add_node("detect_occasion", _detect_occasion)
    g.add_node("retrieve_kb", _retrieve_kb)
    g.add_node("advise", _advise)
    g.add_edge(START, "ensure_profile")
    g.add_edge("ensure_profile", "detect_occasion")
    g.add_edge("detect_occasion", "retrieve_kb")
    g.add_edge("retrieve_kb", "advise")
    g.add_edge("advise", END)
    return g.compile()


_graph = _build()


def run_aria(user_id: str, messages: list, wardrobe: list) -> dict:
    """Invoke the Aria graph. Returns {reply, item_ids, color_profile, occasion}."""
    out = _graph.invoke({"user_id": user_id, "messages": messages, "wardrobe": wardrobe})
    return {
        "reply": out.get("reply", ""),
        "item_ids": out.get("item_ids", []),
        "color_profile": out.get("color_profile"),
        "occasion": out.get("occasion"),
        "scene": out.get("scene"),
    }
