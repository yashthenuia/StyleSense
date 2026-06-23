"""
Prompt-builder agent (LangGraph) for manifest (try-on) + video generation.

Turns a user's short freeform request ("sunset rooftop", "make it feel editorial")
into a rich, structured Runway prompt:

    interpret -> compose -> refine

- interpret: parse the request into structured intent (setting, time-of-day,
  lighting, mood, composition).
- compose: build a Runway-ready prompt from that intent.
- refine: one critique/refine pass for Runway prompt best-practices.

kind="manifest" returns a `setting` clause to feed the try-on prompt template;
kind="video" returns a motion+scene prompt for image_to_video. On any failure the
caller falls back to the raw user text, so generation never breaks.
"""
import logging
from typing import TypedDict

from langgraph.graph import StateGraph, START, END

from services import anthropic_service

logger = logging.getLogger(__name__)


class PromptState(TypedDict, total=False):
    user_request: str
    kind: str          # "manifest" | "video"
    intent: str
    final_prompt: str


_INTERPRET = (
    "You turn a user's short fashion-shoot request into structured creative direction. "
    "Given the request, output 4-6 concise bullet lines covering: SETTING, TIME OF DAY, "
    "LIGHTING, MOOD, COMPOSITION (and CAMERA MOTION if it's for a video). Be concrete and "
    "cinematic. Output only the bullets."
)

_COMPOSE_MANIFEST = (
    "Using the creative direction below, write ONE vivid setting/scene clause (1-2 sentences) "
    "for an editorial fashion photo. Describe location, lighting, and mood only - do NOT "
    "mention the person, the garment, the face, or camera specs (those are handled elsewhere). "
    "Keep the background clear and in focus - do NOT call for heavy background blur, bokeh, or "
    "shallow depth of field. Output only the clause.\n\nCREATIVE DIRECTION:\n{intent}"
)

_COMPOSE_VIDEO = (
    "Using the creative direction below, write ONE motion prompt (1-2 sentences) for an "
    "image-to-video model. Describe natural subject motion + camera movement + how the scene "
    "lives (breeze, light shifts). Keep the existing outfit/face/background intact. "
    "Output only the prompt.\n\nCREATIVE DIRECTION:\n{intent}"
)

_REFINE = (
    "Improve this {kind} prompt for an AI image/video generator: make it vivid and specific "
    "but concise, remove redundancy, keep it to 1-2 sentences. Output only the improved prompt.\n\n"
    "PROMPT:\n{draft}"
)


def _call(system_or_prompt: str, user: str, max_tokens: int = 300) -> str:
    resp = anthropic_service.client.messages.create(
        model=anthropic_service.MODEL,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": f"{system_or_prompt}\n\n{user}".strip()}],
    )
    return "".join(b.text for b in resp.content if hasattr(b, "text")).strip()


def _interpret(state: PromptState) -> dict:
    return {"intent": _call(_INTERPRET, state.get("user_request", ""))}


def _compose(state: PromptState) -> dict:
    tmpl = _COMPOSE_VIDEO if state.get("kind") == "video" else _COMPOSE_MANIFEST
    return {"final_prompt": _call(tmpl.format(intent=state.get("intent", "")), "")}


def _refine(state: PromptState) -> dict:
    refined = _call(_REFINE.format(kind=state.get("kind", "image"), draft=state.get("final_prompt", "")), "")
    return {"final_prompt": refined or state.get("final_prompt", "")}


def _build():
    g = StateGraph(PromptState)
    g.add_node("interpret", _interpret)
    g.add_node("compose", _compose)
    g.add_node("refine", _refine)
    g.add_edge(START, "interpret")
    g.add_edge("interpret", "compose")
    g.add_edge("compose", "refine")
    g.add_edge("refine", END)
    return g.compile()


_graph = _build()


def build_prompt(user_request: str, kind: str = "manifest") -> str:
    """
    Expand a freeform request into a rich prompt. Returns the original text on
    any failure so callers can use it as a safe fallback.
    """
    if not user_request or not user_request.strip():
        return user_request
    try:
        out = _graph.invoke({"user_request": user_request.strip(), "kind": kind})
        return out.get("final_prompt") or user_request
    except Exception as e:
        logger.warning(f"build_prompt failed ({kind}): {type(e).__name__}: {e}")
        return user_request
