"""
Embedder service — semantic search, category normalization, LLM enrichment, and data export
for Lithuanian grocery products.

Endpoints:
  POST /embed-batch   — generate embeddings for product texts
  POST /search        — semantic search: query → ranked product IDs
  POST /categorize    — assign canonical categories to products
  POST /enrich        — LLM-enrich new products via Groq
    POST /process       — full pipeline: embed → enrich → group → export
  POST /export        — export product-intelligence.json.gz
  POST /import        — import from product-intelligence artifact
  GET  /health        — readiness check
"""

import json, gzip, base64, os, time, sqlite3, logging, asyncio, unicodedata, re
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
BRANDS_PATH = Path(__file__).parent / "brands.json"
EXPORT_PATH = DATA_DIR / "product-intelligence.json.gz"
ENRICH_VERSION = 2  # Increment to force re-enrichment of all products

# --- Ollama (local LLM) config ---
OLLAMA_URL = os.getenv("OLLAMA_URL", "")  # e.g. http://192.168.1.100:11434
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b")
OLLAMA_BATCH_SIZE = int(os.getenv("OLLAMA_BATCH_SIZE", "20"))
OLLAMA_CHUNK_SIZE = int(os.getenv("OLLAMA_CHUNK_SIZE", "30"))
OLLAMA_PARALLEL_REQUESTS = int(os.getenv("OLLAMA_PARALLEL_REQUESTS", "2"))


# --- Gemini config ---
# Support up to 3 Gemini API keys — each key spawns an independent swarm worker
GEMINI_API_KEYS: list[str] = [
    k for k in [
        os.getenv("GEMINI_API_KEY", ""),
        os.getenv("GEMINI2_API_KEY", ""),
        os.getenv("GEMINI3_API_KEY", ""),
    ]
    if k
]
GEMINI_API_KEY = GEMINI_API_KEYS[0] if GEMINI_API_KEYS else ""  # keep for compat
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
GEMINI_BATCH_SIZE = int(os.getenv("GEMINI_BATCH_SIZE", "250"))
GEMINI_THINKING_BUDGET = int(os.getenv("GEMINI_THINKING_BUDGET", "0"))   # 0 = disabled (fastest)
GEMINI_WAIT_SECONDS = int(os.getenv("GEMINI_WAIT_SECONDS", "180"))       # 3 min between runs
GEMINI_RPM = int(os.getenv("GEMINI_RPM", "10"))                          # free tier: 10 RPM/key

# --- Global state ---
model = None  # SentenceTransformer, loaded at startup
embeddings: Optional[np.ndarray] = None  # shape (N, 384)
product_ids: list[int] = []
product_store_ids: list[int] = []  # parallel array: storeId for each product
canonical_categories: list[dict] = []
category_embeddings: Optional[np.ndarray] = None
known_brands: list[dict] = []  # loaded from brands.json


def _run_db_migrations():
    """Add new columns to existing DB if they don't exist (idempotent)."""
    conn = get_db_rw()
    try:
        existing = {row[1] for row in conn.execute("PRAGMA table_info(Product)").fetchall()}
        migrations = [
            ("subcategory", "TEXT"),
            ("enrichmentVersion", "INTEGER"),
        ]
        for col, col_type in migrations:
            if col not in existing:
                conn.execute(f"ALTER TABLE Product ADD COLUMN {col} {col_type}")
                log.info(f"[Migration] Added column Product.{col}")
        existing_gli = {row[1] for row in conn.execute("PRAGMA table_info(GroceryListItem)").fetchall()}
        gli_migrations = [
            ("pinnedProductGroupId", "INTEGER"),
            ("preferredBrand", "TEXT"),
        ]
        for col, col_type in gli_migrations:
            if col not in existing_gli:
                conn.execute(f"ALTER TABLE GroceryListItem ADD COLUMN {col} {col_type}")
                log.info(f"[Migration] Added column GroceryListItem.{col}")
        conn.commit()
    finally:
        conn.close()


def load_brands():
    global known_brands
    if not BRANDS_PATH.exists():
        log.warning("brands.json not found, skipping brand loading")
        return
    with open(BRANDS_PATH) as f:
        known_brands = json.load(f)
    log.info(f"Loaded {len(known_brands)} known brands")


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
    _run_db_migrations()
    load_categories()
    load_brands()
    load_embeddings()
    # Auto-import if no embeddings but artifact exists
    if len(product_ids) == 0 and EXPORT_PATH.exists():
        log.info("No local embeddings found, importing from artifact...")
        _do_import()
    _gemini_state["scheduler_active"] = False
    # Reset products that were marked as attempted (enrichedAt set) but have no actual data
    # These were falsely marked by the old failure-handling code and should be retried
    try:
        conn = get_db_rw()
        result = conn.execute(
            "UPDATE Product SET enrichedAt = NULL, enrichmentVersion = NULL "
            "WHERE enrichment IS NULL AND enrichedAt IS NOT NULL"
        )
        count = result.rowcount
        conn.commit()
        conn.close()
        if count > 0:
            log.info(f"[Startup] Reset {count} products with missing enrichment data — will retry")
    except Exception as e:
        log.warning(f"[Startup] Cleanup query failed: {e}")
    if GEMINI_API_KEYS:
        log.info(f"[Gemini] {len(GEMINI_API_KEYS)} API key(s) configured. Use /bulk-enrich to start enrichment.")
    else:
        log.info("[Gemini] No API keys configured")
    yield
    log.info("Shutting down")
    _gemini_state["scheduler_active"] = False


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
    provider: str = "groq"       # "groq" or "ollama"
    ollama_url: str = ""
    ollama_model: str = ""


