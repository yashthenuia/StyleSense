"""Try-on, event scene, and animation endpoints."""
import os
from fastapi import APIRouter, HTTPException, Depends
from concurrent.futures import ThreadPoolExecutor
import asyncio

from models.schemas import TryOnRequest, MultiItemTryOnRequest, EventSceneRequest, AnimateRequest
from services import runway_service, supabase_service
from services.auth_service import current_user

router = APIRouter()
_executor = ThreadPoolExecutor(max_workers=4)

# Optional identity-reinforcement pass after a try-on. Off by default (adds ~5cr +
# ~30s per generation). Enable with FACE_RESTORE=1 in the backend env.
FACE_RESTORE = os.getenv("FACE_RESTORE", "0") == "1"


async def _run_blocking(fn, *args, **kwargs):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(_executor, lambda: fn(*args, **kwargs))


async def _maybe_restore_face(subject_url: str, face_url: str | None) -> str:
    """Lock the user's face onto the try-on when FACE_RESTORE is enabled.
    Falls back to the original try-on if disabled or if the pass fails."""
    if not FACE_RESTORE or not face_url:
        return subject_url
    restored = await _run_blocking(
        runway_service.runway_restore_face, subject_url=subject_url, face_url=face_url
    )
    return restored or subject_url


async def _rehost(user_id: str, runway_url: str) -> str:
    """
    Re-host a Runway output URL into Supabase Storage so it never expires.
    Runway's CloudFront URLs are short-lived signed links (the embedded _jwt
    expires in days), which silently breaks saved try-ons/outfit previews.
    Falls back to the raw URL if the download fails so a generation is never lost.
    """
    try:
        return await _run_blocking(
            supabase_service.upload_url_to_storage,
            bucket="tryons", user_id=user_id, source_url=runway_url,
        )
    except Exception:
        return runway_url


@router.post("/generate")
async def generate_tryon(req: TryOnRequest, user = Depends(current_user)):
    if "localhost" in req.avatar_selfie_url or "localhost" in req.item_image_url:
        raise HTTPException(400, "URLs must be public HTTPS, not localhost. Upload to Supabase first.")

    try:
        result = await _run_blocking(
            runway_service.runway_generate_tryon,
            avatar_url=req.avatar_selfie_url,
            item_url=req.item_image_url,
            item_name=req.item_name,
            item_category=req.item_category,
            model=runway_service.valid_tryon_model(req.model),
            setting=req.setting,
        )
    except RuntimeError as e:
        raise HTTPException(500, str(e))

    restored = await _maybe_restore_face(result["image_url"], req.avatar_selfie_url)
    image_url = await _rehost(user["id"], restored)

    saved = supabase_service.save_tryon_result(
        user_id=user["id"],
        item_id=req.wardrobe_item_id,
        result_url=image_url,
        model_used=result["model_used"],
        prompt_used=result["prompt_used"],
        runway_task_id=result["task_id"],
    )

    return {
        "result_image_url": image_url,
        "result_id": saved["id"],
        "model_used": result["model_used"],
    }


@router.post("/generate-multi")
async def generate_multi_tryon(req: MultiItemTryOnRequest, user = Depends(current_user)):
    if not req.items:
        raise HTTPException(400, "Need at least one item.")
    if len(req.items) > 6:
        raise HTTPException(400, "Max 6 items at once (composite layout limit).")

    try:
        result = await _run_blocking(
            runway_service.runway_generate_multi_tryon,
            avatar_url=req.avatar_selfie_url,
            items=req.items,
            model=runway_service.valid_tryon_model(req.model),
            setting=req.setting,
            storage_uploader=supabase_service.upload_to_storage,
            user_id=user["id"],
        )
    except RuntimeError as e:
        raise HTTPException(500, str(e))

    restored = await _maybe_restore_face(result["image_url"], req.avatar_selfie_url)
    image_url = await _rehost(user["id"], restored)

    saved = supabase_service.save_tryon_result(
        user_id=user["id"],
        item_id=None,
        result_url=image_url,
        model_used=result["model_used"],
        prompt_used=result["prompt_used"],
        runway_task_id=result["task_id"],
    )

    return {
        "result_image_url": image_url,
        "result_id": saved["id"],
        "model_used": result["model_used"],
    }


@router.post("/event-scene")
async def event_scene(req: EventSceneRequest, user = Depends(current_user)):
    try:
        result = await _run_blocking(
            runway_service.runway_event_scene,
            tryon_url=req.tryon_result_url,
            event_context=req.event_context,
        )
    except RuntimeError as e:
        raise HTTPException(500, str(e))

    event_image_url = await _rehost(user["id"], result["image_url"])

    if req.tryon_result_id:
        supabase_service.update_tryon_event_scene(
            req.tryon_result_id, event_image_url, req.event_context
        )

    return {"event_image_url": event_image_url, "task_id": result["task_id"]}


@router.post("/animate")
async def animate(req: AnimateRequest, user = Depends(current_user)):
    try:
        result = await _run_blocking(
            runway_service.runway_animate,
            image_url=req.image_url,
            motion_prompt=req.motion_prompt,
            model=runway_service.valid_video_model(req.model),
            scene=req.scene,
        )
    except RuntimeError as e:
        raise HTTPException(500, str(e))

    if req.tryon_result_id:
        supabase_service.update_tryon_video(req.tryon_result_id, result["video_url"], result["task_id"])

    return {"video_url": result["video_url"], "task_id": result["task_id"]}


@router.get("/recent")
async def recent(limit: int = 12, user = Depends(current_user)):
    return supabase_service.get_recent_tryons(user["id"], limit)
