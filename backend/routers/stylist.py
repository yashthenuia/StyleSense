"""Anthropic-powered stylist chat."""
from fastapi import APIRouter, HTTPException, Depends

from models.schemas import StylistChatRequest, StylistChatResponse
from services import supabase_service, anthropic_service
from services.auth_service import current_user

router = APIRouter()


@router.post("/chat", response_model=StylistChatResponse)
async def chat(req: StylistChatRequest, user = Depends(current_user)):
    if not req.messages:
        raise HTTPException(400, "Need at least one message.")

    wardrobe = supabase_service.get_wardrobe_items(user["id"])

    try:
        reply = anthropic_service.stylist_chat(
            messages=[m.model_dump() for m in req.messages],
            wardrobe_items=wardrobe,
        )
    except Exception as e:
        raise HTTPException(500, f"Stylist failed: {e}")

    suggested_ids = anthropic_service.extract_item_ids(reply)
    return StylistChatResponse(reply=reply, suggested_item_ids=suggested_ids)


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