async def _llm_chat(
    client: httpx.AsyncClient,
    *,
    provider: str,
    system_prompt: str,
    user_prompt: str,
    max_tokens: int = 4000,
    json_mode: bool = True,
    ollama_url: str = "",
    ollama_model: str = "",
) -> dict | None:
    """Unified LLM chat call for Groq or Ollama (OpenAI-compatible API).
    Returns parsed JSON content dict, or None on error."""
    if provider == "ollama":
        base_url = (ollama_url or OLLAMA_URL).rstrip("/")
        model_name = ollama_model or OLLAMA_MODEL
        url = f"{base_url}/v1/chat/completions"
        headers = {"Content-Type": "application/json"}
    else:
        if not GROQ_API_KEY:
            return None
        url = GROQ_URL
        model_name = GROQ_MODEL
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        }

    payload: dict = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.1,
        "max_tokens": max_tokens,
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}

    try:
        resp = await client.post(url, json=payload, headers=headers)

        if resp.status_code == 429:
            retry_after = min(float(resp.headers.get("retry-after", "10")) + 2, 30.0)
            log.warning(f"[LLM:{provider}] Rate limited, waiting {retry_after}s")
            await asyncio.sleep(retry_after)
            resp = await client.post(url, json=payload, headers=headers)

        if resp.status_code != 200:
            log.warning(f"[LLM:{provider}] Returned {resp.status_code}: {resp.text[:200]}")
            return None

        result = resp.json()
        content = result["choices"][0]["message"]["content"]
        return json.loads(content)

    except Exception as e:
        log.warning(f"[LLM:{provider}] Error: {e}")
        return None


# --- Endpoints ---

@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": MODEL_NAME,
        "embeddings_count": len(product_ids),
        "categories_count": len(canonical_categories),
    }


