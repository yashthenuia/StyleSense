"""Saved outfits CRUD."""
from fastapi import APIRouter, Depends
from models.schemas import SaveOutfit
from services import supabase_service
from services.auth_service import current_user

router = APIRouter()


@router.get("")
async def list_outfits(user = Depends(current_user)):
    return supabase_service.get_outfits(user["id"])


@router.post("/save")
async def save_outfit(req: SaveOutfit, user = Depends(current_user)):
    return supabase_service.save_outfit(
        user_id=user["id"],
        name=req.name,
        item_ids=req.item_ids,
        occasion=req.occasion,
        preview_image_url=req.preview_image_url,
        notes=req.notes,
    )
