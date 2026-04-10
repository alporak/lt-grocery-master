#!/usr/bin/env python3
"""
One-time bulk enrichment script using Groq (free API).
Enriches all products that don't have enrichment data yet.

Usage:
  1. Get a free API key at https://console.groq.com/keys
  2. Run:  GROQ_API_KEY=gsk_... python3 bulk-enrich.py

  Or set DATA_DIR if your DB is somewhere else:
     DATA_DIR=/app/data GROQ_API_KEY=gsk_... python3 bulk-enrich.py

This writes directly to the SQLite database. Run it while the embedder
container is stopped, or it will work alongside it (SQLite WAL handles it).
"""

import json, os, sys, time, sqlite3, asyncio, logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s [bulk-enrich] %(message)s")
log = logging.getLogger("bulk-enrich")

try:
    import httpx
except ImportError:
    log.error("httpx not installed. Run: pip install httpx")
    sys.exit(1)

# --- Config ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
DATA_DIR = os.getenv("DATA_DIR", "/app/data")
DB_PATH = os.path.join(DATA_DIR, "grocery.db")
BATCH_SIZE = 500  # commit every N products
CONCURRENCY = 1   # process one at a time to stay within rate limits
RATE_LIMIT_RPM = 28  # stay just under 30
REQUEST_INTERVAL = 60.0 / RATE_LIMIT_RPM  # seconds between requests

if not GROQ_API_KEY:
    log.error("Set GROQ_API_KEY env var. Get a free key at https://console.groq.com/keys")
    sys.exit(1)

ENRICH_SCHEMA = {
    "type": "object",
    "properties": {
        "name_clean": {"type": "string"},
        "is_food": {"type": "boolean"},
        "primary_category": {"type": "string"},
        "tags_en": {"type": "array", "items": {"type": "string"}},
        "tags_lt": {"type": "array", "items": {"type": "string"}},
        "attributes": {"type": "object"},
    },
    "required": ["name_clean", "is_food", "primary_category", "tags_en", "tags_lt"],
}

SYSTEM_PROMPT = """You classify Lithuanian grocery products. Return a JSON object.

Examples:

Product: Rokiškio pienas 2.5% riebumo, 1L | Rokiškio milk 2.5% fat, 1L | Pieno produktai | Rokiškio
Result: {"name_clean":"Rokiškio Milk 2.5% Fat 1L","is_food":true,"primary_category":"Dairy","tags_en":["milk","fresh milk","dairy","rokiškio","low fat"],"tags_lt":["pienas","šviežias pienas","rokiškio","pieno produktai"],"attributes":{"type":"fresh","packaging":"carton"}}

Product: Fairy indų ploviklis Lemon 900ml | Fairy dish soap Lemon 900ml | Valymo priemonės
Result: {"name_clean":"Fairy Dish Soap Lemon 900ml","is_food":false,"primary_category":"Cleaning Products","tags_en":["dish soap","dishwashing","cleaning","fairy","lemon"],"tags_lt":["indų ploviklis","valymo priemonė","fairy","citrinos kvapas"],"attributes":{"type":"liquid","scent":"lemon"}}

Product: Karūna šokoladinis batonėlis su karamele 40g | Karūna chocolate bar with caramel 40g | Saldumynai | Karūna
Result: {"name_clean":"Karūna Chocolate Bar with Caramel 40g","is_food":true,"primary_category":"Sweets & Chocolate","tags_en":["chocolate","candy bar","caramel","sweet","snack","karūna"],"tags_lt":["šokoladas","batonėlis","karamelė","saldainiai","karūna","užkandis"],"attributes":{"type":"confectionery","flavor":"caramel"}}

Product: Pedigree šunims su jautiena 400g | Pedigree dog food with beef 400g | Gyvūnų maistas | Pedigree
Result: {"name_clean":"Pedigree Dog Food with Beef 400g","is_food":false,"primary_category":"Pet Food","tags_en":["dog food","pet food","pedigree","beef","dog"],"tags_lt":["šunų maistas","gyvūnų maistas","pedigree","jautiena","šuo"],"attributes":{"type":"wet","protein":"beef"}}

Rules:
- name_clean: English product name with brand and size
- is_food: false for cleaning, pet food, hygiene, paper products
- primary_category: broad English category (Dairy, Poultry, Beverages, Snacks, Cleaning Products, etc.)
- tags_en: 4-7 English search words a shopper would use
- tags_lt: 4-7 Lithuanian search words a shopper would use
- attributes: filterable properties like type, flavor, scent, packaging"""


