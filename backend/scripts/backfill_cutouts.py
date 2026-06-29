"""
Backfill transparent cutouts for wardrobe items and store them in cutout_url.

Usage (inside the backend venv, from backend/):
    .\\venv\\Scripts\\python.exe -m scripts.backfill_cutouts                 # only rows missing a cutout
    .\\venv\\Scripts\\python.exe -m scripts.backfill_cutouts --force          # regenerate ALL rows
    .\\venv\\Scripts\\python.exe -m scripts.backfill_cutouts accessories shoes # only these categories (regenerate)

The model is chosen per category (clothing -> u2net_cloth_seg, accessories/shoes ->
isnet-general-use). First run downloads the model(s) (~170MB each).
"""
import sys
import logging

import httpx
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("backfill_cutouts")

from services import db, supabase_service  # noqa: E402
from services.garment_cleaner import make_cutout  # noqa: E402

_CATEGORIES = {"tops", "bottoms", "dresses", "outerwear", "shoes", "accessories"}


def main() -> None:
    args = [a.lower() for a in sys.argv[1:]]
    force = "--force" in args
    cats = [a for a in args if a in _CATEGORIES]

    sql = "SELECT id, user_id, name, category, image_url FROM wardrobe_items WHERE image_url IS NOT NULL"
    params: dict = {}
    if cats:
        sql += " AND category = ANY(:cats)"      # regenerate these categories regardless
        params["cats"] = cats
    elif not force:
        sql += " AND cutout_url IS NULL"          # default: only fill the gaps
    sql += " ORDER BY created_at DESC"
    rows = db.query(sql, params, fetch="all")

    logger.info(f"{len(rows)} item(s) to process (force={force}, cats={cats or 'all'}).")
    done, failed = 0, 0
    for r in rows:
        try:
            data = httpx.get(r["image_url"], timeout=30, follow_redirects=True).content
            png = make_cutout(data, category=r.get("category"))
            if not png:
                failed += 1
                logger.warning(f"  ! {r['name']}: cutout returned nothing")
                continue
            url = supabase_service.upload_to_storage(
                "wardrobe", r["user_id"], png, "cutout.png", "image/png"
            )
            db.query(
                "UPDATE wardrobe_items SET cutout_url = :u WHERE id = :id",
                {"u": url, "id": r["id"]},
                fetch="none",
            )
            done += 1
            logger.info(f"  ok  {r['name']}")
        except Exception as e:  # noqa: BLE001
            failed += 1
            logger.warning(f"  ! {r['name']}: {type(e).__name__}: {e}")
    logger.info(f"Done. {done} cutouts created, {failed} failed.")


if __name__ == "__main__":
    main()
