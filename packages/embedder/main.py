"""
Embedder service — semantic search, category normalization, LLM enrichment, and data export
for Lithuanian grocery products.

Endpoints:
  POST /embed-batch   — generate embeddings for product texts
  POST /search        — semantic search: query → ranked product IDs
  POST /categorize    — assign canonical categories to products
  POST /enrich        — LLM-enrich new products via Groq
  POST /process       — full pipeline: embed → categorize → enrich → export
  POST /export        — export product-intelligence.json.gz
  POST /import        — import from product-intelligence artifact
  GET  /health        — readiness check
"""

import json, gzip, base64, os, time, sqlite3, logging, asyncio
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

import numpy as np
import httpx
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
log = logging.getLogger("embedder")

# --- Config ---
MODEL_NAME = os.getenv("MODEL_NAME", "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2")
DATA_DIR = Path(os.getenv("DATA_DIR", "/app/data"))
DB_PATH = DATA_DIR / "grocery.db"
EMBEDDINGS_DIR = DATA_DIR / "embeddings"
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_BATCH_SIZE = int(os.getenv("GROQ_BATCH_SIZE", "10"))
GROQ_REQUEST_INTERVAL = 1.0  # seconds between API calls
CATEGORIES_PATH = Path(__file__).parent / "categories.json"
EXPORT_PATH = DATA_DIR / "product-intelligence.json.gz"

# --- Global state ---
model = None  # SentenceTransformer, loaded at startup
embeddings: Optional[np.ndarray] = None  # shape (N, 384)
product_ids: list[int] = []
product_store_ids: list[int] = []  # parallel array: storeId for each product
canonical_categories: list[dict] = []
category_embeddings: Optional[np.ndarray] = None


