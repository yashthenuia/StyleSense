"""
A/B the Studio avatar: Runway gen4 vs Gemini 2.5 Flash, from the same selfie + the
user's most-recent outfit + the same editorial-studio setting. Uploads BOTH results
to Supabase (public URLs) and saves copies to backend/_diag/ for review. Does NOT
touch the user's real stylized_avatar_url.

Run in the venv:  .\\venv\\Scripts\\python.exe -m scripts.diag_avatar_ab [user_id]
"""
import io
import sys
import logging

import httpx
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("diag_avatar_ab")

from services import db, supabase_service, runway_service, image_service  # noqa: E402

OUT = "_diag"
EDITORIAL = ("Premium fashion studio: clean warm grey backdrop, soft cinematic lighting with a "
             "subtle gold rim light, background in sharp focus. Photorealistic, natural skin "
             "texture, magazine quality, full-frame camera. Confident relaxed pose, head to feet.")


def _pad(uid, url):
    try:
        data = httpx.get(url, timeout=30, follow_redirects=True).content
        padded = image_service.pad_to_ratio_range(data)
        if padded == data:
            return url
        return supabase_service.upload_to_storage("selfies", uid, padded, "ref.jpg", "image/jpeg")
    except Exception:
        return url


def _save_and_host(uid, label, runway_url):
    data = httpx.get(runway_url, timeout=60, follow_redirects=True).content
    open(f"{OUT}/{label}.jpg", "wb").write(data)
    return supabase_service.upload_to_storage("tryons", uid, data, f"{label}.jpg", "image/jpeg")


def main():
    import os
    os.makedirs(OUT, exist_ok=True)
    uid = sys.argv[1] if len(sys.argv) > 1 else "bd77682d-f5af-4bd2-9d76-c7be0a885ebe"
    u = db.query("SELECT avatar_selfie_url, full_body_url FROM users WHERE id=:u", {"u": uid}, fetch="one")
    selfie, body = u["avatar_selfie_url"], u.get("full_body_url")
    items = supabase_service.get_wardrobe_items(uid) or []

    def first(cat):
        return next((i for i in items if (i.get("category") or "").lower() == cat), None)
    dress = first("dresses")
    chosen = [dress] if dress else [x for x in (first("tops"), first("bottoms")) if x]
    if not chosen:
        logger.info("No outfit items found; aborting."); return
    if len(chosen) == 1:
        garment, name = chosen[0]["image_url"], chosen[0]["name"]
    else:
        comp = runway_service.composite_product_collage([c["image_url"] for c in chosen])
        garment = supabase_service.upload_to_storage("tryons", uid, comp, "ab-outfit.jpg", "image/jpeg")
        name = " + ".join(c["name"] for c in chosen)
    logger.info(f"user {uid[:8]} | outfit: {name} | body photo: {bool(body)}")

    selfie_p = _pad(uid, selfie)
    body_p = _pad(uid, body) if body else None

    # --- Runway gen4: tagged refs, selfie + body + garment ---
    refs = [{"uri": selfie_p, "tag": "selfie"}]
    if body_p:
        refs.append({"uri": body_p, "tag": "body"})
    refs.append({"uri": garment, "tag": "garment"})
    gen4_prompt = (
        f"Photorealistic full-body editorial fashion photograph of the person from @selfie - preserve "
        f"their exact face, facial hair, hair and skin tone - "
        f"{'with the real body and proportions from @body ' if body_p else ''}"
        f"wearing the {name} from @garment (use ONLY the clothing from @garment, ignore any model). {EDITORIAL}"
    )[:1000]
    task = runway_service.client.text_to_image.create(
        model="gen4_image", prompt_text=gen4_prompt, ratio="720:1280", reference_images=refs[:3],
    ).wait_for_task_output(timeout=300)
    gen4_url = _save_and_host(uid, "avatar_gen4", task.output[0])
    logger.info("gen4 done")

    # --- Gemini Flash: garment IMAGE 1, selfie LAST, NO body (3 refs break Gemini) ---
    gem_prompt = (
        f"Photorealistic full-body editorial fashion photograph. IMAGE 1 = the {name}: use ONLY its "
        f"clothing, ignore any model wearing it. The LAST image is the person - recreate THAT exact "
        f"person wearing the outfit, their face IDENTICAL to the last image (same face, facial hair, "
        f"hair, skin tone). {EDITORIAL}"
    )[:1000]
    task = runway_service.client.text_to_image.create(
        model="gemini_2.5_flash", prompt_text=gem_prompt, ratio="832:1248",
        reference_images=[{"uri": garment, "tag": "garment"}, {"uri": selfie_p, "tag": "selfie"}],
    ).wait_for_task_output(timeout=300)
    gem_url = _save_and_host(uid, "avatar_gemini", task.output[0])
    logger.info("gemini done")

    print("\n=== AVATAR A/B RESULTS ===")
    print("Runway gen4 :", gen4_url)
    print("Gemini Flash:", gem_url)


if __name__ == "__main__":
    main()
