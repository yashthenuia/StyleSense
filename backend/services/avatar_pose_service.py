"""
Stylized full-body editorial-3D avatar generation.

Each user gets one stylized version of themselves matching Aria's editorial
fashion 3D aesthetic. Used as the Studio idle hero + 'before' in the compare
slider. Photoreal try-ons still use the raw selfie for facial accuracy.

Pipeline:
  selfie (Supabase) -> gen4_image w/ @selfie reference -> Supabase rehost ->
    save users.stylized_avatar_url
"""
import asyncio
import logging
import httpx

from runwayml import TaskFailedError, TaskTimeoutError

from services import supabase_service
from services.runway_service import client as runway_client, runway_animate

logger = logging.getLogger(__name__)

# Shared with backend/scripts/animate_admin_stylist.py - both Aria and the
# per-user stylized avatar use the same motion vocabulary so the dashboard
# heroes look like they live in the same world.
RAMP_WALK_PROMPT = (
    "Editorial 3D fashion runway: the character walks confidently forward "
    "toward the camera in a smooth catwalk strut, model gait, subtle head "
    "movement, gentle hair sway, soft cinematic camera tracking. Preserve "
    "the stylized 3D character aesthetic from the source image exactly - "
    "matte skin, polished 3D rendering, fashion forward styling. Clean "
    "neutral warm grey studio background with subtle gold rim light. "
    "Loopable seamless motion, 5 second cinematic clip, 8K fashion editorial."
)


# Mirrors Aria's prompt aesthetic (editorial fashion 3D, gold rim light, warm
# grey background) but full body and personalized via @selfie reference.
STYLIZED_PROMPT = (
    "Editorial 3D character full body standing portrait of the person from "
    "@selfie, head to feet visible, confident relaxed posture, looking "
    "forward. Stylized fashion illustration aesthetic in the style of high "
    "end fashion brand CGI and luxury runway visuals, matching the look of "
    "the StyleSense brand mascot. Sleek refined character design with "
    "contemporary fashion forward styling, designer minimalist outfit in "
    "muted neutral tones. Clean neutral warm grey studio background, soft "
    "cinematic studio lighting with subtle gold rim light. Polished 3D "
    "rendering, matte skin texture, sleek modern hair styling. The face, "
    "skin tone, and overall likeness from @selfie are preserved while "
    "rendered in this stylized 3D aesthetic. High quality character design, "
    "elegant approachable confident."
)


async def generate_stylized_avatar(
    user_id: str,
    selfie_url: str,
) -> dict:
    """
    Generate a stylized editorial-3D full-body avatar from a selfie. Persists
    on the users row. Returns {url, source_selfie} on success, raises on failure.

    Idempotent: caller is responsible for skipping if a stylized avatar
    already exists for this selfie source.
    """
    # Mark generating so the frontend can show a spinner
    try:
        supabase_service.upsert_user(
            user_id,
            stylized_avatar_status="generating",
            stylized_avatar_source_selfie=selfie_url,
        )
    except Exception as e:
        logger.warning(f"Could not mark stylized_avatar_status (column missing?): {e}")

    try:
        task = runway_client.text_to_image.create(
            model="gen4_image",
            prompt_text=STYLIZED_PROMPT,
            ratio="720:1280",
            reference_images=[{"uri": selfie_url, "tag": "selfie"}],
        ).wait_for_task_output(timeout=240)
    except TaskFailedError as e:
        logger.error(f"Stylized avatar gen failed: {e.task_details}")
        try:
            supabase_service.upsert_user(user_id, stylized_avatar_status="failed")
        except Exception:
            pass
        raise RuntimeError(f"Runway gen failed: {e.task_details}")
    except TaskTimeoutError:
        try:
            supabase_service.upsert_user(user_id, stylized_avatar_status="failed")
        except Exception:
            pass
        raise RuntimeError("Stylized avatar generation timed out")

    runway_url = task.output[0]

    # Rehost to Supabase so we have a permanent URL (Runway URLs are JWT-signed
    # and expire). Use 'selfies' bucket since that's what we already have public.
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as c:
        img_resp = await c.get(runway_url)
        img_resp.raise_for_status()

    permanent_url = supabase_service.upload_to_storage(
        bucket="selfies",
        user_id=user_id,
        file_bytes=img_resp.content,
        filename="stylized-avatar.jpg",
        content_type="image/jpeg",
    )

    try:
        supabase_service.upsert_user(
            user_id,
            stylized_avatar_url=permanent_url,
            stylized_avatar_status="ready",
            stylized_avatar_source_selfie=selfie_url,
        )
    except Exception as e:
        logger.warning(f"Could not save stylized_avatar_url (column missing?): {e}")

    return {"url": permanent_url, "source_selfie": selfie_url}


async def generate_stylized_video(
    user_id: str,
    stylized_image_url: str,
) -> dict:
    """
    Animate the user's stylized 3D portrait into a 5s editorial catwalk loop.
    Persists on the users row. Returns {url, source} on success, raises on failure.

    ~60cr per call (gen4.5 / veo3.1 image-to-video). Idempotent guard is the
    caller's responsibility - check stylized_avatar_video_source == source
    before calling.
    """
    try:
        supabase_service.upsert_user(
            user_id,
            stylized_avatar_video_status="generating",
            stylized_avatar_video_source=stylized_image_url,
        )
    except Exception as e:
        logger.warning(f"Could not mark stylized_avatar_video_status (column missing?): {e}")

    # runway_animate is synchronous - run in executor so the bg task doesn't
    # block other async work in the worker.
    loop = asyncio.get_running_loop()
    try:
        # Hero ramp videos are landscape (16:9) - ramp walking is a horizontal
        # motion, not portrait. The Studio "Animate" button still defaults to
        # portrait via runway_animate's signature.
        result = await loop.run_in_executor(
            None,
            lambda: runway_animate(
                stylized_image_url,
                motion_prompt=RAMP_WALK_PROMPT,
                ratio="1280:720",
            ),
        )
    except RuntimeError as e:
        logger.warning(f"Stylized video gen failed: {e}")
        try:
            supabase_service.upsert_user(user_id, stylized_avatar_video_status="failed")
        except Exception:
            pass
        raise

    runway_url = result.get("video_url")
    if not runway_url:
        try:
            supabase_service.upsert_user(user_id, stylized_avatar_video_status="failed")
        except Exception:
            pass
        raise RuntimeError("Runway animate returned no video_url")

    # Rehost to Supabase (Runway video URLs are JWT-signed and expire).
    async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as c:
        v = await c.get(runway_url)
        v.raise_for_status()

    permanent_url = supabase_service.upload_to_storage(
        bucket="selfies",
        user_id=user_id,
        file_bytes=v.content,
        filename="stylized-ramp.mp4",
        content_type="video/mp4",
    )

    try:
        supabase_service.upsert_user(
            user_id,
            stylized_avatar_video_url=permanent_url,
            stylized_avatar_video_status="ready",
            stylized_avatar_video_source=stylized_image_url,
        )
    except Exception as e:
        logger.warning(f"Could not save stylized_avatar_video_url (column missing?): {e}")

    return {"url": permanent_url, "source": stylized_image_url}
