"""
One-time data copy: Supabase -> Aurora PostgreSQL for the 4 core tables.

Reads every row of users / wardrobe_items / try_on_results / outfits from Supabase
and inserts them into Aurora, preserving the original id + created_at. Idempotent:
ON CONFLICT (id) DO NOTHING, so it is safe to re-run (e.g. to pick up new rows).

Run inside the backend venv, from the backend/ dir:
    .\\venv\\Scripts\\python.exe -m scripts.migrate_to_aurora

Requires both SUPABASE_* and AURORA_DATABASE_URL in backend/.env, and the Aurora
schema already applied (backend/aurora_schema.sql).
"""
import json
import logging

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("migrate_to_aurora")

from services import db, supabase_service  # noqa: E402  (after load_dotenv)

TABLES = ["users", "wardrobe_items", "try_on_results", "outfits"]

# Columns that need explicit handling when binding into Aurora.
ARRAY_COLS = {
    "wardrobe_items": {"tags": "text[]"},
    "outfits": {"item_ids": "uuid[]"},
}
JSONB_COLS = {
    "users": {"selfie_urls", "color_profile"},
}


def _aurora_columns(table: str) -> set:
    """The set of columns that actually exist on the Aurora table."""
    rows = db.query(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = :t
        """,
        {"t": table},
        fetch="all",
    )
    return {r["column_name"] for r in rows}


def _insert_row(table: str, row: dict, allowed: set) -> bool:
    """Insert one row, returning True if a new row was written (False on conflict/skip)."""
    cols, placeholders, params = [], [], {}
    arr = ARRAY_COLS.get(table, {})
    jsonb = JSONB_COLS.get(table, set())

    for key, value in row.items():
        if key not in allowed:
            continue  # drop any column the Aurora schema doesn't have
        cols.append(key)
        if key in arr:
            placeholders.append(f"(:{key})::{arr[key]}")
            params[key] = value if value is not None else []
        elif key in jsonb:
            placeholders.append(f"CAST(:{key} AS JSONB)")
            params[key] = json.dumps(value) if value is not None else None
        else:
            placeholders.append(f":{key}")
            params[key] = value

    result = db.query(
        f"""
        INSERT INTO {table} ({", ".join(cols)})
        VALUES ({", ".join(placeholders)})
        ON CONFLICT (id) DO NOTHING
        RETURNING id
        """,
        params,
        fetch="one",
    )
    return result is not None


def migrate_table(table: str) -> None:
    rows = supabase_service.supabase.table(table).select("*").execute().data or []
    allowed = _aurora_columns(table)
    if not allowed:
        logger.warning(f"  ! {table}: no such table in Aurora - run aurora_schema.sql first. Skipping.")
        return

    inserted, skipped, failed = 0, 0, 0
    for row in rows:
        try:
            if _insert_row(table, row, allowed):
                inserted += 1
            else:
                skipped += 1
        except Exception as e:  # noqa: BLE001
            failed += 1
            logger.warning(f"  ! {table} id={row.get('id')}: {e}")

    logger.info(
        f"  {table}: {len(rows)} in Supabase -> {inserted} inserted, "
        f"{skipped} already present, {failed} failed"
    )


def main() -> None:
    logger.info("Copying core tables Supabase -> Aurora ...")
    for table in TABLES:
        migrate_table(table)
    logger.info("Done.")


if __name__ == "__main__":
    main()