def build_product_text(row) -> str:
    parts = [row["nameLt"]]
    if row["nameEn"]:
        parts.append(row["nameEn"])
    if row["categoryLt"]:
        parts.append(row["categoryLt"])
    if row["brand"]:
        parts.append(row["brand"])
    return " | ".join(parts)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


async def enrich_one(client: httpx.AsyncClient, rate_bucket: dict, product_text: str) -> dict | None:
    """Call Groq API with rate limiting."""
    # Simple rate limiter: wait between requests
    now = time.monotonic()
    elapsed_since_last = now - rate_bucket.get("last", 0)
    if elapsed_since_last < REQUEST_INTERVAL:
        await asyncio.sleep(REQUEST_INTERVAL - elapsed_since_last)
    rate_bucket["last"] = time.monotonic()

    try:
        resp = await client.post(GROQ_URL, json={
            "model": GROQ_MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": f"Product: {product_text}\nResult:"},
            ],
            "temperature": 0.1,
            "max_tokens": 300,
            "response_format": {"type": "json_object"},
        }, headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        })

        if resp.status_code == 429:
            retry_after = float(resp.headers.get("retry-after", "10"))
            log.warning(f"Rate limited, waiting {retry_after}s...")
            await asyncio.sleep(retry_after)
            rate_bucket["last"] = time.monotonic()
            return await enrich_one(client, rate_bucket, product_text)

        if resp.status_code != 200:
            log.warning(f"Groq returned {resp.status_code}: {resp.text[:200]}")
            return None

        result = resp.json()
        content = result["choices"][0]["message"]["content"]
        data = json.loads(content)
        if isinstance(data, dict) and "name_clean" in data:
            return data
    except Exception as e:
        log.warning(f"Error: {e}")
    return None


async def main():
    conn = get_db()

    total_pending = conn.execute("SELECT count(*) FROM Product WHERE enrichedAt IS NULL").fetchone()[0]
    total_done = conn.execute("SELECT count(*) FROM Product WHERE enrichedAt IS NOT NULL").fetchone()[0]
    log.info(f"Products: {total_done} enriched, {total_pending} pending")

    if total_pending == 0:
        log.info("Nothing to do!")
        return

    est_minutes = total_pending / RATE_LIMIT_RPM
    log.info(f"Estimated time: ~{est_minutes:.0f} minutes at {RATE_LIMIT_RPM} req/min")

    sem = asyncio.Semaphore(CONCURRENCY)
    rate_bucket = {"last": 0}
    enriched_total = 0
    failed_total = 0

    async with httpx.AsyncClient(timeout=30.0) as client:
        offset = 0
        while True:
            rows = conn.execute(
                "SELECT id, nameLt, nameEn, categoryLt, categoryEn, brand FROM Product WHERE enrichedAt IS NULL LIMIT ?",
                (BATCH_SIZE,)
            ).fetchall()

            if not rows:
                break

            log.info(f"Batch: {len(rows)} products (offset ~{offset})")

            batch_ok = 0
            for row in rows:
                product_text = build_product_text(row)
                enrichment = await enrich_one(client, rate_bucket, product_text)
                if enrichment:
                    conn.execute(
                        "UPDATE Product SET enrichment = ?, enrichedAt = datetime('now') WHERE id = ?",
                        (json.dumps(enrichment), row["id"])
                    )
                    batch_ok += 1
                else:
                    failed_total += 1
                if (batch_ok + failed_total) % 50 == 0:
                    log.info(f"  Progress: {batch_ok} ok, {failed_total} failed in current batch")

            conn.commit()
            enriched_total += batch_ok
            offset += len(rows)
            log.info(f"Batch done: {batch_ok}/{len(rows)} ok. Total: {enriched_total} enriched, {failed_total} failed")

    log.info(f"Finished! {enriched_total} enriched, {failed_total} failed")
    conn.close()


if __name__ == "__main__":
    asyncio.run(main())