def get_db():
    """Open a read-only SQLite connection."""
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def get_db_rw():
    """Open a read-write SQLite connection."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def load_categories():
    global canonical_categories, category_embeddings
    if not CATEGORIES_PATH.exists():
        log.warning("categories.json not found, skipping category loading")
        return
    with open(CATEGORIES_PATH) as f:
        canonical_categories = json.load(f)
    # Build rich text for each category for embedding
    texts = []
    for cat in canonical_categories:
        parts = [cat["en"], cat["lt"]]
        parts.extend(cat.get("keywords", []))
        texts.append(" ".join(parts))
    if model is not None:
        category_embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
        log.info(f"Loaded {len(canonical_categories)} canonical categories")


def load_embeddings():
    global embeddings, product_ids, product_store_ids
    emb_path = EMBEDDINGS_DIR / "embeddings.npy"
    ids_path = EMBEDDINGS_DIR / "product_ids.json"
    if emb_path.exists() and ids_path.exists():
        embeddings = np.load(str(emb_path))
        with open(ids_path) as f:
            data = json.load(f)
        product_ids = data["ids"]
        product_store_ids = data.get("store_ids", [0] * len(product_ids))
        log.info(f"Loaded {len(product_ids)} embeddings from disk")
    else:
        embeddings = None
        product_ids = []
        product_store_ids = []
        log.info("No embeddings found on disk")


def save_embeddings():
    EMBEDDINGS_DIR.mkdir(parents=True, exist_ok=True)
    if embeddings is not None:
        np.save(str(EMBEDDINGS_DIR / "embeddings.npy"), embeddings)
    with open(EMBEDDINGS_DIR / "product_ids.json", "w") as f:
        json.dump({"ids": product_ids, "store_ids": product_store_ids}, f)
    log.info(f"Saved {len(product_ids)} embeddings to disk")


@asynccontextmanager
async def lifespan(app: FastAPI):
    global model
    log.info(f"Loading model {MODEL_NAME}...")
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(MODEL_NAME)
    log.info("Model loaded")
    load_categories()
    load_embeddings()
    # Auto-import if no embeddings but artifact exists
    if len(product_ids) == 0 and EXPORT_PATH.exists():
        log.info("No local embeddings found, importing from artifact...")
        _do_import()
    yield
    log.info("Shutting down")


app = FastAPI(title="Grocery Embedder", lifespan=lifespan)


# --- Pydantic models ---

class EmbedBatchRequest(BaseModel):
    ids: list[int]
    texts: list[str]
    store_ids: list[int] = []

class SearchRequest(BaseModel):
    query: str
    limit: int = 50
    store_ids: list[int] = []

class CategorizeRequest(BaseModel):
    ids: list[int]
    texts: list[str]

class TranslateBatchRequest(BaseModel):
    texts: list[str]
    source: str = "lt"
    target: str = "en"


# --- Endpoints ---

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "embeddings_count": len(product_ids),
        "categories_count": len(canonical_categories),
    }


@app.post("/reset")
def reset():
    """Clear all embeddings from memory and disk."""
    global embeddings, product_ids, product_store_ids
    embeddings = None
    product_ids = []
    product_store_ids = []
    emb_path = EMBEDDINGS_DIR / "embeddings.npy"
    ids_path = EMBEDDINGS_DIR / "product_ids.json"
    if emb_path.exists():
        emb_path.unlink()
    if ids_path.exists():
        ids_path.unlink()
    log.info("[Reset] Cleared all embeddings")
    return {"status": "cleared", "embeddings_count": 0}


@app.post("/embed-batch")
def embed_batch(req: EmbedBatchRequest):
    global embeddings, product_ids, product_store_ids
    if len(req.ids) != len(req.texts):
        raise HTTPException(400, "ids and texts must have same length")
    if len(req.ids) == 0:
        return {"updated": 0}

    store_ids_input = req.store_ids if req.store_ids else [0] * len(req.ids)
    new_vecs = model.encode(req.texts, normalize_embeddings=True, show_progress_bar=True, batch_size=64)

    id_to_idx = {pid: i for i, pid in enumerate(product_ids)}
    for i, pid in enumerate(req.ids):
        if pid in id_to_idx:
            idx = id_to_idx[pid]
            embeddings[idx] = new_vecs[i]
            product_store_ids[idx] = store_ids_input[i]
        else:
            product_ids.append(pid)
            product_store_ids.append(store_ids_input[i])
            if embeddings is None:
                embeddings = new_vecs[i:i+1].copy()
            else:
                embeddings = np.vstack([embeddings, new_vecs[i:i+1]])

    save_embeddings()
    return {"updated": len(req.ids), "total": len(product_ids)}


@app.post("/search")
def search(req: SearchRequest):
    if embeddings is None or len(product_ids) == 0:
        return {"results": []}

    query_vec = model.encode([req.query], normalize_embeddings=True)
    scores = (embeddings @ query_vec.T).flatten()

    # Filter by store_ids if provided
    if req.store_ids:
        store_set = set(req.store_ids)
        mask = np.array([sid in store_set for sid in product_store_ids])
        scores = np.where(mask, scores, -1.0)

    top_k = min(req.limit, len(product_ids))
    top_indices = np.argpartition(scores, -top_k)[-top_k:]
    top_indices = top_indices[np.argsort(scores[top_indices])[::-1]]

    results = []
    for idx in top_indices:
        s = float(scores[idx])
        if s <= 0:
            break
        results.append({"id": product_ids[idx], "score": round(s, 4)})

    return {"results": results}


@app.post("/categorize")
def categorize(req: CategorizeRequest):
    if category_embeddings is None or len(canonical_categories) == 0:
        raise HTTPException(503, "Categories not loaded")
    if len(req.ids) != len(req.texts):
        raise HTTPException(400, "ids and texts must have same length")

    vecs = model.encode(req.texts, normalize_embeddings=True, show_progress_bar=False, batch_size=64)
    similarities = vecs @ category_embeddings.T  # (N, num_categories)
    best_indices = similarities.argmax(axis=1)

    results = []
    for i, cat_idx in enumerate(best_indices):
        cat = canonical_categories[cat_idx]
        results.append({
            "id": req.ids[i],
            "category_id": cat["id"],
            "category_en": cat["en"],
            "category_lt": cat["lt"],
            "score": round(float(similarities[i, cat_idx]), 4),
        })
    return {"results": results}


TRANSLATE_SYSTEM_PROMPT = """You are an expert Lithuanian-to-English translator for grocery products.
Translate the given Lithuanian grocery product names to English accurately.
IMPORTANT rules:
- Keep brand names exactly as-is (e.g. "IKI MĖSA" stays "IKI MĖSA", "Rokiškio" stays "Rokiškio")
- Translate product descriptions accurately (blauzdelės = drumsticks, NOT legs)
- Keep weights, volumes, and units as-is (500 g, 1L, etc.)
- Keep numbers and percentages as-is
- Do NOT translate store names like IKI, RIMI, Barbora, Maxima — keep them as-is
- If a word is already in English, keep it
- Return ONLY a JSON object with a "translations" array of strings, one per input product, in the same order
- Each translation should be a clean, natural English product name"""


@app.post("/translate-batch")
async def translate_batch(req: TranslateBatchRequest):
    """Translate product names using LLM for high-quality grocery translations."""
    if not GROQ_API_KEY:
        raise HTTPException(503, "GROQ_API_KEY not set — LLM translation unavailable")

    if len(req.texts) == 0:
        return {"translations": []}

    # Process in chunks of 30 to stay within token limits
    chunk_size = 30
    all_translations: list[str] = []

    async with httpx.AsyncClient(timeout=60.0) as client:
        for chunk_start in range(0, len(req.texts), chunk_size):
            chunk = req.texts[chunk_start:chunk_start + chunk_size]

            numbered = "\n".join(f"{i+1}. {t}" for i, t in enumerate(chunk))
            user_prompt = f"Translate these {len(chunk)} Lithuanian grocery product names to English:\n\n{numbered}"

            try:
                resp = await client.post(GROQ_URL, json={
                    "model": GROQ_MODEL,
                    "messages": [
                        {"role": "system", "content": TRANSLATE_SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.1,
                    "max_tokens": 4000,
                    "response_format": {"type": "json_object"},
                }, headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                })

                if resp.status_code == 429:
                    retry_after = float(resp.headers.get("retry-after", "5")) + 1
                    log.warning(f"[Translate] Rate limited, waiting {retry_after}s")
                    await asyncio.sleep(retry_after)
                    # Retry this chunk
                    resp = await client.post(GROQ_URL, json={
                        "model": GROQ_MODEL,
                        "messages": [
                            {"role": "system", "content": TRANSLATE_SYSTEM_PROMPT},
                            {"role": "user", "content": user_prompt},
                        ],
                        "temperature": 0.1,
                        "max_tokens": 4000,
                        "response_format": {"type": "json_object"},
                    }, headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type": "application/json",
                    })

                if resp.status_code != 200:
                    log.warning(f"[Translate] Groq returned {resp.status_code}, falling back to originals for chunk")
                    all_translations.extend(chunk)
                    continue

                result = resp.json()
                content = result["choices"][0]["message"]["content"]
                data = json.loads(content)

                translations = data.get("translations", [])
                if not isinstance(translations, list) or len(translations) != len(chunk):
                    log.warning(f"[Translate] Unexpected LLM response shape (got {len(translations) if isinstance(translations, list) else 'non-list'}, expected {len(chunk)}), falling back")
                    all_translations.extend(chunk)
                    continue

                all_translations.extend(translations)

            except Exception as e:
                log.warning(f"[Translate] Error on chunk: {e}")
                all_translations.extend(chunk)  # fallback to originals

            if chunk_start + chunk_size < len(req.texts):
                await asyncio.sleep(GROQ_REQUEST_INTERVAL)

    return {"translations": all_translations}


@app.post("/enrich")
async def enrich():
    """LLM-enrich products that have no enrichedAt timestamp, via Groq."""
    if not GROQ_API_KEY:
        return {"enriched": 0, "message": "GROQ_API_KEY not set", "skipped": True}

    conn = get_db_rw()
    try:
        rows = conn.execute(
            "SELECT id, nameLt, nameEn, categoryLt, categoryEn, brand FROM Product WHERE enrichedAt IS NULL LIMIT 500"
        ).fetchall()

        if not rows:
            return {"enriched": 0, "message": "No products to enrich"}

        log.info(f"[Enrich] Enriching {len(rows)} products via Groq ({GROQ_MODEL}), batch_size={GROQ_BATCH_SIZE}...")
        enriched_count = 0
        failed_count = 0

        async with httpx.AsyncClient(timeout=60.0) as client:
            for batch_start in range(0, len(rows), GROQ_BATCH_SIZE):
                batch = rows[batch_start:batch_start + GROQ_BATCH_SIZE]

                product_lines = []
                for i, row in enumerate(batch):
                    product_lines.append(f"Product {i+1}: {_build_product_text(row)}")
                batch_prompt = "\n".join(product_lines)

                try:
                    resp = await client.post(GROQ_URL, json={
                        "model": GROQ_MODEL,
                        "messages": [
                            {"role": "system", "content": BULK_ENRICH_SYSTEM_PROMPT},
                            {"role": "user", "content": batch_prompt},
                        ],
                        "temperature": 0.1,
                        "max_tokens": 4000,
                        "response_format": {"type": "json_object"},
                    }, headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type": "application/json",
                    })

                    if resp.status_code == 429:
                        retry_after = float(resp.headers.get("retry-after", "10")) + 2
                        log.warning(f"[Enrich] Rate limited, waiting {retry_after}s")
                        await asyncio.sleep(retry_after)
                        failed_count += len(batch)
                        continue

                    if resp.status_code != 200:
                        log.warning(f"[Enrich] Groq returned {resp.status_code}")
                        failed_count += len(batch)
                        continue

                    result = resp.json()
                    content = result["choices"][0]["message"]["content"]
                    data = json.loads(content)

                    items = data.get("results") if isinstance(data, dict) else data
                    if not isinstance(items, list):
                        items = [data] if isinstance(data, dict) and "name_clean" in data else []

                    for i, row in enumerate(batch):
                        if i < len(items) and isinstance(items[i], dict) and "name_clean" in items[i]:
                            conn.execute(
                                "UPDATE Product SET enrichment = ?, enrichedAt = datetime('now') WHERE id = ?",
                                (json.dumps(items[i]), row["id"])
                            )
                            enriched_count += 1
                        else:
                            failed_count += 1

                    conn.commit()

                except Exception as e:
                    log.warning(f"[Enrich] Error on batch: {e}")
                    failed_count += len(batch)

                await asyncio.sleep(GROQ_REQUEST_INTERVAL)

        log.info(f"[Enrich] Enriched {enriched_count}/{len(rows)} products ({failed_count} failed)")

        if enriched_count > 0:
            _reembed_enriched(conn, enriched_count)

        return {"enriched": enriched_count, "failed": failed_count, "total_pending": len(rows)}
    finally:
        conn.close()


@app.post("/process")
async def process():
    """Full pipeline: embed new products → categorize → enrich → group → export."""
    results = {}

    # Step 1: Embed new/updated products
    results["embed"] = _embed_new_products()

    # Step 2: Categorize uncategorized products
    results["categorize"] = _categorize_new_products()

    # Step 3: LLM enrichment via Groq (if API key is configured)
    if GROQ_API_KEY:
        enrich_result = await enrich()
        results["enrich"] = enrich_result
    else:
        results["enrich"] = {"skipped": True, "reason": "GROQ_API_KEY not set"}

    # Step 4: Group similar products
    results["group"] = _do_grouping()

    # Step 5: Export
    results["export"] = _do_export()

    return results


@app.post("/export")
def export_data():
    return _do_export()


@app.post("/import")
def import_data():
    return _do_import()


# --- Bulk enrichment via Groq API ---
# Runs as a background task so it survives client disconnects

_bulk_enrich_state = {
    "running": False,
    "total": 0,
    "done": 0,
    "failed": 0,
    "error": None,
    "started_at": None,
    "finished_at": None,
}

BULK_ENRICH_SYSTEM_PROMPT = """You classify Lithuanian grocery products. For EACH product, return a JSON object.
When given multiple products, return a JSON object with a "results" array containing one object per product, in the same order.

