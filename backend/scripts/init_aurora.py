"""
Create the Aurora schema without needing the `psql` client.

Reads backend/aurora_schema.sql and runs it through the same SQLAlchemy engine the
app uses (so it picks up IAM-token auth automatically). Idempotent - the schema file
uses IF NOT EXISTS, so it is safe to re-run.

Run inside the backend venv, from the backend/ dir:
    .\\venv\\Scripts\\python.exe -m scripts.init_aurora
"""
import logging
import os

from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("init_aurora")

from services import db  # noqa: E402

_SCHEMA_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "aurora_schema.sql")


def main() -> None:
    with open(_SCHEMA_PATH, "r", encoding="utf-8") as f:
        ddl = f.read()

    # psycopg2 runs multiple ';'-separated statements in a single execute(), which is
    # exactly what a schema file needs. Use a raw connection for that.
    raw = db.engine.raw_connection()
    try:
        cur = raw.cursor()
        cur.execute(ddl)
        raw.commit()
        cur.close()
    finally:
        raw.close()

    logger.info(f"Schema applied from {os.path.basename(_SCHEMA_PATH)}")


if __name__ == "__main__":
    main()
