"""
Quick Aurora connectivity + schema sanity check. Run after setting
AURORA_DATABASE_URL in backend/.env and applying aurora_schema.sql:

    .\\venv\\Scripts\\python.exe -m scripts.check_aurora

Verifies: (1) the connection works, (2) the 4 tables exist, (3) the trickiest
bindings round-trip - a TEXT[] (tags), a UUID[] (item_ids), and a JSONB value -
by inserting one throwaway row and reading it back. Cleans up after itself; makes
no changes to real data.
"""
import json
import logging

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("check_aurora")

from services import db  # noqa: E402

EXPECTED_TABLES = {"users", "wardrobe_items", "try_on_results", "outfits"}


def main() -> None:
    # 1. Connectivity
    one = db.query("SELECT 1 AS ok", fetch="one")
    assert one and one["ok"] == 1
    logger.info("[1/3] connection OK")

    # 2. Tables present
    rows = db.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
        fetch="all",
    )
    present = {r["table_name"] for r in rows}
    missing = EXPECTED_TABLES - present
    if missing:
        logger.warning(f"[2/3] MISSING tables: {sorted(missing)} - run aurora_schema.sql")
    else:
        logger.info("[2/3] all 4 core tables present")

    # 3. Binding round-trip. A regular (not TEMP) throwaway table, so it survives
    #    across pooled connections; dropped again at the end.
    db.query("DROP TABLE IF EXISTS _stylesense_smoke", fetch="none")
    db.query(
        "CREATE TABLE _stylesense_smoke (tags TEXT[], ids UUID[], meta JSONB)",
        fetch="none",
    )
    try:
        db.query(
            """
            INSERT INTO _stylesense_smoke (tags, ids, meta)
            VALUES ((:tags)::text[], (:ids)::uuid[], CAST(:meta AS JSONB))
            """,
            {
                "tags": ["red", "summer"],
                "ids": ["00000000-0000-0000-0000-000000000001"],
                "meta": json.dumps({"undertone": "warm", "colors": ["olive", "rust"]}),
            },
            fetch="none",
        )
        back = db.query("SELECT tags, ids, meta FROM _stylesense_smoke", fetch="one")
        assert back["tags"] == ["red", "summer"], back["tags"]
        assert back["meta"]["undertone"] == "warm", back["meta"]
        logger.info(f"[3/3] array + jsonb round-trip OK -> {back}")
    finally:
        db.query("DROP TABLE IF EXISTS _stylesense_smoke", fetch="none")

    logger.info("Aurora is ready.")


if __name__ == "__main__":
    main()
