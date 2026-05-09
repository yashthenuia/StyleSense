"""All Runway SDK calls live here.

CRITICAL RULES (verified against docs.dev.runwayml.com 2026-01):
- All image URLs passed to Runway MUST be publicly accessible HTTPS (NOT localhost).
- Reference image tags are FREE-FORM strings - reference them via @tag in prompt_text.
  Up to 3 reference images per text_to_image call.
- Use gen4_image_turbo during dev (2 credits/img), gen4_image for demo recording (5+ credits).
- Polling is handled by .wait_for_task_output() - don't roll your own loop.
"""
import os
import logging
from runwayml import RunwayML, TaskFailedError, TaskTimeoutError

logger = logging.getLogger(__name__)

# Support both env var names (SDK reads RUNWAYML_API_SECRET by default)
_API_KEY = os.getenv("RUNWAY_API_KEY") or os.getenv("RUNWAYML_API_SECRET")
if not _API_KEY:
    raise RuntimeError(
        "Missing Runway API key. Set RUNWAY_API_KEY or RUNWAYML_API_SECRET in backend/.env"
    )

client = RunwayML(api_key=_API_KEY)


# ───────────────────────────── PROMPTS ───────────────────────────── #

PROMPT_TRYON_SINGLE = (
    "Photorealistic full-body fashion photograph of @selfie wearing @garment. "
    "Studio lighting, clean neutral background, sharp focus, magazine editorial quality. "
    "Preserve the exact face, hair, skin tone, and body proportions of @selfie. "
    "The garment from @garment is rendered with accurate color, texture, fit and silhouette."
)

PROMPT_TRYON_MULTI = (
    "Photorealistic full-body fashion photograph of @selfie wearing {item_phrase}. "
    "Studio lighting, clean neutral background, magazine editorial quality. "
    "Preserve the exact face and body of @selfie. "
    "Render each garment with accurate color, fit and texture."
)

PROMPT_EVENT_SCENE = (
    "Photorealistic editorial photograph of @subject standing at {event_context}. "
    "Full body visible, the outfit on @subject is the focus. "
    "Cinematic natural lighting matching the scene, candid confident pose, "
    "depth of field, professional fashion photography."
)


# ───────────────────────────── HELPERS ───────────────────────────── #

def _model_supports_three_refs(model: str) -> bool:
    """gen4_image variants support up to 3 reference images. Some others may not."""
    return model.startswith("gen4_image") or model.startswith("gemini_image")


# ───────────────────────────── TRY-ON ───────────────────────────── #

def runway_generate_tryon(
    avatar_url: str,
    item_url: str,
    item_name: str,
    item_category: str = "tops",
    model: str = "gen4_image_turbo",
) -> dict:
    """
    Generate single-item try-on image.

    Args:
        avatar_url: HTTPS URL of user selfie (Supabase Storage public URL).
        item_url:   HTTPS URL of clothing item.
        item_name:  Human-readable name (e.g. "Navy linen blazer").
        item_category: tops|bottoms|dresses|outerwear|shoes|accessories
        model:      gen4_image (best) or gen4_image_turbo (fast/cheap).

    Returns:
        dict with: image_url, task_id, model_used, prompt_used
    """
    prompt = PROMPT_TRYON_SINGLE.format()  # placeholders are static here

    try:
        task = client.text_to_image.create(
            model=model,
            prompt_text=prompt,
            ratio="720:1280",  # portrait, best for fashion full-body
            reference_images=[
                {"uri": avatar_url, "tag": "selfie"},
                {"uri": item_url, "tag": "garment"},
            ],
        ).wait_for_task_output(timeout=300)

        image_url = task.output[0]
        return {
            "image_url": image_url,
            "task_id": task.id,
            "model_used": model,
            "prompt_used": prompt,
        }
    except TaskFailedError as e:
        logger.error(f"Runway try-on failed: {e.task_details}")
        raise RuntimeError(f"Runway generation failed: {e.task_details}")
    except TaskTimeoutError:
        logger.error("Runway try-on timed out after 5min")
        raise RuntimeError("Generation timed out (5 minutes)")


