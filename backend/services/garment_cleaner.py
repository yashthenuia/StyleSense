"""
Garment image cleaner — turns a messy user photo into a clean studio product shot.

Strategy (Runway-first, rembg fallback):
    1. Try Runway gen4_image to RE-SYNTHESIZE the garment as a clean studio shot.
       Best quality. Costs ~2-5 credits. Requires Runway credits.
    2. If Runway fails (no credits, API error, model rejects image), fall back to
       rembg: removes the background using a U^2-Net segmentation model, then
       composites the garment onto a pure white background.
       Free, runs locally, no network needed after first model download.
    3. If BOTH fail, return the original bytes unchanged. Wardrobe still gets the
       photo, just not cleaned.

The first call to rembg downloads the U^2-Net model (~170MB) into ~/.u2net.
Subsequent calls are fast (~2-3s on CPU).
"""
import io
import logging
from typing import Literal
from PIL import Image

logger = logging.getLogger(__name__)

# Lazy-load rembg session (heavy import + model download)
_rembg_session = None


def _get_rembg_session(model_name: str = "u2net_cloth_seg"):
    """
    Default model: u2net_cloth_seg — trained specifically on clothing
    (segments upper body / lower body / full body garments). Much better than
    general-purpose models for fashion photos where hands/face/background
    might otherwise win the "main subject" vote.

    Other options if needed:
      - 'isnet-general-use'   general object segmentation
      - 'birefnet-general'    higher quality general (slower)
      - 'u2net_human_seg'     keeps the entire person (including clothes + body)
    """
    global _rembg_session
    if _rembg_session is None:
        from rembg import new_session
        _rembg_session = new_session(model_name=model_name)
        logger.info(f"rembg session initialized (model={model_name})")
    return _rembg_session


CleanMethod = Literal["runway", "rembg", "original", "skipped"]


VERIFY_PROMPT = (
    "You are checking a product photo that is supposed to show exactly ONE clothing "
    "item or accessory on a clean plain background, ghost-mannequin / e-commerce style. "
    'Reply with ONLY a JSON object: {"clean": true|false, "problems": ["..."]}. '
    "Set clean=false if the image shows ANY of: a human body part (face, head, neck, "
    "arms, hands, legs, feet, visible skin), a person or mannequin, more than one "
    "distinct garment, or distracting background/clutter/furniture. Otherwise clean=true. "
    "problems = short phrases naming what is wrong (empty list if clean)."
)


def verify_clean_garment(image_bytes: bytes, content_type: str = "image/jpeg") -> tuple[bool, list[str]]:
    """
    Claude-vision check that a cleaned image is a single isolated garment with no
    body parts/background. Returns (is_clean, problems). On any error returns
    (True, []) so a verification hiccup never blocks the wardrobe-add pipeline.
    """
    try:
        import base64
        import json
        import re
        from services.anthropic_service import client, MODEL

        media_type = content_type if content_type in ("image/jpeg", "image/png", "image/webp", "image/gif") else "image/jpeg"
        resp = client.messages.create(
            model=MODEL,
            max_tokens=300,
            messages=[{
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": media_type,
                                                  "data": base64.standard_b64encode(image_bytes).decode("ascii")}},
                    {"type": "text", "text": VERIFY_PROMPT},
                ],
            }],
        )
        text = "".join(b.text for b in resp.content if hasattr(b, "text")).strip()
        if text.startswith("```"):
            text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
            text = re.sub(r"\n?```\s*$", "", text)
        data = json.loads(text.strip())
        return bool(data.get("clean", True)), [str(p) for p in (data.get("problems") or [])]
    except Exception as e:
        logger.warning(f"verify_clean_garment failed: {type(e).__name__}: {e}")
        return True, []


