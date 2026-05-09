"""All Supabase calls (DB + Storage)."""
import os
import uuid
import logging
from typing import Optional
from supabase import create_client, Client

logger = logging.getLogger(__name__)

_url = os.getenv("SUPABASE_URL")
_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
if not _url or not _key:
    raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env")

supabase: Client = create_client(_url, _key)

DEMO_USER_ID = os.getenv("DEMO_USER_ID", "00000000-0000-0000-0000-000000000001")


# ───────────────────────────── STORAGE ───────────────────────────── #

def upload_to_storage(
    bucket: str,
    user_id: str,
    file_bytes: bytes,
    filename: str,
    content_type: str,
) -> str:
    """
    Upload bytes to a public bucket. Returns the public HTTPS URL Runway can fetch.

    Args:
        bucket: 'wardrobe' | 'selfies' | 'tryons'
        user_id: scopes the path
        file_bytes: raw bytes
        filename: original filename (used to derive extension)
        content_type: MIME type (image/jpeg, image/png, image/webp)
    """
    ext = filename.split(".")[-1].lower() if "." in filename else "jpg"
    if ext == "jpeg":
        ext = "jpg"
    if ext not in ("jpg", "png", "webp"):
        raise ValueError(f"Unsupported file extension: {ext}. Use jpg, png, or webp.")

    storage_path = f"{user_id}/{uuid.uuid4()}.{ext}"

    supabase.storage.from_(bucket).upload(
        path=storage_path,
        file=file_bytes,
        file_options={
            "content-type": content_type,
            "cache-control": "3600",
            "upsert": "false",
        },
    )

    public_url = supabase.storage.from_(bucket).get_public_url(storage_path)
    # Supabase sometimes returns a trailing ?, strip it
    return public_url.rstrip("?")


def upload_url_to_storage(
    bucket: str,
    user_id: str,
    source_url: str,
) -> str:
    """
    Download an external image URL (e.g. scraped Amazon image) and re-host it
    in our Supabase Storage so Runway can fetch it (some retailers block bots).
    """
    import httpx
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
    }
    with httpx.Client(follow_redirects=True, timeout=20.0, headers=headers) as client:
        resp = client.get(source_url)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        if content_type not in ("image/jpeg", "image/png", "image/webp"):
            # Default to jpeg if header is wrong - Pillow check happens elsewhere
            content_type = "image/jpeg"

        # Derive a sensible filename
        filename = source_url.split("/")[-1].split("?")[0] or "scraped.jpg"
        return upload_to_storage(bucket, user_id, resp.content, filename, content_type)


# ───────────────────────────── WARDROBE ───────────────────────────── #

def insert_wardrobe_item(
    user_id: str,
    name: str,
    category: str,
    image_url: str,
    occasion: str = "casual",
    color: Optional[str] = None,
    brand: Optional[str] = None,
    source_url: Optional[str] = None,
    tags: Optional[list] = None,
) -> dict:
    res = supabase.table("wardrobe_items").insert({
        "user_id": user_id,
        "name": name,
        "category": category,
        "occasion": occasion,
        "color": color,
        "brand": brand,
        "image_url": image_url,
        "source_url": source_url,
        "tags": tags or [],
    }).execute()
    return res.data[0]


def get_wardrobe_items(user_id: str, category: Optional[str] = None, occasion: Optional[str] = None) -> list:
    q = supabase.table("wardrobe_items").select("*").eq("user_id", user_id)
    if category:
        q = q.eq("category", category)
    if occasion:
        q = q.eq("occasion", occasion)
    res = q.order("created_at", desc=True).execute()
    return res.data


def get_wardrobe_item(item_id: str) -> Optional[dict]:
    res = supabase.table("wardrobe_items").select("*").eq("id", item_id).execute()
    return res.data[0] if res.data else None


def delete_wardrobe_item(item_id: str) -> None:
    supabase.table("wardrobe_items").delete().eq("id", item_id).execute()


# ───────────────────────────── USERS / AVATAR ───────────────────────────── #

def upsert_user(user_id: str, **fields) -> dict:
    res = supabase.table("users").upsert({"id": user_id, **fields}).execute()
    return res.data[0]


def get_user(user_id: str) -> Optional[dict]:
    res = supabase.table("users").select("*").eq("id", user_id).execute()
    return res.data[0] if res.data else None


# ───────────────────────────── TRY-ON RESULTS ───────────────────────────── #

def save_tryon_result(
    user_id: str,
    item_id: Optional[str],
    result_url: str,
    model_used: str,
    prompt_used: str,
    runway_task_id: str,
) -> dict:
    res = supabase.table("try_on_results").insert({
        "user_id": user_id,
        "wardrobe_item_id": item_id,
        "result_image_url": result_url,
        "prompt_used": prompt_used,
        "model_used": model_used,
        "runway_task_id": runway_task_id,
        "status": "done",
    }).execute()
    return res.data[0]


def update_tryon_event_scene(tryon_id: str, event_url: str, event_context: str) -> dict:
    res = supabase.table("try_on_results").update({
        "event_scene_url": event_url,
        "event_context": event_context,
    }).eq("id", tryon_id).execute()
    return res.data[0] if res.data else {}


def update_tryon_video(tryon_id: str, video_url: str, task_id: str) -> dict:
    res = supabase.table("try_on_results").update({
        "result_video_url": video_url,
        "runway_video_task_id": task_id,
    }).eq("id", tryon_id).execute()
    return res.data[0] if res.data else {}


def get_recent_tryons(user_id: str, limit: int = 12) -> list:
    res = (
        supabase.table("try_on_results")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data


# ───────────────────────────── OUTFITS ───────────────────────────── #

def save_outfit(user_id: str, name: str, item_ids: list, occasion: Optional[str], preview_image_url: Optional[str], notes: Optional[str]) -> dict:
    res = supabase.table("outfits").insert({
        "user_id": user_id,
        "name": name,
        "item_ids": item_ids,
        "occasion": occasion,
        "preview_image_url": preview_image_url,
        "notes": notes,
    }).execute()
    return res.data[0]


def get_outfits(user_id: str) -> list:
    res = supabase.table("outfits").select("*").eq("user_id", user_id).order("created_at", desc=True).execute()
    return res.data