Each object must have:
- name_clean: English product name with brand and size
- is_food: boolean (false for cleaning, pet food, hygiene, paper products)
- primary_category: broad English category (Dairy, Poultry, Beverages, Snacks, Cleaning Products, etc.)
- tags_en: 4-7 English search words a shopper would use
- tags_lt: 4-7 Lithuanian search words a shopper would use
- attributes: object with filterable properties like type, flavor, scent, packaging

Example for a single product:
Product 1: Rokiškio pienas 2.5% riebumo, 1L | Rokiškio milk 2.5% fat, 1L | Pieno produktai | Rokiškio

{"results":[{"name_clean":"Rokiškio Milk 2.5% Fat 1L","is_food":true,"primary_category":"Dairy","tags_en":["milk","fresh milk","dairy","rokiškio","low fat"],"tags_lt":["pienas","šviežias pienas","rokiškio","pieno produktai"],"attributes":{"type":"fresh","packaging":"carton"}}]}"""


async def _bulk_enrich_worker(api_key: str, model: str):
    """Background worker that enriches all un-enriched products via Groq in batches."""
    global _bulk_enrich_state
    state = _bulk_enrich_state

    conn = get_db_rw()

    try:
        total = conn.execute("SELECT count(*) FROM Product WHERE enrichedAt IS NULL").fetchone()[0]
        state["total"] = total
        log.info(f"[BulkEnrich] Starting: {total} products pending, batch_size={GROQ_BATCH_SIZE}")

        if total == 0:
            state["running"] = False
            state["finished_at"] = time.time()
            conn.close()
            return

        async with httpx.AsyncClient(timeout=60.0) as client:
            while state["running"]:
                rows = conn.execute(
                    "SELECT id, nameLt, nameEn, categoryLt, categoryEn, brand FROM Product WHERE enrichedAt IS NULL LIMIT ?",
                    (GROQ_BATCH_SIZE,)
                ).fetchall()

                if not rows:
                    break

                # Build batched prompt
                product_lines = []
                for i, row in enumerate(rows):
                    product_lines.append(f"Product {i+1}: {_build_product_text(row)}")
                batch_prompt = "\n".join(product_lines)

                try:
                    resp = await client.post(GROQ_URL, json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": BULK_ENRICH_SYSTEM_PROMPT},
                            {"role": "user", "content": batch_prompt},
                        ],
                        "temperature": 0.1,
                        "max_tokens": 4000,
                        "response_format": {"type": "json_object"},
                    }, headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    })

                    if resp.status_code == 429:
                        retry_after = float(resp.headers.get("retry-after", "10")) + 2
                        log.warning(f"[BulkEnrich] Rate limited, waiting {retry_after}s")
                        await asyncio.sleep(retry_after)
                        continue  # retry same batch

                    if resp.status_code == 401:
                        state["error"] = "Invalid API key"
                        state["running"] = False
                        break

                    if resp.status_code == 413:
                        # Payload too large — mark batch as failed and continue
                        log.warning(f"[BulkEnrich] 413 Payload Too Large for {len(rows)} products, marking as failed")
                        for row in rows:
                            conn.execute(
                                "UPDATE Product SET enrichedAt = datetime('now') WHERE id = ? AND enrichedAt IS NULL",
                                (row["id"],)
                            )
                        conn.commit()
                        state["failed"] += len(rows)
                        await asyncio.sleep(GROQ_REQUEST_INTERVAL)
                        continue

                    if resp.status_code != 200:
                        log.warning(f"[BulkEnrich] Groq returned {resp.status_code}")
                        state["failed"] += len(rows)
                        for row in rows:
                            conn.execute(
                                "UPDATE Product SET enrichedAt = datetime('now') WHERE id = ? AND enrichedAt IS NULL",
                                (row["id"],)
                            )
                        conn.commit()
                        await asyncio.sleep(GROQ_REQUEST_INTERVAL)
                        continue

                    result = resp.json()
                    content = result["choices"][0]["message"]["content"]
                    data = json.loads(content)

                    # Handle both {"results": [...]} and direct array
                    items = data.get("results") if isinstance(data, dict) else data
                    if not isinstance(items, list):
                        items = [data] if isinstance(data, dict) and "name_clean" in data else []

                    for i, row in enumerate(rows):
                        if i < len(items) and isinstance(items[i], dict) and "name_clean" in items[i]:
                            conn.execute(
                                "UPDATE Product SET enrichment = ?, enrichedAt = datetime('now') WHERE id = ?",
                                (json.dumps(items[i]), row["id"])
                            )
                            state["done"] += 1
                        else:
                            state["failed"] += 1

                    conn.commit()
                    log.info(f"[BulkEnrich] Progress: {state['done']}/{state['total']} done, {state['failed']} failed")

                except Exception as e:
                    log.warning(f"[BulkEnrich] Error on batch: {e}")
                    state["failed"] += len(rows)
                    for row in rows:
                        conn.execute(
                            "UPDATE Product SET enrichedAt = datetime('now') WHERE id = ? AND enrichedAt IS NULL",
                            (row["id"],)
                        )
                    conn.commit()

                # 1 request per second
                await asyncio.sleep(GROQ_REQUEST_INTERVAL)

    except Exception as e:
        state["error"] = str(e)
        log.error(f"[BulkEnrich] Fatal error: {e}")
    finally:
        conn.commit()
        conn.close()
        state["running"] = False
        state["finished_at"] = time.time()
        log.info(f"[BulkEnrich] Finished: {state['done']} done, {state['failed']} failed")


class BulkEnrichRequest(BaseModel):
    api_key: str = ""
    model: str = "llama-3.1-8b-instant"


@app.post("/bulk-enrich")
async def bulk_enrich(req: BulkEnrichRequest):
    """Start bulk enrichment via Groq API. Runs in the background."""
    global _bulk_enrich_state
    if _bulk_enrich_state["running"]:
        return {"error": "Bulk enrichment already running"}, 409

    # Use provided key or fall back to env var
    api_key = req.api_key or GROQ_API_KEY
    if not api_key:
        return {"error": "No API key provided and GROQ_API_KEY not set"}

    # Count pending
    conn = get_db()
    total = conn.execute("SELECT count(*) FROM Product WHERE enrichedAt IS NULL").fetchone()[0]
    conn.close()

    _bulk_enrich_state = {
        "running": True,
        "total": total,
        "done": 0,
        "failed": 0,
        "error": None,
        "started_at": time.time(),
        "finished_at": None,
    }

    asyncio.create_task(_bulk_enrich_worker(api_key, req.model))
    return {"started": True, "total": total}


@app.post("/bulk-enrich/stop")
async def bulk_enrich_stop():
    """Stop the running bulk enrichment."""
    global _bulk_enrich_state
    if _bulk_enrich_state["running"]:
        _bulk_enrich_state["running"] = False
        return {"stopped": True}
    return {"stopped": False, "message": "Not running"}


@app.get("/bulk-enrich/status")
async def bulk_enrich_status():
    """Get bulk enrichment progress."""
    return _bulk_enrich_state


# --- Product Grouping ---

_group_state = {
    "running": False,
    "total": 0,
    "groups_created": 0,
    "products_grouped": 0,
    "error": None,
}


@app.post("/group")
async def group_products():
    """Group similar products across stores using barcodes and embedding similarity."""
    global _group_state
    if _group_state["running"]:
        return {"error": "Grouping already running"}

    _group_state = {
        "running": True,
        "total": 0,
        "groups_created": 0,
        "products_grouped": 0,
        "error": None,
    }

    try:
        result = _do_grouping()
        _group_state.update(result)
        _group_state["running"] = False
        return result
    except Exception as e:
        _group_state["error"] = str(e)
        _group_state["running"] = False
        log.error(f"[Group] Error: {e}")
        raise HTTPException(500, str(e))


@app.get("/group/status")
def group_status():
    return _group_state


def _do_grouping() -> dict:
    """
    Group products using:
    1. Barcode matching (exact match across stores)
    2. Embedding similarity within same canonical category + compatible weight
    """
    if embeddings is None or len(product_ids) == 0:
        return {"error": "No embeddings loaded", "groups_created": 0, "products_grouped": 0}

    conn = get_db_rw()
    try:
        # Load all products
        rows = conn.execute("""
            SELECT id, storeId, nameLt, nameEn, barcode, canonicalCategory,
                   weightValue, weightUnit, brand, enrichment
            FROM Product
        """).fetchall()

        log.info(f"[Group] Processing {len(rows)} products...")

        id_to_row = {r["id"]: r for r in rows}
        id_to_emb_idx = {pid: i for i, pid in enumerate(product_ids)}

        # Track assignments: product_id → group_id
        product_to_group: dict[int, int] = {}
        group_members: dict[int, list[int]] = {}  # group_id → [product_ids]
        next_group_id = 1

        # Check existing groups
        existing_max = conn.execute("SELECT MAX(id) FROM ProductGroup").fetchone()[0]
        if existing_max:
            next_group_id = existing_max + 1
            # Load existing assignments
            existing = conn.execute("SELECT id, productGroupId FROM Product WHERE productGroupId IS NOT NULL").fetchall()
            for ex in existing:
                product_to_group[ex["id"]] = ex["productGroupId"]
                if ex["productGroupId"] not in group_members:
                    group_members[ex["productGroupId"]] = []
                group_members[ex["productGroupId"]].append(ex["id"])

        # Step 1: Barcode grouping
        barcode_map: dict[str, list[int]] = {}
        for row in rows:
            if row["barcode"] and row["id"] not in product_to_group:
                bc = row["barcode"].strip()
                if bc:
                    barcode_map.setdefault(bc, []).append(row["id"])

        barcode_groups = 0
        for bc, pids in barcode_map.items():
            if len(pids) < 2:
                continue
            gid = next_group_id
            next_group_id += 1
            group_members[gid] = pids
            for pid in pids:
                product_to_group[pid] = gid
            barcode_groups += 1

        log.info(f"[Group] Barcode grouping: {barcode_groups} groups from barcodes")

        # Step 2: Embedding similarity within categories
        # Group ungrouped products by category
        category_products: dict[str, list[int]] = {}
        for row in rows:
            if row["id"] not in product_to_group and row["canonicalCategory"]:
                category_products.setdefault(row["canonicalCategory"], []).append(row["id"])

        SIMILARITY_THRESHOLD = 0.85
        embedding_groups = 0

        for cat, cat_pids in category_products.items():
            # Get embeddings for these products
            valid_pids = [pid for pid in cat_pids if pid in id_to_emb_idx]
            if len(valid_pids) < 2:
                continue

            indices = [id_to_emb_idx[pid] for pid in valid_pids]
            cat_embs = embeddings[indices]  # (N, 384)

            # Compute pairwise cosine similarity
            sim_matrix = cat_embs @ cat_embs.T  # (N, N)

            # Simple greedy clustering
            assigned = set()
            for i in range(len(valid_pids)):
                if i in assigned:
                    continue

                pid_i = valid_pids[i]
                row_i = id_to_row.get(pid_i)
                if not row_i:
                    continue

                cluster = [pid_i]
                assigned.add(i)

                for j in range(i + 1, len(valid_pids)):
                    if j in assigned:
                        continue
                    if sim_matrix[i, j] < SIMILARITY_THRESHOLD:
                        continue

                    pid_j = valid_pids[j]
                    row_j = id_to_row.get(pid_j)
                    if not row_j:
                        continue

                    # Weight compatibility check: don't group different sizes
                    if _weights_compatible(row_i, row_j):
                        cluster.append(pid_j)
                        assigned.add(j)

                if len(cluster) >= 2:
                    gid = next_group_id
                    next_group_id += 1
                    group_members[gid] = cluster
                    for pid in cluster:
                        product_to_group[pid] = gid
                    embedding_groups += 1

        log.info(f"[Group] Embedding grouping: {embedding_groups} groups from similarity")

        # Write to DB
        total_groups = 0
        total_products = 0

        # Clear old groups not being reused
        conn.execute("UPDATE Product SET productGroupId = NULL")
        conn.execute("DELETE FROM ProductGroup")

        for gid, pids in group_members.items():
            if len(pids) < 2:
                continue

            # Pick representative name
            rep_row = id_to_row.get(pids[0])
            if not rep_row:
                continue

            name = rep_row["nameLt"]
            name_en = None
            cat = rep_row["canonicalCategory"]

            # Prefer enrichment name_clean if available
            for pid in pids:
                r = id_to_row.get(pid)
                if r and r["enrichment"]:
                    try:
                        enr = json.loads(r["enrichment"]) if isinstance(r["enrichment"], str) else r["enrichment"]
                        if enr.get("name_clean"):
                            name_en = enr["name_clean"]
                            break
                    except (json.JSONDecodeError, TypeError):
                        pass

            # Use shortest nameLt as group name
            for pid in pids:
                r = id_to_row.get(pid)
                if r and len(r["nameLt"]) < len(name):
                    name = r["nameLt"]

            conn.execute(
                "INSERT INTO ProductGroup (id, name, nameEn, canonicalCategory, createdAt, updatedAt) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
                (gid, name, name_en, cat)
            )
            total_groups += 1

            for pid in pids:
                conn.execute("UPDATE Product SET productGroupId = ? WHERE id = ?", (gid, pid))
                total_products += 1

        conn.commit()
        log.info(f"[Group] Created {total_groups} groups, assigned {total_products} products")

        return {
            "groups_created": total_groups,
            "products_grouped": total_products,
            "barcode_groups": barcode_groups,
            "embedding_groups": embedding_groups,
            "total": len(rows),
        }
    finally:
        conn.close()


def _weights_compatible(row_a, row_b) -> bool:
    """Check if two products have compatible weights (same size or both unspecified)."""
    w_a = row_a["weightValue"]
    w_b = row_b["weightValue"]
    u_a = (row_a["weightUnit"] or "").lower()
    u_b = (row_b["weightUnit"] or "").lower()

    # Both have no weight → compatible
    if w_a is None and w_b is None:
        return True

    # One has weight, other doesn't → still compatible (benefit of the doubt)
    if w_a is None or w_b is None:
        return True

    # Different units → normalize to base unit
    w_a_norm = _normalize_weight(w_a, u_a)
    w_b_norm = _normalize_weight(w_b, u_b)

    if w_a_norm is None or w_b_norm is None:
        return True

    # Allow 10% tolerance
    ratio = w_a_norm / w_b_norm if w_b_norm > 0 else 0
    return 0.9 <= ratio <= 1.1


def _normalize_weight(value: float, unit: str) -> float | None:
    """Normalize weight to grams or milliliters."""
    if unit in ("kg",):
        return value * 1000
    if unit in ("g",):
        return value
    if unit in ("l",):
        return value * 1000
    if unit in ("ml",):
        return value
    return None


# --- Internal helpers ---

def _build_product_text(row) -> str:
    parts = [row["nameLt"]]
    if row["nameEn"]:
        parts.append(row["nameEn"])
    if row["categoryLt"]:
        parts.append(row["categoryLt"])
    if row["brand"]:
        parts.append(row["brand"])
    return " | ".join(parts)


def _embed_new_products() -> dict:
    """Embed products that are new or updated since last embedding."""
    global embeddings, product_ids, product_store_ids

    conn = get_db()
    try:
        existing_set = set(product_ids)

        rows = conn.execute("""
            SELECT p.id, p.storeId, p.nameLt, p.nameEn, p.categoryLt, p.categoryEn,
                   p.brand, p.enrichment
            FROM Product p
        """).fetchall()

        # Find products that need embedding: new or not yet embedded
        to_embed = []
        for row in rows:
            if row["id"] not in existing_set:
                to_embed.append(row)

        if not to_embed:
            return {"embedded": 0, "message": "All products already embedded"}

        log.info(f"[Embed] Embedding {len(to_embed)} new products...")
        texts = []
        ids = []
        store_ids = []
        for row in to_embed:
            text = _build_composite_text(row)
            texts.append(text)
            ids.append(row["id"])
            store_ids.append(row["storeId"])

        new_vecs = model.encode(texts, normalize_embeddings=True, show_progress_bar=True, batch_size=64)

        if embeddings is None:
            embeddings = new_vecs
        else:
            embeddings = np.vstack([embeddings, new_vecs])

        product_ids.extend(ids)
        product_store_ids.extend(store_ids)
        save_embeddings()

        return {"embedded": len(to_embed), "total": len(product_ids)}
    finally:
        conn.close()


def _build_composite_text(row) -> str:
    """Build rich text for embedding from all available product data."""
    parts = [row["nameLt"]]
    if row["nameEn"]:
        parts.append(row["nameEn"])
    if row["categoryLt"]:
        parts.append(row["categoryLt"])
    if row["categoryEn"]:
        parts.append(row["categoryEn"])
    if row["brand"]:
        parts.append(row["brand"])
    # Include LLM enrichment tags if available
    if row["enrichment"]:
        try:
            enr = json.loads(row["enrichment"]) if isinstance(row["enrichment"], str) else row["enrichment"]
            if enr.get("tags_en"):
                parts.extend(enr["tags_en"])
            if enr.get("tags_lt"):
                parts.extend(enr["tags_lt"])
            if enr.get("primary_category"):
                parts.append(enr["primary_category"])
        except (json.JSONDecodeError, TypeError):
            pass
    return " ".join(parts)


def _categorize_new_products() -> dict:
    """Assign canonical categories to products that don't have one."""
    if category_embeddings is None or len(canonical_categories) == 0:
        return {"categorized": 0, "message": "Categories not loaded"}

    conn = get_db_rw()
    total_categorized = 0
    try:
        while True:
            rows = conn.execute(
                "SELECT id, nameLt, nameEn, categoryLt, brand FROM Product WHERE canonicalCategory IS NULL LIMIT 2000"
            ).fetchall()

            if not rows:
                break

            log.info(f"[Categorize] Categorizing {len(rows)} products (total so far: {total_categorized})...")
            texts = [_build_product_text(r) for r in rows]
            vecs = model.encode(texts, normalize_embeddings=True, show_progress_bar=True, batch_size=64)
            similarities = vecs @ category_embeddings.T
            best_indices = similarities.argmax(axis=1)

            for i, row in enumerate(rows):
                cat = canonical_categories[best_indices[i]]
                conn.execute(
                    "UPDATE Product SET canonicalCategory = ? WHERE id = ?",
                    (cat["id"], row["id"])
                )

            conn.commit()
            total_categorized += len(rows)

            if len(rows) < 2000:
                break

        log.info(f"[Categorize] Categorized {total_categorized} products total")
        return {"categorized": total_categorized}
    finally:
        conn.close()