@app.get("/ollama-health")
async def ollama_health(url: str = ""):
    """Check Ollama connectivity and list available models."""
    base_url = (url or OLLAMA_URL).rstrip("/")
    if not base_url:
        return {"status": "not_configured", "error": "No Ollama URL provided"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(f"{base_url}/api/tags")
            if resp.status_code != 200:
                return {"status": "error", "error": f"Ollama returned {resp.status_code}", "url": base_url}
            data = resp.json()
            models = [m.get("name", "") for m in data.get("models", [])]
            return {"status": "ok", "url": base_url, "models": models}
    except httpx.ConnectError:
        return {"status": "error", "error": "Cannot connect to Ollama — is it running?", "url": base_url}
    except Exception as e:
        return {"status": "error", "error": str(e), "url": base_url}


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
    provider = req.provider or "groq"
    is_ollama = provider == "ollama"

    if not is_ollama and not GROQ_API_KEY:
        raise HTTPException(503, "GROQ_API_KEY not set — LLM translation unavailable")
    if is_ollama and not (req.ollama_url or OLLAMA_URL):
        raise HTTPException(503, "Ollama URL not configured")

    if len(req.texts) == 0:
        return {"translations": []}

    chunk_size = OLLAMA_CHUNK_SIZE if is_ollama else 5
    timeout = 600.0 if is_ollama else 120.0
    all_translations: list[str] = [""] * len(req.texts)

    async def process_chunk(client: httpx.AsyncClient, chunk_start: int, chunk: list[str]) -> None:
        numbered = "\n".join(f"{i+1}. {t}" for i, t in enumerate(chunk))
        user_prompt = f"Translate these {len(chunk)} Lithuanian grocery product names to English:\n\n{numbered}"

        data = await _llm_chat(
            client,
            provider=provider,
            system_prompt=TRANSLATE_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            max_tokens=1000 if not is_ollama else 8000,
            ollama_url=req.ollama_url,
            ollama_model=req.ollama_model,
        )

        if data is None:
            log.warning(f"[Translate] {provider} returned no data, falling back to originals for chunk")
            all_translations[chunk_start:chunk_start + len(chunk)] = chunk
            return

        translations = data.get("translations", [])
        if not isinstance(translations, list):
            log.warning(f"[Translate] {provider} returned non-list, falling back to originals for chunk")
            all_translations[chunk_start:chunk_start + len(chunk)] = chunk
            return

        # Accept partial results: use what we got, keep originals for the rest
        if len(translations) != len(chunk):
            log.info(f"[Translate] Got {len(translations)}/{len(chunk)} translations, using partial results")
            for i in range(len(translations), len(chunk)):
                translations.append(chunk[i])  # keep original for missing

        all_translations[chunk_start:chunk_start + len(chunk)] = translations[:len(chunk)]

    async with httpx.AsyncClient(timeout=timeout) as client:
        if is_ollama and OLLAMA_PARALLEL_REQUESTS > 1:
            sem = asyncio.Semaphore(OLLAMA_PARALLEL_REQUESTS)

            async def run_with_limit(chunk_start: int, chunk: list[str]) -> None:
                async with sem:
                    await process_chunk(client, chunk_start, chunk)

            tasks = []
            for chunk_start in range(0, len(req.texts), chunk_size):
                chunk = req.texts[chunk_start:chunk_start + chunk_size]
                tasks.append(asyncio.create_task(run_with_limit(chunk_start, chunk)))
            await asyncio.gather(*tasks)
        else:
            for chunk_start in range(0, len(req.texts), chunk_size):
                chunk = req.texts[chunk_start:chunk_start + chunk_size]
                await process_chunk(client, chunk_start, chunk)
                if not is_ollama and chunk_start + chunk_size < len(req.texts):
                    await asyncio.sleep(12.0)  # 6000 TPM limit: ~500 tokens/request, need 12s gap

    return {"translations": all_translations}


class EnrichRequest(BaseModel):
    provider: str = "groq"       # "groq" or "ollama"
    ollama_url: str = ""
    ollama_model: str = ""


@app.post("/enrich")
async def enrich(req: EnrichRequest | None = None):
    """LLM-enrich products that have no enrichedAt timestamp."""
    provider = (req.provider if req else None) or "groq"
    is_ollama = provider == "ollama"
    ollama_url = (req.ollama_url if req else "") or ""
    ollama_model = (req.ollama_model if req else "") or ""

    if not is_ollama and not GROQ_API_KEY:
        return {"enriched": 0, "message": "GROQ_API_KEY not set", "skipped": True}
    if is_ollama and not (ollama_url or OLLAMA_URL):
        return {"enriched": 0, "message": "Ollama URL not configured", "skipped": True}

    batch_size = OLLAMA_BATCH_SIZE if is_ollama else GROQ_BATCH_SIZE
    timeout = 600.0 if is_ollama else 60.0

    conn = get_db_rw()
    try:
        rows = conn.execute(
            "SELECT id, nameLt, nameEn, categoryLt, categoryEn, brand FROM Product "
            "WHERE enrichmentVersion IS NULL OR enrichmentVersion < ? LIMIT 500",
            (ENRICH_VERSION,)
        ).fetchall()

        if not rows:
            return {"enriched": 0, "message": "No products to enrich"}

        log.info(f"[Enrich] Enriching {len(rows)} products via {provider} (batch_size={batch_size})...")
        enriched_count = 0
        failed_count = 0

        async with httpx.AsyncClient(timeout=timeout) as client:
            for batch_start in range(0, len(rows), batch_size):
                batch = rows[batch_start:batch_start + batch_size]

                product_lines = []
                for i, row in enumerate(batch):
                    product_lines.append(f"Product {i+1}: {_build_product_text(row)}")
                batch_prompt = "\n".join(product_lines)

                data = await _llm_chat(
                    client,
                    provider=provider,
                    system_prompt=BULK_ENRICH_SYSTEM_PROMPT,
                    user_prompt=batch_prompt,
                    max_tokens=4000,
                    ollama_url=ollama_url,
                    ollama_model=ollama_model,
                )

                if data is None:
                    failed_count += len(batch)
                    continue

                items = data.get("results") if isinstance(data, dict) else data
                if not isinstance(items, list):
                    items = [data] if isinstance(data, dict) and "name_clean" in data else []

                _db_save_batch([dict(r) for r in batch], items)
                enriched_count += sum(
                    1 for i, row in enumerate(batch)
                    if i < len(items) and isinstance(items[i], dict) and "name_clean" in items[i]
                )
                failed_count += len(batch) - (len(items) if isinstance(items, list) else 0)
                if not is_ollama:
                    await asyncio.sleep(GROQ_REQUEST_INTERVAL)

        log.info(f"[Enrich] Enriched {enriched_count}/{len(rows)} products ({failed_count} failed)")

        if enriched_count > 0:
            _reembed_enriched(conn, enriched_count)

        return {"enriched": enriched_count, "failed": failed_count, "total_pending": len(rows)}
    finally:
        conn.close()


class ProcessRequest(BaseModel):
    provider: str = "groq"
    ollama_url: str = ""
    ollama_model: str = ""


@app.post("/process")
async def process(req: ProcessRequest | None = None):
    """Full pipeline: embed new products → enrich → group → export."""
    results = {}

    # Step 1: Embed new/updated products
    results["embed"] = _embed_new_products()

    # Step 2: LLM enrichment (provider determined by request or env)
    provider = (req.provider if req else None) or "groq"
    has_llm = (
        (provider == "ollama" and ((req and req.ollama_url) or OLLAMA_URL))
        or (provider == "groq" and (GROQ_API_KEY or _has_multi_provider_keys()))
    )
    if has_llm:
        if provider == "groq" and _has_multi_provider_keys():
            results["enrich"] = await _run_bulk_enrich()
        else:
            enrich_req = EnrichRequest(
                provider=provider,
                ollama_url=(req.ollama_url if req else "") or "",
                ollama_model=(req.ollama_model if req else "") or "",
            )
            enrich_result = await enrich(enrich_req)
            results["enrich"] = enrich_result
    else:
        results["enrich"] = {"skipped": True, "reason": f"No {provider} configuration available"}

    # Step 3: Group similar products
    results["group"] = _do_grouping()

    # Step 4: Export
    results["export"] = _do_export()

    return results


@app.post("/export")
def export_data():
    return _do_export()


@app.post("/import")
def import_data():
    return _do_import()


@app.get("/categories-summary")
def categories_summary():
    """Return all canonical categories with product counts and distinct subcategories."""
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT canonicalCategory, subcategory, COUNT(*) as cnt
            FROM Product
            WHERE canonicalCategory IS NOT NULL
            GROUP BY canonicalCategory, subcategory
            ORDER BY canonicalCategory, cnt DESC
        """).fetchall()

        # Build map: category_id → { count, subcategories }
        cat_map: dict[str, dict] = {}
        for row in rows:
            cat_id = row["canonicalCategory"]
            sub = row["subcategory"]
            cnt = row["cnt"]
            if cat_id not in cat_map:
                cat_map[cat_id] = {"count": 0, "subcategories": []}
            cat_map[cat_id]["count"] += cnt
            if sub:
                cat_map[cat_id]["subcategories"].append({"name": sub, "count": cnt})

        # Merge with category metadata
        result = []
        for cat in canonical_categories:
            cid = cat["id"]
            info = cat_map.get(cid, {"count": 0, "subcategories": []})
            result.append({
                "id": cid,
                "en": cat["en"],
                "lt": cat["lt"],
                "count": info["count"],
                "subcategories": info["subcategories"][:20],  # top 20 subcategories
            })

        return {"categories": result}
    finally:
        conn.close()


@app.get("/category/{category_id}/brands")
def category_brands(category_id: str):
    """Return distinct brands for a category with product counts and price ranges."""
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT p.brand, p.subcategory, COUNT(DISTINCT p.id) as product_count,
                   MIN(pr.regularPrice) as min_price, MAX(pr.regularPrice) as max_price,
                   p.imageUrl
            FROM Product p
            LEFT JOIN PriceRecord pr ON pr.productId = p.id
            WHERE p.canonicalCategory = ? AND p.brand IS NOT NULL
            GROUP BY p.brand, p.subcategory
            ORDER BY product_count DESC
            LIMIT 50
        """, (category_id,)).fetchall()

        brands: dict[str, dict] = {}
        for row in rows:
            brand = row["brand"]
            if brand not in brands:
                brands[brand] = {
                    "name": brand,
                    "product_count": 0,
                    "min_price": None,
                    "max_price": None,
                    "subcategories": [],
                    "sample_image": row["imageUrl"],
                }
            brands[brand]["product_count"] += row["product_count"]
            if row["min_price"] is not None:
                brands[brand]["min_price"] = min(
                    row["min_price"],
                    brands[brand]["min_price"] or row["min_price"]
                )
            if row["max_price"] is not None:
                brands[brand]["max_price"] = max(
                    row["max_price"],
                    brands[brand]["max_price"] or row["max_price"]
                )
            if row["subcategory"] and row["subcategory"] not in brands[brand]["subcategories"]:
                brands[brand]["subcategories"].append(row["subcategory"])

        return {"brands": sorted(brands.values(), key=lambda b: -b["product_count"])}
    finally:
        conn.close()