def _generate_with_verify(prompt: str, ref_uri: str, ref_tag: str, model: str,
                          ratio: str = "720:960", item_label: str = "garment") -> str | None:
    """
    Run a Runway text_to_image cleanup, then Claude-vision verify the result.
    If the result still shows body parts/background, retry ONCE with a
    problem-specific strengthened prompt. Returns the final image URL or None.
    """
    try:
        from services.runway_service import client
        from runwayml import TaskFailedError, TaskTimeoutError
        import httpx
    except Exception as e:
        logger.warning(f"Runway service unavailable: {e}")
        return None

    def _gen(p: str) -> str:
        task = client.text_to_image.create(
            model=model,
            prompt_text=p,
            ratio=ratio,
            reference_images=[{"uri": ref_uri, "tag": ref_tag}],
        ).wait_for_task_output(timeout=180)
        return task.output[0]

    try:
        url = _gen(prompt)
    except TaskFailedError as e:
        logger.warning(f"Runway clean failed for '{item_label}': {e.task_details}")
        return None
    except TaskTimeoutError:
        logger.warning(f"Runway clean timed out for '{item_label}'")
        return None
    except Exception as e:
        logger.warning(f"Runway clean error for '{item_label}': {type(e).__name__}: {e}")
        return None

    # Verify + one retry
    try:
        with httpx.Client(timeout=20.0, follow_redirects=True) as c:
            r = c.get(url)
            r.raise_for_status()
        clean, problems = verify_clean_garment(r.content)
        if not clean:
            logger.info(f"'{item_label}': verify failed ({problems}); retrying once")
            retry_prompt = prompt + (
                f" The previous attempt still showed: {', '.join(problems) or 'body parts/background'}. "
                "Remove ALL of it - absolutely no skin, no flesh, no body parts, no person, "
                "no mannequin, no background; ONLY the isolated garment on pure white."
            )
            try:
                url = _gen(retry_prompt)
            except Exception as e:
                logger.warning(f"'{item_label}': retry failed ({e}); keeping first result")
    except Exception as e:
        logger.warning(f"'{item_label}': verify skipped ({e})")

    return url


def clean_with_rembg(image_bytes: bytes, background: tuple = (255, 255, 255)) -> bytes:
    """
    Remove background using rembg, composite onto a solid color (default white).
    Returns JPEG bytes.
    """
    from rembg import remove
    session = _get_rembg_session()

    # remove() returns RGBA PNG bytes
    cutout_png = remove(image_bytes, session=session)
    cutout = Image.open(io.BytesIO(cutout_png)).convert("RGBA")

    # Composite onto solid background
    canvas = Image.new("RGB", cutout.size, background)
    canvas.paste(cutout, mask=cutout.split()[3])  # alpha as mask

    # Center-crop and pad to a 3:4 portrait so the wardrobe grid looks consistent
    canvas = _fit_portrait_3x4(canvas, background)

    # Encode as JPEG
    buf = io.BytesIO()
    canvas.save(buf, format="JPEG", quality=88)
    return buf.getvalue()


def _fit_portrait_3x4(img: Image.Image, background: tuple) -> Image.Image:
    """Resize + pad an image to a clean 768x1024 (3:4 portrait) on the given background."""
    target_w, target_h = 768, 1024
    img.thumbnail((target_w, target_h), Image.LANCZOS)
    canvas = Image.new("RGB", (target_w, target_h), background)
    x = (target_w - img.width) // 2
    y = (target_h - img.height) // 2
    if img.mode == "RGBA":
        canvas.paste(img, (x, y), mask=img.split()[3])
    else:
        canvas.paste(img, (x, y))
    return canvas


