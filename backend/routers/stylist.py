"""Anthropic-powered stylist chat (Aria LangGraph agent)."""
import asyncio
import random
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from models.schemas import StylistChatRequest, StylistChatResponse
from services import supabase_service, anthropic_service, color_service
from services.auth_service import current_user
from graphs import aria_graph

router = APIRouter()
_executor = ThreadPoolExecutor(max_workers=4)


async def _run_blocking(fn, *args, **kwargs):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, lambda: fn(*args, **kwargs))


@router.post("/chat", response_model=StylistChatResponse)
async def chat(req: StylistChatRequest, user = Depends(current_user)):
    if not req.messages:
        raise HTTPException(400, "Need at least one message.")

    wardrobe = supabase_service.get_wardrobe_items(user["id"])
    messages = [m.model_dump() for m in req.messages]

    if req.image_url:
        description = await _run_blocking(anthropic_service.analyze_chat_image, req.image_url)
        if description:
            for i in range(len(messages) - 1, -1, -1):
                if messages[i]["role"] == "user":
                    messages[i] = {
                        "role": "user",
                        "content": f"[Photo context: {description}]\n\n{messages[i]['content']}",
                    }
                    break

    try:
        result = await _run_blocking(
            aria_graph.run_aria,
            user_id=user["id"],
            messages=messages,
            wardrobe=wardrobe,
        )
    except Exception as e:
        raise HTTPException(500, f"Stylist failed: {e}")

    return StylistChatResponse(
        reply=result["reply"],
        suggested_item_ids=result["item_ids"],
        occasion=result.get("occasion"),
        scene=result.get("scene"),
    )


@router.get("/color-profile")
async def get_color_profile(user = Depends(current_user)):
    """Return the user's cached color profile (or null if not analyzed yet)."""
    row = supabase_service.get_user(user["id"]) or {}
    return {"color_profile": row.get("color_profile")}


@router.post("/color-profile")
async def refresh_color_profile(user = Depends(current_user)):
    """Force a fresh color analysis from the user's primary selfie and cache it."""
    row = supabase_service.get_user(user["id"]) or {}
    selfie = color_service.best_profile_source(row)
    if not selfie:
        raise HTTPException(400, "No selfie on file. Upload one in Avatar Setup first.")
    profile = await _run_blocking(color_service.analyze_color_profile, selfie)
    if not profile:
        raise HTTPException(502, "Color analysis failed. Try again.")
    supabase_service.upsert_user(user["id"], color_profile=profile, color_profile_source_selfie=selfie)
    return {"color_profile": profile}


@router.get("/suggestions")
async def auto_suggestions(user = Depends(current_user)):
    wardrobe = supabase_service.get_wardrobe_items(user["id"])
    if not wardrobe:
        return {"suggestions": []}

    prompt = (
        "Suggest 3 outfit combinations from this wardrobe. For each, give a "
        "ONE-LINE name and 2-3 item IDs. Format your reply EXACTLY like:\n"
        "1. Office Polish: id-A, id-B, id-C\n"
        "2. Weekend Casual: id-D, id-E\n"
        "3. Evening Out: id-F, id-G, id-H\n"
        "Use only IDs from the wardrobe. Be brief."
    )
    try:
        reply = anthropic_service.stylist_chat(
            messages=[{"role": "user", "content": prompt}],
            wardrobe_items=wardrobe,
        )
    except Exception as e:
        raise HTTPException(500, f"Suggestions failed: {e}")

    suggestions = []
    for line in reply.splitlines():
        line = line.strip()
        if not line or ":" not in line:
            continue
        try:
            label_part, ids_part = line.split(":", 1)
            label = label_part.split(".", 1)[-1].strip()
            ids = [i.strip() for i in ids_part.split(",") if i.strip()]
            ids = [i for i in ids if any(w["id"] == i for w in wardrobe)]
            if ids:
                suggestions.append({"name": label, "item_ids": ids})
        except ValueError:
            continue

    return {"suggestions": suggestions[:3]}


@router.get("/this-or-that")
async def this_or_that(user = Depends(current_user)):
    wardrobe = supabase_service.get_wardrobe_items(user["id"])
    if len(wardrobe) < 2:
        raise HTTPException(400, "Need at least 2 wardrobe items for This or That.")
    pair = random.sample(wardrobe, 2)
    return {"pair_id": str(uuid.uuid4()), "item_a": pair[0], "item_b": pair[1]}


class ThisOrThatChoice(BaseModel):
    pair_id: str
    item_a_id: str
    item_b_id: str
    chosen_id: str


@router.post("/this-or-that")
async def save_this_or_that(req: ThisOrThatChoice, user = Depends(current_user)):
    if req.chosen_id not in (req.item_a_id, req.item_b_id):
        raise HTTPException(400, "chosen_id must be one of the two item IDs.")
    row = supabase_service.get_user(user["id"]) or {}
    prefs: list = row.get("style_preferences") or []
    prefs.append({
        "pair_id": req.pair_id,
        "a_id": req.item_a_id,
        "b_id": req.item_b_id,
        "chosen_id": req.chosen_id,
        "ts": datetime.now(timezone.utc).isoformat(),
    })
    supabase_service.upsert_user(user["id"], style_preferences=prefs[-100:])
    return {"saved": True, "total_preferences": len(prefs)}