# --- Bulk enrichment via Groq API ---
# Runs as a background task so it survives client disconnects
# --- Concurrent Multi-Provider Swarm (Llama 3.1 8B Edition) ---

_bulk_enrich_state = {
    "running": False,
    "total": 0,
    "done": 0,
    "failed": 0,
    "error": None,
    "active_workers": 0,
    "started_at": None,
    "finished_at": None,
}

# Available models per provider (first = default)
# Swarm uses Gemini workers only
MULTI_PROVIDERS: list[dict] = []

# Valid canonical category IDs — LLM must pick one of these
_CATEGORY_IDS = [
    "poultry","beef","pork","lamb","minced-meat","deli-meat","fish-seafood",
    "milk","cheese","yogurt","butter-cream","cottage-cheese","eggs",
    "bread","bakery","fruits","vegetables","salads-herbs","mushrooms","frozen-food",
    "rice-grains","pasta","flour-baking","oil-vinegar","canned-food","sauces-condiments",
    "snacks","sweets-chocolate","cereals","honey-jam",
    "tea","coffee","juice","water","soda-soft-drinks","beer","wine","spirits",
    "baby-food","pet-food","cleaning","laundry","paper-products","personal-care","health",
    "ready-meals","spices","other",
]
_CATEGORY_IDS_SET = set(_CATEGORY_IDS)

BULK_ENRICH_SYSTEM_PROMPT = """You are an expert grocery product analyst specializing in Lithuanian grocery stores (IKI, RIMI, Barbora, Promo Cash & Carry).

For EACH product, return a JSON object. Return all products as: {"results": [{...}, {...}]}

Each object MUST have these fields:
- name_clean: Clean English product name. Format: "[Brand] [Description] [Size]". Example: "Rokiškio Fresh Milk 2.5% 1L"
- name_lt_clean: Same format but in clean Lithuanian. Example: "Rokiškio Šviežias Pienas 2.5% 1L"
- brand: Extracted brand name (string or null). Rules:
    * "Rokiškio pienas" → "Rokiškio"
    * "IKI vištiena" → "IKI"
    * "RIMI sultys" → "RIMI"
    * "Žemaitijos sviestas" → "Žemaitijos"
    * "Dvaro grietinėlė" → "Dvaro"
    * "Coca-Cola" → "Coca-Cola", "Pepsi" → "Pepsi", "Danone" → "Danone"
    * Leading ALLCAPS words are usually brands: "ALMA vanduo" → "Alma"
    * If truly no brand, return null
- canonical_category: MUST be one of these exact IDs: """ + ", ".join(_CATEGORY_IDS) + """
    Key rules:
    * Still/sparkling/mineral water → "water"
    * Flavored water with sugar, lemonade, cola, energy drinks → "soda-soft-drinks"
    * Fresh/UHT/plant milk → "milk", kefir/yogurt → "yogurt"
    * Any beer (incl. non-alcoholic) → "beer", wine → "wine", spirits/vodka → "spirits"
    * Cleaning sprays/powders → "cleaning", laundry detergent/softener → "laundry"
    * Toilet paper/tissues/napkins → "paper-products"
    * Shampoo/soap/deodorant → "personal-care"
    * Dog/cat food → "pet-food"
    * Deli meats/sausages/ham → "deli-meat", minced/ground meat → "minced-meat"
- subcategory: More specific type within category (string). Examples:
    * water: "still", "sparkling", "flavored", "mineral"
    * milk: "fresh", "UHT", "oat milk", "lactose-free", "plant-based"
    * cheese: "hard", "soft", "fresh", "blue", "cream cheese"
    * meat/poultry: "breast", "drumsticks", "thighs", "whole", "marinated", "smoked"
    * juice: "100% juice", "nectar", "smoothie", "concentrate"
    * beer: "lager", "ale", "wheat beer", "non-alcoholic", "dark"
    * bread: "white", "rye", "whole grain", "sourdough", "toast"
    * yogurt: "plain", "fruit", "drinking", "Greek-style", "kefir"
    * If no meaningful subcategory, use the canonical_category en name
- is_food: boolean (false for cleaning, laundry, pet-food, paper-products, personal-care, health)
- tags_en: 6-8 English search terms a shopper would use (include brand, product type, variants)
- tags_lt: 6-8 Lithuanian search terms
- attributes: object with filterable properties relevant to this product type:
    * water: {"type": "still|sparkling|flavored", "flavor": "lemon|plain|...", "size_ml": 500}
    * milk: {"fat_percent": 2.5, "type": "fresh|UHT|lactose-free|oat"}
    * cheese: {"type": "hard|soft|fresh", "milk_source": "cow|goat|sheep"}
    * meat: {"cut": "breast|drumstick|...", "state": "raw|marinated|smoked|frozen"}
    * beer: {"type": "lager|ale|...", "alcohol_percent": 5.0, "non_alcoholic": false}
    * Other products: include the most useful 1-3 filterable attributes

CRITICAL: Return ONLY valid JSON. No markdown. No explanations. Exactly one object per input product in "results" array."""

