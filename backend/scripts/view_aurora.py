"""
Browse the data stored in Aurora. Prints a per-table count + the most recent rows
with the key columns, so you can eyeball what's in the database.

Run inside the backend venv, from backend/:
    .\\venv\\Scripts\\python.exe -m scripts.view_aurora            # 5 recent rows per table
    .\\venv\\Scripts\\python.exe -m scripts.view_aurora users 10   # 10 rows from one table
"""
import sys
import logging

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("view_aurora")

from services import db  # noqa: E402

# table -> the columns worth showing (kept short for terminal readability)
VIEWS = {
    "users": ["id", "email", "full_name", "stylized_avatar_status", "created_at"],
    "wardrobe_items": ["id", "name", "category", "color", "created_at"],
    "try_on_results": ["id", "user_id", "model_used", "saved", "created_at"],
    "outfits": ["id", "name", "item_ids", "created_at"],
}


def _short(v, n=36):
    s = str(v)
    return s if len(s) <= n else s[: n - 1] + "…"


def show(table: str, cols: list, limit: int) -> None:
    total = db.query(f"SELECT count(*) c FROM {table}", fetch="one")["c"]
    rows = db.query(
        f"SELECT {', '.join(cols)} FROM {table} ORDER BY created_at DESC LIMIT :n",
        {"n": limit},
        fetch="all",
    )
    print(f"\n=== {table}  ({total} rows total, showing {len(rows)} most recent) ===")
    for r in rows:
        print("  " + " | ".join(f"{c}={_short(r[c])}" for c in cols))


def main() -> None:
    args = sys.argv[1:]
    limit = 5
    tables = list(VIEWS)
    if args:
        if args[0] in VIEWS:
            tables = [args[0]]
        if len(args) > 1 and args[-1].isdigit():
            limit = int(args[-1])
    for t in tables:
        show(t, VIEWS[t], limit)
    print()


if __name__ == "__main__":
    main()