def clean_with_runway(image_url: str, item_name: str, item_category: str = "tops", model: str = "gen4_image") -> str | None:
    """
    Use Runway to re-synthesize a clean studio shot of the garment.
    Defaults to full-quality gen4_image for best output.
    Returns the URL of the generated image, or None on any error.
    """
    # Aggressive negative-prompted, ghost-mannequin style cleanup.
    # Runway-style models often re-include the model when given a person photo.
    # The fix is to over-specify "ghost mannequin" / "invisible mannequin" which
    # is the actual e-commerce term for "garment shaped like a body but no body".
    prompt = (
        f"Ghost mannequin product photograph of the {item_name} from @garment. "
        f"Invisible mannequin photography style: the garment holds its 3D shape "
        f"as if worn, but there is NO person, NO mannequin, NO head, NO neck, "
        f"NO arms, NO hands, NO legs, NO feet, NO skin tones, NO flesh, NO body "
        f"silhouette visible anywhere. "
        f"Pure white seamless background, centered framing, full garment visible "
        f"from collar to hem, no cropping. Faithful to original colors, fabric, "
        f"texture, embroidery, beadwork, stitching, prints, drape, and silhouette. "
        f"Photorealistic e-commerce catalog product shot, Net-a-Porter / Farfetch / "
        f"Saks Fifth Avenue style, soft even studio lighting, subtle shadow under "
        f"the garment, 8K resolution, ultra sharp detail. {item_category} only on white."
    )
    return _generate_with_verify(prompt, ref_uri=image_url, ref_tag="garment",
                                 model=model, item_label=item_name)


def runway_isolate_item(
    source_image_url: str,
    item_name: str,
    item_category: str = "tops",
    color: str | None = None,
    position: str | None = None,
    model: str = "gen4_image_turbo",
) -> str | None:
    """
    Isolate ONE specific garment from a multi-item photo. Used by the
    multi-item wardrobe-add flow: the same source photo is fed once per item
    with a description targeting that specific piece.

    Returns the URL of the isolated product shot, or None on failure.
    """
    color_clause = f"color {color}, " if color else ""
    position_clause = f" The target item is located {position} in the @source photo." if position else ""

    prompt = (
        f"Ghost mannequin product photograph of the {color_clause}{item_name} "
        f"({item_category}) extracted from the @source photo.{position_clause} "
        f"Isolate ONLY this single garment - remove every other clothing item, "
        f"accessory, person, mannequin, body part, hand, face, skin, flesh, hanger, "
        f"furniture, and background. The garment holds its 3D shape as if worn "
        f"by an invisible mannequin. Pure white seamless background, centered "
        f"framing, full garment visible from top to bottom with no cropping. "
        f"Faithful to the original color, fabric, texture, stitching, and "
        f"silhouette of the target item. Photorealistic e-commerce catalog "
        f"product shot, Net-a-Porter / Farfetch style, soft even studio "
        f"lighting, subtle shadow under the garment, 8K resolution, ultra "
        f"sharp detail."
    )
    return _generate_with_verify(prompt, ref_uri=source_image_url, ref_tag="source",
                                 model=model, item_label=item_name)


def clean_garment_bytes(
    image_bytes: bytes,
    item_name: str,
    item_category: str = "tops",
    item_image_url: str | None = None,
    prefer: Literal["auto", "runway", "rembg", "none"] = "auto",
) -> tuple[bytes, CleanMethod]:
    """
    Run the cleanup pipeline on raw image bytes.

    Args:
        image_bytes: original image bytes
        item_name:   for the Runway prompt
        item_image_url: optional public URL of the original (Runway needs HTTPS, not bytes).
            If provided AND prefer is 'runway' or 'auto', tries Runway first.
        prefer:
            'auto'   -> try Runway if URL given, else rembg
            'runway' -> only Runway, fallback to original on fail
            'rembg'  -> only rembg
            'none'   -> return original unchanged

    Returns: (output_bytes, method_used)
    """
    if prefer == "none":
        return image_bytes, "skipped"

    # Try Runway first if a public URL is available
    if prefer in ("auto", "runway") and item_image_url:
        runway_url = clean_with_runway(item_image_url, item_name, item_category)
        if runway_url:
            # Download the Runway-generated image
            try:
                import httpx
                with httpx.Client(timeout=20.0, follow_redirects=True) as c:
                    r = c.get(runway_url)
                    r.raise_for_status()
                return r.content, "runway"
            except Exception as e:
                logger.warning(f"Could not download Runway result: {e}")
                # Fall through to rembg

    if prefer == "runway":
        # User asked for Runway only; on fail return original
        return image_bytes, "original"

    # rembg path
    try:
        cleaned = clean_with_rembg(image_bytes)
        return cleaned, "rembg"
    except Exception as e:
        logger.error(f"rembg failed: {e}")
        return image_bytes, "original"