def _normalize_brand(brand: str | None) -> str | None:
    """Normalize brand name: strip excess whitespace, title-case if allcaps."""
    if not brand:
        return None
    brand = brand.strip()
    if not brand:
        return None
    # If fully uppercase (e.g. "IKI", "RIMI") keep as-is (they're store names)
    if brand.isupper() and len(brand) <= 6:
        return brand
    # If allcaps word longer than 6 chars, title-case it
    if brand.isupper():
        brand = brand.title()
    return brand


def _validate_canonical_category(cat: str | None) -> str | None:
    """Return cat if it's a valid known ID, else None."""
    if cat and cat in _CATEGORY_IDS_SET:
        return cat
    return None


def _db_save_batch(rows: list, items: list, source: str = "auto"):
    """Save successful enrichment results to DB. Only saves rows that have valid LLM data.
    Failed/empty items are silently skipped — they remain unenriched and will be retried."""
    conn = get_db_rw()
    try:
        for i, row in enumerate(rows):
            if i < len(items) and isinstance(items[i], dict) and "name_clean" in items[i]:
                item = items[i]
                name_clean = item.get("name_clean") or None
                brand = _normalize_brand(item.get("brand"))
                canonical_cat = _validate_canonical_category(item.get("canonical_category"))
                subcategory = item.get("subcategory") or None

                conn.execute(
                    """UPDATE Product SET
                        enrichment = ?,
                        enrichedAt = datetime('now'),
                        enrichmentVersion = ?,
                        enrichmentSource = ?,
                        nameEn = COALESCE(NULLIF(?, ''), nameEn),
                        brand = COALESCE(NULLIF(?, ''), brand),
                        canonicalCategory = COALESCE(NULLIF(?, ''), canonicalCategory),
                        subcategory = COALESCE(NULLIF(?, ''), subcategory)
                    WHERE id = ?""",
                    (
                        json.dumps(item),
                        ENRICH_VERSION,
                        source,
                        name_clean,
                        brand,
                        canonical_cat,
                        subcategory,
                        row["id"],
                    )
                )
        conn.commit()
    finally:
        conn.close()

# --- Gemini auto-enrichment ---

_gemini_state: dict = {
    "scheduler_active": False,
    "running": False,
    "total_enriched": 0,
    "last_run_at": None,
    "last_run_enriched": 0,
    "last_run_failed": 0,
    "error": None,
}


async def _gemini_call(api_key: str, rows: list) -> tuple[list, str | None]:
    """Call Gemini API for a batch of rows. Returns (items, error_msg).
    Uses google-genai SDK. Products NOT marked in DB on failure — caller handles retries."""
    from google import genai
    from google.genai import types

    lines = [f"Product {i+1}: {_build_product_text(row)}" for i, row in enumerate(rows)]
    user_prompt = "\n".join(lines)

    cfg_kwargs: dict = {
        "system_instruction": BULK_ENRICH_SYSTEM_PROMPT,
        "temperature": 1.0,
        "max_output_tokens": 65536,
        "response_mime_type": "application/json",
    }
    if GEMINI_THINKING_BUDGET > 0:
        cfg_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=GEMINI_THINKING_BUDGET)

    client = genai.Client(api_key=api_key)
    try:
        response = await client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=user_prompt,
            config=types.GenerateContentConfig(**cfg_kwargs),
        )
        text = response.text
        parsed = json.loads(text)
        items = parsed.get("results", [])
        if not isinstance(items, list):
            items = [parsed]
        return items, None
    except Exception as e:
        return [], str(e)


async def _gemini_enrich_batch(rows: list) -> tuple[int, int, str | None]:
    """Single-key Gemini batch (used by scheduler and run-once). Returns (enriched, failed, error)."""
    if not GEMINI_API_KEY:
        return 0, len(rows), "No GEMINI_API_KEY configured"
    items, err = await _gemini_call(GEMINI_API_KEY, rows)
    if err:
        log.error(f"[Gemini] Batch error: {err}")
        return 0, len(rows), err
    _db_save_batch(rows, items, source="auto")
    enriched = sum(1 for i, r in enumerate(rows) if i < len(items) and isinstance(items[i], dict) and "name_clean" in items[i])
    failed = len(rows) - enriched
    log.info(f"[Gemini] Enriched {enriched} products ({failed} mismatched/failed — will retry).")
    return enriched, failed, None


