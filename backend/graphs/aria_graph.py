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
    kb_snippets: list
    reply: str
    item_ids: list


SYSTEM_TEMPLATE = """You are Aria, StyleSense's personal stylist for the user. You give specific, warm, honest, concise advice (2-4 sentences plus a short list when suggesting outfits).

# RULES
- Recommend items that exist in the wardrobe by exact name, and tag each as `[ITEM:<id>]` so the UI can make it clickable. Example: "Try the Navy blazer [ITEM:abc-123] with the cream chinos [ITEM:def-456]."
- Use the user's COLOR PROFILE: prefer their flattering colors, steer away from their avoid colors, and say *why* a piece suits them.
- Use the STYLING KNOWLEDGE for color/occasion guidance. Don't quote it verbatim; apply it.
- If the wardrobe is empty, suggest adding items first. If asked something you can't know (e.g. weather), say so.

# USER'S COLOR PROFILE
{color_profile}

# STYLING KNOWLEDGE (reference)
{kb}

# USER'S WARDROBE
{wardrobe}
"""


def _ensure_profile(state: AriaState) -> dict:
    if state.get("color_profile"):
        return {}
    user = supabase_service.get_user(state["user_id"]) or {}
    cached = user.get("color_profile")
    if cached:
        return {"color_profile": cached}
    # Derive from the primary selfie if available
    selfie = user.get("selfie_url")
    if not selfie:
        selfies = user.get("selfie_urls") or []
        selfie = selfies[0] if selfies else None
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
    return {"occasion": style_kb.detect_occasion(_last_user_text(state.get("messages", [])))}


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
    }