def _reembed_enriched(conn, count: int):
    """Re-embed recently enriched products to include LLM tags."""
    global embeddings, product_ids, product_store_ids

    rows = conn.execute("""
        SELECT id, storeId, nameLt, nameEn, categoryLt, categoryEn, brand, enrichment
        FROM Product WHERE enrichment IS NOT NULL
        ORDER BY enrichedAt DESC LIMIT ?
    """, (count,)).fetchall()

    if not rows:
        return

    id_to_idx = {pid: i for i, pid in enumerate(product_ids)}
    texts = []
    indices = []
    for row in rows:
        if row["id"] in id_to_idx:
            texts.append(_build_composite_text(row))
            indices.append(id_to_idx[row["id"]])

    if texts:
        new_vecs = model.encode(texts, normalize_embeddings=True, show_progress_bar=False, batch_size=64)
        for i, idx in enumerate(indices):
            embeddings[idx] = new_vecs[i]
        save_embeddings()
        log.info(f"[Embed] Re-embedded {len(texts)} enriched products")


def _do_export() -> dict:
    """Export all product intelligence to a gzipped JSON file."""
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT p.id, p.externalId, p.storeId, p.nameEn, p.canonicalCategory,
                   p.enrichment, s.slug as storeSlug
            FROM Product p
            JOIN Store s ON s.id = p.storeId
        """).fetchall()

        id_to_idx = {pid: i for i, pid in enumerate(product_ids)}

        products_out = []
        for row in rows:
            entry: dict = {
                "externalId": row["externalId"],
                "storeSlug": row["storeSlug"],
            }
            if row["nameEn"]:
                entry["nameEn"] = row["nameEn"]
            if row["canonicalCategory"]:
                entry["canonicalCategory"] = row["canonicalCategory"]
            if row["enrichment"]:
                try:
                    entry["enrichment"] = json.loads(row["enrichment"]) if isinstance(row["enrichment"], str) else row["enrichment"]
                except (json.JSONDecodeError, TypeError):
                    pass
            # Include embedding as base64
            idx = id_to_idx.get(row["id"])
            if idx is not None and embeddings is not None:
                vec = embeddings[idx].astype(np.float32)
                entry["embedding"] = base64.b64encode(vec.tobytes()).decode("ascii")

            products_out.append(entry)

        artifact = {
            "version": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "model": MODEL_NAME,
            "embedding_dim": 384,
            "product_count": len(products_out),
            "categories": canonical_categories,
            "products": products_out,
        }

        with gzip.open(str(EXPORT_PATH), "wt", encoding="utf-8") as f:
            json.dump(artifact, f, ensure_ascii=False)

        size_mb = round(EXPORT_PATH.stat().st_size / (1024 * 1024), 2)
        log.info(f"[Export] Exported {len(products_out)} products to {EXPORT_PATH} ({size_mb} MB)")
        return {"exported": len(products_out), "path": str(EXPORT_PATH), "size_mb": size_mb}
    finally:
        conn.close()


def _do_import() -> dict:
    """Import product intelligence from the artifact file."""
    global embeddings, product_ids, product_store_ids

    if not EXPORT_PATH.exists():
        return {"imported": 0, "message": "No artifact file found"}

    log.info(f"[Import] Loading artifact from {EXPORT_PATH}...")
    with gzip.open(str(EXPORT_PATH), "rt", encoding="utf-8") as f:
        artifact = json.load(f)

    dim = artifact.get("embedding_dim", 384)
    products = artifact.get("products", [])

    conn = get_db_rw()
    try:
        # Build lookup: (storeSlug, externalId) → product row in DB
        db_rows = conn.execute("""
            SELECT p.id, p.storeId, p.externalId, s.slug as storeSlug
            FROM Product p JOIN Store s ON s.id = p.storeId
        """).fetchall()

        db_lookup = {(r["storeSlug"], r["externalId"]): r for r in db_rows}

        new_ids = []
        new_store_ids = []
        new_vecs = []
        applied = 0

        for entry in products:
            key = (entry.get("storeSlug"), entry.get("externalId"))
            db_row = db_lookup.get(key)
            if not db_row:
                continue

            pid = db_row["id"]
            sid = db_row["storeId"]

            # Apply canonical category and enrichment to DB
            updates = []
            params = []
            if entry.get("canonicalCategory"):
                updates.append("canonicalCategory = ?")
                params.append(entry["canonicalCategory"])
            if entry.get("enrichment"):
                updates.append("enrichment = ?")
                params.append(json.dumps(entry["enrichment"]) if isinstance(entry["enrichment"], dict) else entry["enrichment"])
                updates.append("enrichedAt = datetime('now')")

            if updates:
                params.append(pid)
                conn.execute(f"UPDATE Product SET {', '.join(updates)} WHERE id = ?", params)

            # Collect embedding
            if entry.get("embedding"):
                vec_bytes = base64.b64decode(entry["embedding"])
                vec = np.frombuffer(vec_bytes, dtype=np.float32)
                if len(vec) == dim:
                    new_ids.append(pid)
                    new_store_ids.append(sid)
                    new_vecs.append(vec)

            applied += 1

        conn.commit()

        # Rebuild embedding index
        if new_vecs:
            embeddings = np.array(new_vecs, dtype=np.float32)
            product_ids = new_ids
            product_store_ids = new_store_ids
            save_embeddings()

        log.info(f"[Import] Applied {applied} products, {len(new_vecs)} embeddings")
        return {"imported": applied, "embeddings": len(new_vecs)}
    finally:
        conn.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
