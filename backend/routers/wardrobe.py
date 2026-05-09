"""Wardrobe CRUD: upload items, list, delete, and add-from-URL.

Garment cleaning:
    Direct uploads default to clean='auto' (Runway if credits, else rembg).
    URL-based items default to clean='none' (retailer images are usually already clean).
    Both can be overridden via the `clean` query/form parameter.
"""
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import Optional, Literal
from services import supabase_service
from services.auth_service import current_user
from services.image_service import validate_image_bytes
from services.garment_cleaner import clean_garment_bytes
from models.schemas import AddWardrobeFromUrl

router = APIRouter()
CleanPref = Literal["auto", "runway", "rembg", "none"]


@router.get("")
async def list_items(
    category: Optional[str] = None,
    occasion: Optional[str] = None,
    user = Depends(current_user),
):
    return supabase_service.get_wardrobe_items(user["id"], category, occasion)


@router.post("/upload")
async def upload_item(
    file: UploadFile = File(...),
    name: str = Form(...),
    category: str = Form(...),
    occasion: str = Form("casual"),
    color: Optional[str] = Form(None),
    brand: Optional[str] = Form(None),
    clean: CleanPref = Form("runway"),
    user = Depends(current_user),
):
    """Upload a clothing photo from disk and save to wardrobe.

    Default: clean='runway' - re-synthesizes the garment as a clean studio shot
    using Runway gen4_image_turbo (~3 credits per upload).

    Other clean options:
      - 'auto'  - Runway first, rembg fallback if Runway fails
      - 'rembg' - local cutout only (limited - cannot fix occluded photos)
      - 'none'  - skip cleaning, save original photo as-is
    """
    content = await file.read()
    try:
        validate_image_bytes(content, file.content_type or "")
    except ValueError as e:
        raise HTTPException(400, str(e))

    # Step 1: upload original first so Runway can fetch it via HTTPS (needed for the prompt)
    try:
        original_url = supabase_service.upload_to_storage(
            bucket="wardrobe",
            user_id=user["id"],
            file_bytes=content,
            filename=file.filename or "item.jpg",
            content_type=file.content_type or "image/jpeg",
        )
    except Exception as e:
        raise HTTPException(500, f"Upload failed: {e}")

    # Step 2: optionally clean (default on)
    final_url = original_url
    method_used = "skipped"
    if clean != "none":
        cleaned_bytes, method_used = clean_garment_bytes(
            image_bytes=content,
            item_name=name,
            item_category=category,
            item_image_url=original_url,
            prefer=clean,
        )
        if method_used in ("runway", "rembg"):
            try:
                final_url = supabase_service.upload_to_storage(
                    bucket="wardrobe",
                    user_id=user["id"],
                    file_bytes=cleaned_bytes,
                    filename=f"clean-{file.filename or 'item.jpg'}",
                    content_type="image/jpeg",
                )
            except Exception as e:
                # Cleaning succeeded but storage upload failed - keep original
                final_url = original_url
                method_used = f"original (clean upload failed: {e})"

    item = supabase_service.insert_wardrobe_item(
        user_id=user["id"],
        name=name,
        category=category,
        image_url=final_url,
        occasion=occasion,
        color=color,
        brand=brand,
    )
    item["clean_method"] = method_used
    item["original_url"] = original_url if final_url != original_url else None
    return item


@router.post("/from-url")
async def add_from_url(req: AddWardrobeFromUrl, user = Depends(current_user)):
    """Add item by re-hosting a remote image URL into our Supabase Storage.

    Cleaning is OFF by default for URL items because retailer images (Amazon, Uniqlo,
    etc.) are usually already clean product shots. Pass clean='auto' on the request
    body to force cleaning if the source image is messy.
    """
    try:
        original_url = supabase_service.upload_url_to_storage(
            bucket="wardrobe",
            user_id=user["id"],
            source_url=req.image_url,
        )
    except Exception as e:
        raise HTTPException(400, f"Could not download image from URL: {e}")

    final_url = original_url
    method_used = "skipped"
    clean_pref = (req.clean or "none")  # default OFF for URL-based
    if clean_pref != "none":
        try:
            import httpx
            with httpx.Client(timeout=20.0, follow_redirects=True) as c:
                r = c.get(original_url)
                r.raise_for_status()
            cleaned_bytes, method_used = clean_garment_bytes(
                image_bytes=r.content,
                item_name=req.name,
                item_category=req.category,
                item_image_url=original_url,
                prefer=clean_pref,
            )
            if method_used in ("runway", "rembg"):
                final_url = supabase_service.upload_to_storage(
                    bucket="wardrobe",
                    user_id=user["id"],
                    file_bytes=cleaned_bytes,
                    filename="clean.jpg",
                    content_type="image/jpeg",
                )
        except Exception as e:
            final_url = original_url
            method_used = f"original (clean failed: {e})"

    item = supabase_service.insert_wardrobe_item(
        user_id=user["id"],
        name=req.name,
        category=req.category,
        image_url=final_url,
        occasion=req.occasion or "casual",
        color=req.color,
        brand=req.brand,
        source_url=req.source_url or req.image_url,
        tags=req.tags,
    )
    item["clean_method"] = method_used
    item["original_url"] = original_url if final_url != original_url else None
    return item


@router.delete("/{item_id}")
async def delete_item(item_id: str, user = Depends(current_user)):
    # RLS would block the delete anyway, but verify ownership defensively
    item = supabase_service.get_wardrobe_item(item_id)
    if not item:
        raise HTTPException(404, "Not found")
    if item["user_id"] != user["id"]:
        raise HTTPException(403, "Not your item")
    supabase_service.delete_wardrobe_item(item_id)
    return {"deleted": True}
