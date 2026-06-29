"""
A/B diagnostic: does adding the user's FULL-BODY photo as an extra try-on reference
improve body/fit WITHOUT bleeding the photo's clothing into the result?

Generates 4 variants for one user (must have a selfie + full_body_url) + one garment,
for BOTH models, into backend/_diag/:
  - {model}_noBody : current behavior (garment + face selfie)
  - {model}_body   : garment + face selfie + full-body reference (doc-based prompt)

Then a human (or the assistant via Read) compares: better proportions/fit? any
clothing from the body photo leaking in? Wire the body ref into runway_service ONLY
if it clearly helps without bleed.

Run in the venv:  .\\venv\\Scripts\\python.exe -m scripts.diag_bodyref [user_email]
"""
import io
import sys
import logging

import httpx
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("diag_bodyref")

from services import db, supabase_service, image_service  # noqa: E402
from services.runway_service import client, _to_aspect_ratio  # noqa: E402

OUT = "_diag"


def _safe(user_id, url):
    """Pad tall/wide refs into gen4's [0.5,2.0] ratio range; re-host if changed."""
    try:
        data = httpx.get(url, timeout=60, follow_redirects=True).content
        padded = image_service.pad_to_ratio_range(data)
        if padded == data:
            return url
        return supabase_service.upload_to_storage("selfies", user_id, padded, "ref.jpg", "image/jpeg")
    except Exception:
        return url

# gen4: tagged references + explicit exclusion (Runway References guide).
GEN4_BODY_PROMPT = (
    "Full-body e-commerce fashion photo of the person from @selfie (their exact face and "
    "identity) with the real body shape and proportions of the person in @body, wearing ONLY "
    "the {item} from @garment. Do NOT use any clothing from @body or @selfie. Full body head "
    "to feet, confident pose, clean studio background, realistic lighting, natural skin."
)
# gemini: order-based + natural-language exclusion (Gemini image guide).
GEMINI_BODY_PROMPT = (
    "Photorealistic full-body e-commerce try-on. IMAGE 1 = the {item}: use ONLY its clothing, "
    "ignore any model wearing it. IMAGE 2 is the person's face; IMAGE 3 is the same person's "
    "full body. Recreate THAT person wearing the garment - face identical to IMAGE 2, real body "
    "shape and proportions from IMAGE 3 - and IGNORE any clothing shown in IMAGE 2 or IMAGE 3. "
    "Full body head to feet, sharp face, clean studio background, realistic lighting."
)


def _save(label, url):
    data = httpx.get(url, timeout=60, follow_redirects=True).content
    open(f"{OUT}/{label}.jpg", "wb").write(data)
    logger.info(f"  saved {label}")


def _gen(model, prompt, refs):
    task = client.text_to_image.create(
        model=model, prompt_text=prompt, ratio=_to_aspect_ratio(model), reference_images=refs
    ).wait_for_task_output(timeout=300)
    return task.output[0]


def main():
    import os
    os.makedirs(OUT, exist_ok=True)
    email = sys.argv[1] if len(sys.argv) > 1 else None
    q = "SELECT id, email, avatar_selfie_url, selfie_urls, full_body_url FROM users WHERE full_body_url IS NOT NULL"
    if email:
        q += " AND email = :e"
    row = db.query(q + " LIMIT 1", {"e": email} if email else None, fetch="one")
    if not row:
        logger.info("No user has a full_body_url yet. Upload a full-body photo in Avatar Setup, then re-run.")
        return
    selfie = row.get("avatar_selfie_url") or (row.get("selfie_urls") or [None])[0]
    body = row.get("full_body_url")
    if not selfie:
        logger.info(f"{row['email']} has a full-body photo but no face selfie; add a selfie to A/B properly.")
        return
    g = db.query(
        "SELECT name, image_url FROM wardrobe_items WHERE user_id = :u "
        "AND category IN ('tops','dresses','outerwear','bottoms') ORDER BY created_at DESC LIMIT 1",
        {"u": row["id"]}, fetch="one")
    if not g:
        logger.info("That user has no wardrobe items to test with.")
        return
    item, garment = g["name"], g["image_url"]
    logger.info(f"User {row['email']} | garment: {item}")
    _save("selfie", selfie); _save("full_body", body); _save("garment", garment)
    # Pad refs so gen4 doesn't reject tall photos (does nothing if already in range).
    selfie = _safe(row["id"], selfie)
    body = _safe(row["id"], body)

    # gen4
    _save("gen4_noBody", _gen("gen4_image",
          "Full-body e-commerce photo of @selfie wearing ONLY the " + item + " from @garment. "
          "Clean studio, realistic lighting, natural skin.",
          [{"uri": selfie, "tag": "selfie"}, {"uri": garment, "tag": "garment"}]))
    _save("gen4_body", _gen("gen4_image", GEN4_BODY_PROMPT.format(item=item),
          [{"uri": selfie, "tag": "selfie"}, {"uri": body, "tag": "body"}, {"uri": garment, "tag": "garment"}]))

    # gemini (garment IMAGE 1; person refs after)
    _save("gemini_noBody", _gen("gemini_2.5_flash",
          "Photorealistic full-body try-on. IMAGE 1 = the " + item + " (use only its clothing, ignore any model). "
          "The last image is the person; recreate them wearing the garment, face identical. Clean studio.",
          [{"uri": garment, "tag": "garment"}, {"uri": selfie, "tag": "selfie"}]))
    _save("gemini_body", _gen("gemini_2.5_flash", GEMINI_BODY_PROMPT.format(item=item),
          [{"uri": garment, "tag": "garment"}, {"uri": selfie, "tag": "selfie"}, {"uri": body, "tag": "body"}]))

    logger.info("Done. Compare _diag/{gen4,gemini}_{noBody,body}.jpg for fit gain vs clothing bleed.")


if __name__ == "__main__":
    main()