async def _gemini_worker(api_key: str, worker_id: int, queue: asyncio.Queue, state: dict):
    """Queue-based Gemini worker. One per API key. Shares queue with other workers."""
    label = f"Gemini-{worker_id}"
    log.info(f"[{label}] Worker started (model={GEMINI_MODEL}, ~{GEMINI_RPM} RPM)")
    state["active_workers"] += 1
    delay = (60.0 / GEMINI_RPM) * 1.5  # conservative pacing

    while state["running"]:
        try:
            batch = await queue.get()
        except asyncio.CancelledError:
            break

        rows = batch["rows"]
        retries = batch.get("retries", 0)

        if retries > 3:
            log.warning(f"[{label}] Batch dropped after 3 retries — products will retry next run")
            state["failed"] += len(rows)
            queue.task_done()
            continue

        items, err = await _gemini_call(api_key, rows)

        if err:
            log.warning(f"[{label}] Error (retry {retries+1}/3): {err[:120]}")
            await queue.put({"rows": rows, "retries": retries + 1})
            queue.task_done()
            await asyncio.sleep(delay * 2)
            continue

        _db_save_batch(rows, items, source="auto")
        enriched = sum(1 for i, r in enumerate(rows) if i < len(items) and isinstance(items[i], dict) and "name_clean" in items[i])
        state["done"] += enriched
        state["failed"] += (len(rows) - enriched)
        log.info(f"[{label}] Enriched {enriched}/{len(rows)} products ({state['done']}/{state['total']} total)")
        queue.task_done()
        await asyncio.sleep(delay)

    state["active_workers"] -= 1
    log.info(f"[{label}] Worker stopped")


async def _gemini_scheduler():
    """Background loop: fetch GEMINI_BATCH_SIZE unenriched products → Gemini → wait → repeat."""
    global _gemini_state
    log.info("[Gemini Scheduler] Started")
    _gemini_state["scheduler_active"] = True

    while _gemini_state["scheduler_active"]:
        if not GEMINI_API_KEY:
            log.warning("[Gemini Scheduler] GEMINI_API_KEY not set, checking again in 60s")
            await asyncio.sleep(60)
            continue

        conn = get_db()
        rows = conn.execute(
            "SELECT id, nameLt, nameEn, categoryLt, categoryEn, brand FROM Product "
            "WHERE enrichmentVersion IS NULL OR enrichmentVersion < ? LIMIT ?",
            (ENRICH_VERSION, GEMINI_BATCH_SIZE),
        ).fetchall()
        conn.close()
        rows = [dict(r) for r in rows]

        if not rows:
            log.info("[Gemini Scheduler] Nothing to enrich, checking again in 3 min")
            await asyncio.sleep(GEMINI_WAIT_SECONDS)
            continue

        log.info(f"[Gemini Scheduler] Enriching {len(rows)} products…")
        _gemini_state["running"] = True
        _gemini_state["last_run_at"] = time.time()
        _gemini_state["error"] = None

        enriched, failed, err_msg = await _gemini_enrich_batch(rows)

        _gemini_state["running"] = False
        _gemini_state["total_enriched"] += enriched
        _gemini_state["last_run_enriched"] = enriched
        _gemini_state["last_run_failed"] = failed
        if err_msg:
            _gemini_state["error"] = err_msg

        log.info(f"[Gemini Scheduler] Run done — enriched {enriched}, failed {failed}. Waiting {GEMINI_WAIT_SECONDS}s…")
        await asyncio.sleep(GEMINI_WAIT_SECONDS)

    log.info("[Gemini Scheduler] Stopped")


async def _gemini_run_batch_once():
    """Single Gemini enrichment batch — used by manual trigger and swarm mode."""
    global _gemini_state
    conn = get_db()
    rows = conn.execute(
        "SELECT id, nameLt, nameEn, categoryLt, categoryEn, brand FROM Product "
        "WHERE enrichmentVersion IS NULL OR enrichmentVersion < ? LIMIT ?",
        (ENRICH_VERSION, GEMINI_BATCH_SIZE),
    ).fetchall()
    conn.close()
    rows = [dict(r) for r in rows]
    if not rows:
        return
    _gemini_state["running"] = True
    _gemini_state["last_run_at"] = time.time()
    _gemini_state["error"] = None
    enriched, failed, err_msg = await _gemini_enrich_batch(rows)
    _gemini_state["running"] = False
    _gemini_state["total_enriched"] += enriched
    _gemini_state["last_run_enriched"] = enriched
    _gemini_state["last_run_failed"] = failed
    if err_msg:
        _gemini_state["error"] = err_msg


def _extract_json_object(text: str) -> str | None:
    """Extract first complete JSON object from text, tolerant of extra prose/fences."""
    if not text:
        return None

    s = text.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\\s*", "", s, flags=re.IGNORECASE)
        if s.endswith("```"):
            s = s[:-3].strip()
    if s.lower().startswith("json"):
        s = s[4:].strip()

    start = s.find("{")
    if start == -1:
        return None

    depth = 0
    in_string = False
    escaped = False
    for i, ch in enumerate(s[start:], start=start):
        if in_string:
            if escaped:
                escaped = False
                continue
            if ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return s[start:i + 1]

    return None


def _parse_llm_json_payload(content: str) -> dict | None:
    """Parse JSON object from LLM response text with light recovery."""
    try:
        parsed = json.loads(content)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        pass

    obj = _extract_json_object(content)
    if not obj:
        return None

    try:
        parsed = json.loads(obj)
        return parsed if isinstance(parsed, dict) else None
    except Exception:
        return None


