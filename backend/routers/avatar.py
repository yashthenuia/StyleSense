"""Avatar/character setup: selfie upload + Runway character creation + knowledge sync."""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import Optional

from models.schemas import CreateCharacterRequest, SyncKnowledgeRequest
from services import supabase_service, character_service
from services.auth_service import current_user
from services.image_service import validate_image_bytes

router = APIRouter()


@router.post("/upload-selfie")
async def upload_selfie(file: UploadFile = File(...), user = Depends(current_user)):
    content = await file.read()
    try:
        validate_image_bytes(content, file.content_type or "")
    except ValueError as e:
        raise HTTPException(400, str(e))

    public_url = supabase_service.upload_to_storage(
        bucket="selfies",
        user_id=user["id"],
        file_bytes=content,
        filename=file.filename or "selfie.jpg",
        content_type=file.content_type or "image/jpeg",
    )
    supabase_service.upsert_user(user["id"], avatar_selfie_url=public_url, email=user["email"])
    return {"selfie_url": public_url}


@router.post("/create-character")
async def create_character(req: CreateCharacterRequest, user = Depends(current_user)):
    instructions = character_service.build_stylist_instructions(req.name)
    try:
        result = await character_service.create_character(
            selfie_url=req.selfie_url,
            name=req.name,
            instructions=instructions,
            voice=req.voice,
        )
    except RuntimeError as e:
        raise HTTPException(
            status_code=501,
            detail={
                "message": str(e),
                "fallback": (
                    "Programmatic creation failed. Go to https://dev.runwayml.com → Characters → "
                    "Create Character. Upload your selfie, paste the instructions shown, "
                    "then call POST /api/avatar/save-character-id with the resulting UUID."
                ),
                "instructions_text": instructions,
            },
        )

    character_id = result.get("id") or result.get("avatarId")
    supabase_service.upsert_user(user["id"], avatar_character_id=character_id, email=user["email"])
    return {"character_id": character_id, "raw": result}


@router.post("/save-character-id")
async def save_character_id(
    character_id: str = Form(...),
    voice_id: Optional[str] = Form(None),
    user = Depends(current_user),
):
    fields = {"avatar_character_id": character_id, "email": user["email"]}
    if voice_id:
        fields["avatar_voice_id"] = voice_id
    supabase_service.upsert_user(user["id"], **fields)
    return {"saved": True}


@router.post("/sync-wardrobe-knowledge")
async def sync_wardrobe_knowledge(_req: SyncKnowledgeRequest = None, user = Depends(current_user)):
    user_row = supabase_service.get_user(user["id"])
    if not user_row:
        # Auto-create on the fly
        supabase_service.upsert_user(user["id"], email=user["email"])
        user_row = supabase_service.get_user(user["id"])

    items = supabase_service.get_wardrobe_items(user["id"])
    if not items:
        raise HTTPException(400, "Wardrobe is empty - add items first.")

    knowledge_text = character_service.build_wardrobe_knowledge_text(
        items, user_name=user_row.get("full_name") or "User"
    )

    if not user_row.get("avatar_character_id"):
        return {
            "wardrobe_text": knowledge_text,
            "item_count": len(items),
            "uploaded": False,
            "reason": "No character_id on user yet.",
        }

    try:
        doc = await character_service.upload_knowledge_document(
            content=knowledge_text, name=f"wardrobe-{user['id']}.txt"
        )
        doc_id = doc.get("id")
        await character_service.attach_document_to_character(
            user_row["avatar_character_id"], doc_id
        )
        supabase_service.upsert_user(user["id"], avatar_document_id=doc_id, email=user["email"])
        return {
            "wardrobe_text": knowledge_text,
            "item_count": len(items),
            "uploaded": True,
            "document_id": doc_id,
        }
    except RuntimeError as e:
        return {
            "wardrobe_text": knowledge_text,
            "item_count": len(items),
            "uploaded": False,
            "reason": str(e),
        }


@router.get("/me")
async def get_avatar_state(user = Depends(current_user)):
    """Return cached avatar fields for the current user."""
    row = supabase_service.get_user(user["id"]) or {}
    return {
        "selfie_url": row.get("avatar_selfie_url"),
        "character_id": row.get("avatar_character_id"),
    }