def runway_generate_multi_tryon(
    avatar_url: str,
    items: list,
    model: str = "gen4_image_turbo",
) -> dict:
    """
    Generate multi-item try-on (e.g. top + bottom together).
    Max 2 items (selfie counts as the 3rd reference).
    """
    if len(items) < 1:
        raise ValueError("Need at least one item")
    if len(items) > 2:
        raise ValueError("Max 2 items at once (Runway allows 3 refs total incl. selfie)")

    # Build reference list and prompt phrasing
    refs = [{"uri": avatar_url, "tag": "selfie"}]
    item_phrases = []
    for i, item in enumerate(items, start=1):
        tag = f"item{i}"
        refs.append({"uri": item["image_url"], "tag": tag})
        item_phrases.append(f"@{tag}")

    item_phrase = " and ".join(item_phrases)
    prompt = PROMPT_TRYON_MULTI.format(item_phrase=item_phrase)

    try:
        task = client.text_to_image.create(
            model=model,
            prompt_text=prompt,
            ratio="720:1280",
            reference_images=refs,
        ).wait_for_task_output(timeout=300)

        return {
            "image_url": task.output[0],
            "task_id": task.id,
            "model_used": model,
            "prompt_used": prompt,
        }
    except TaskFailedError as e:
        raise RuntimeError(f"Runway multi-tryon failed: {e.task_details}")
    except TaskTimeoutError:
        raise RuntimeError("Multi-tryon timed out (5 minutes)")


# ───────────────────────────── EVENT SCENE ───────────────────────────── #

def runway_event_scene(tryon_url: str, event_context: str) -> dict:
    """
    Take an existing try-on image and place the subject in an event scene.
    Uses gen4_image with the try-on result as the only reference.
    """
    prompt = PROMPT_EVENT_SCENE.format(event_context=event_context)

    try:
        task = client.text_to_image.create(
            model="gen4_image",
            prompt_text=prompt,
            ratio="1024:1024",
            reference_images=[
                {"uri": tryon_url, "tag": "subject"},
            ],
        ).wait_for_task_output(timeout=300)

        return {
            "image_url": task.output[0],
            "task_id": task.id,
            "model_used": "gen4_image",
            "prompt_used": prompt,
        }
    except TaskFailedError as e:
        raise RuntimeError(f"Event scene failed: {e.task_details}")
    except TaskTimeoutError:
        raise RuntimeError("Event scene timed out")


# ───────────────────────────── ANIMATE ───────────────────────────── #

def runway_animate(image_url: str, motion_prompt: str) -> dict:
    """
    Animate a still try-on image into a 5-second video using gen4.5.

    RULES:
    - image_url must be HTTPS
    - input aspect ratio must be 0.5 to 2.0 for gen4.5
    - duration: 5 or 10 seconds (we use 5 for credit budget)
    - cost: 60 credits for 5s
    """
    try:
        task = client.image_to_video.create(
            model="gen4.5",
            prompt_image=image_url,
            prompt_text=motion_prompt,
            ratio="720:1280",  # portrait, matches our try-on output
            duration=5,
        ).wait_for_task_output(timeout=300)

        return {
            "video_url": task.output[0],
            "task_id": task.id,
            "model_used": "gen4.5",
            "prompt_used": motion_prompt,
        }
    except TaskFailedError as e:
        raise RuntimeError(f"Runway animate failed: {e.task_details}")
    except TaskTimeoutError:
        raise RuntimeError("Animation timed out")


# ───────────────────────────── EPHEMERAL UPLOAD ───────────────────────────── #

def runway_upload_ephemeral(image_bytes: bytes, content_type: str, name: str = "upload.jpg") -> str:
    """
    Upload bytes to Runway ephemeral storage. Returns runway:// URI valid 24h.
    Use ONLY when you can't get a public HTTPS URL (we always can via Supabase).
    """
    upload = client.assets.upload(data=image_bytes, content_type=content_type, name=name)
    return upload.uri