async def _api_worker(provider: dict, queue: asyncio.Queue, state: dict, model_override: str | None = None):
    """Pulls batches from the queue and hits a specific free API."""
    api_key = os.getenv(provider["env"])
    if not api_key:
        log.info(f"Skipping {provider['name']} worker: {provider['env']} missing.")
        return

    model_name = model_override or provider["model"]
    log.info(f"Deployed {provider['name']} worker (Model: {model_name}, Limit: {provider['rpm']} RPM)")
    state["active_workers"] += 1

    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    # 1.5× safety factor — slow but steady, avoids rate limit cascades
    delay = (60.0 / provider["rpm"]) * 1.5

    async with httpx.AsyncClient(timeout=60.0) as client:
        while state["running"]:
            try:
                batch = await queue.get()
            except asyncio.CancelledError:
                break
                
            rows = batch["rows"]
            retries = batch.get("retries", 0)

            if retries > 3:
                log.warning(f"[{provider['name']}] Batch dropped after 3 retries — products will retry next run")
                state["failed"] += len(rows)
                queue.task_done()
                continue

            # Build user prompt
            lines =[f"Product {i+1}: {_build_product_text(row)}" for i, row in enumerate(rows)]
            user_prompt = "\n".join(lines)

            payload = {
                "model": model_name,
                "messages":[
                    {"role": "system", "content": BULK_ENRICH_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.1,
            }
            
            if provider.get("json_mode"):
                payload["response_format"] = {"type": "json_object"}

            try:
                resp = await client.post(provider["url"], json=payload, headers=headers)
                
                # Handling standard rate limiting
                if resp.status_code == 429:
                    retry_after = float(resp.headers.get("retry-after", "5"))
                    log.warning(f"[{provider['name']}] Rate limited. Waiting {retry_after}s...")
                    await asyncio.sleep(retry_after + 1)
                    await queue.put({"rows": rows, "retries": retries + 1}) # Put back in queue
                    queue.task_done()
                    continue
                    
                if resp.status_code != 200:
                    log.warning(f"[{provider['name']}] HTTP {resp.status_code}: {resp.text[:100]}")
                    await queue.put({"rows": rows, "retries": retries + 1})
                    queue.task_done()
                    await asyncio.sleep(delay)
                    continue

                content = resp.json()["choices"][0]["message"]["content"]
                parsed = _parse_llm_json_payload(content)
                if parsed is None:
                    raise ValueError("Could not parse LLM JSON response")
                items = parsed.get("results",[])
                
                # Fallback for weirdly formatted JSON
                if not isinstance(items, list):
                    items = [parsed]
                    
                _db_save_batch(rows, items)
                state["done"] += len(rows)
                log.info(f"[{provider['name']}] Enriched {len(rows)} products ({state['done']}/{state['total']} total).")
                
                queue.task_done()
                await asyncio.sleep(delay)

            except Exception as e:
                log.error(f"[{provider['name']}] Error: {str(e)}")
                await queue.put({"rows": rows, "retries": retries + 1})
                queue.task_done()
                await asyncio.sleep(delay)

    state["active_workers"] -= 1

def _has_multi_provider_keys() -> bool:
    return bool(GEMINI_API_KEYS)


@app.get("/providers")
async def list_providers():
    """List Gemini worker slots (one per configured API key)."""
    workers = [
        {
            "name": f"Gemini-{i + 1}",
            "configured": True,
            "default_model": GEMINI_MODEL,
            "models": GEMINI_MODELS,
            "rpm": GEMINI_RPM,
        }
        for i in range(len(GEMINI_API_KEYS))
    ]
    if not workers:
        workers = [{
            "name": "Gemini-1",
            "configured": False,
            "default_model": GEMINI_MODEL,
            "models": GEMINI_MODELS,
            "rpm": GEMINI_RPM,
        }]
    return {"providers": workers}


async def _run_bulk_enrich() -> dict:
    global _bulk_enrich_state
    if not GEMINI_API_KEYS:
        return {"skipped": True, "reason": "No Gemini API keys configured"}

    _bulk_enrich_state = {
        "running": True,
        "total": 0,
        "done": 0,
        "failed": 0,
        "active_workers": 0,
        "error": None,
        "started_at": time.time(),
        "finished_at": None,
    }
    await _bulk_enrich_manager()

    return {
        "enriched": _bulk_enrich_state["done"],
        "failed": _bulk_enrich_state["failed"],
        "total_pending": _bulk_enrich_state["total"],
        "workers": len(GEMINI_API_KEYS),
        "error": _bulk_enrich_state["error"],
    }


async def _bulk_enrich_manager(keys: list[str] | None = None, provider_list: list | None = None, provider_models: dict | None = None):
    """Coordinates the Gemini swarm queue. keys: list of Gemini API keys to use."""
    global _bulk_enrich_state
    state = _bulk_enrich_state
    active_keys = keys if keys is not None else GEMINI_API_KEYS

    conn = get_db()
    rows = conn.execute(
        "SELECT id, nameLt, nameEn, categoryLt, categoryEn, brand FROM Product "
        "WHERE enrichmentVersion IS NULL OR enrichmentVersion < ?",
        (ENRICH_VERSION,)
    ).fetchall()
    conn.close()

    total = len(rows)
    state["total"] = total

    if total == 0:
        log.info("[Coordinator] No products need enrichment.")
        state["running"] = False
        state["finished_at"] = time.time()
        return

    if not active_keys:
        state["error"] = "No Gemini API keys configured."
        state["running"] = False
        return

    # Fill queue — 15 products per batch
    queue: asyncio.Queue = asyncio.Queue()
    batch_size = 15
    for i in range(0, total, batch_size):
        chunk = [dict(r) for r in rows[i:i + batch_size]]
        queue.put_nowait({"rows": chunk, "retries": 0})

    log.info(f"[Coordinator] {queue.qsize()} batches queued, {len(active_keys)} Gemini worker(s)...")

    # Spawn one worker per API key
    workers = [
        asyncio.create_task(_gemini_worker(key, i + 1, queue, state))
        for i, key in enumerate(active_keys)
    ]

    await queue.join()

    state["running"] = False
    state["finished_at"] = time.time()
    for w in workers:
        w.cancel()
    log.info(f"[Coordinator] Done — enriched: {state['done']}, failed: {state['failed']}")

class BulkEnrichRequest(BaseModel):
    # Optionally limit to specific Gemini worker indices (1-based)
    worker_indices: list[int] | None = None
    # Also accepts "Gemini-1", "Gemini-2", etc. from the frontend provider list
    providers: list[str] | None = None
    # Legacy fields (ignored in Gemini-only mode)
    provider: str = "swarm"
    provider_models: dict[str, str] | None = None

@app.post("/bulk-enrich")
async def bulk_enrich(req: BulkEnrichRequest = BulkEnrichRequest()):
    global _bulk_enrich_state
    if _bulk_enrich_state["running"]:
        return {"error": "Swarm is already running"}

    if not GEMINI_API_KEYS:
        return {"error": "No Gemini API keys configured (GEMINI_API_KEY, GEMINI2_API_KEY, GEMINI3_API_KEY)"}

    # Resolve keys from providers list ("Gemini-1" → index 1) or worker_indices
    if req.providers:
        indices = []
        for name in req.providers:
            if name.lower().startswith("gemini-"):
                try:
                    indices.append(int(name.split("-")[1]))
                except (IndexError, ValueError):
                    pass
        keys = [GEMINI_API_KEYS[i - 1] for i in indices if 0 < i <= len(GEMINI_API_KEYS)] if indices else GEMINI_API_KEYS
    elif req.worker_indices:
        keys = [GEMINI_API_KEYS[i - 1] for i in req.worker_indices if 0 < i <= len(GEMINI_API_KEYS)]
    else:
        keys = GEMINI_API_KEYS

    if not keys:
        return {"error": "No valid worker indices"}

    _bulk_enrich_state = {
        "running": True, "total": 0, "done": 0, "failed": 0,
        "active_workers": 0, "error": None, "started_at": time.time(), "finished_at": None,
    }

    asyncio.create_task(_bulk_enrich_manager(keys=keys))
    label = ", ".join(f"Gemini-{i+1}" for i in range(len(keys)))
    return {"status": f"Deployed ({label})", "message": "Check /bulk-enrich/status for progress"}

@app.post("/bulk-enrich/stop")
async def bulk_enrich_stop():
    global _bulk_enrich_state
    if _bulk_enrich_state["running"]:
        _bulk_enrich_state["running"] = False
        return {"stopped": True}
    return {"stopped": False}

@app.get("/bulk-enrich/status")
async def bulk_enrich_status():
    return _bulk_enrich_state


# --- Gemini enrichment endpoints ---

@app.get("/gemini-enrich/status")
async def gemini_enrich_status():
    conn = get_db()
    pending = conn.execute(
        "SELECT COUNT(*) FROM Product WHERE enrichmentVersion IS NULL OR enrichmentVersion < ?",
        (ENRICH_VERSION,)
    ).fetchone()[0]
    conn.close()
    return {
        **_gemini_state,
        "model": GEMINI_MODEL,
        "batch_size": GEMINI_BATCH_SIZE,
        "thinking_budget": GEMINI_THINKING_BUDGET,
        "wait_seconds": GEMINI_WAIT_SECONDS,
        "pending_count": pending,
        "configured": bool(GEMINI_API_KEY),
    }

@app.post("/gemini-enrich/start")
async def gemini_enrich_start():
    return {
        "error": "Gemini scheduler start is disabled",
        "message": "Use /bulk-enrich from Data Processing to trigger enrichment as a single background action",
    }

@app.post("/gemini-enrich/stop")
async def gemini_enrich_stop():
    global _gemini_state
    if not _gemini_state["scheduler_active"]:
        return {"stopped": False, "reason": "not running"}
    _gemini_state["scheduler_active"] = False
    return {"stopped": True}

@app.post("/gemini-enrich/run-once")
async def gemini_enrich_run_once():
    """Trigger a single enrichment batch immediately (non-blocking)."""
    if _gemini_state["running"]:
        return {"error": "Batch already in progress"}
    if not GEMINI_API_KEY:
        return {"error": "GEMINI_API_KEY not configured"}
    asyncio.create_task(_gemini_run_batch_once())
    return {"status": "triggered", "batch_size": GEMINI_BATCH_SIZE}


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
                   p.brand, p.enrichment, p.subcategory
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
    if row.get("nameEn"):
        parts.append(row["nameEn"])
    if row.get("categoryLt"):
        parts.append(row["categoryLt"])
    if row.get("categoryEn"):
        parts.append(row["categoryEn"])
    if row.get("brand"):
        parts.append(row["brand"])
    if row.get("subcategory"):
        parts.append(row["subcategory"])
    # Include LLM enrichment tags if available
    if row.get("enrichment"):
        try:
            enr = json.loads(row["enrichment"]) if isinstance(row["enrichment"], str) else row["enrichment"]
            if enr.get("tags_en"):
                parts.extend(enr["tags_en"])
            if enr.get("tags_lt"):
                parts.extend(enr["tags_lt"])
            if enr.get("subcategory"):
                parts.append(enr["subcategory"])
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
