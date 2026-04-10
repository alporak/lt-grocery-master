"""
Embedder service — semantic search, category normalization, LLM enrichment, and data export
for Lithuanian grocery products.

Endpoints:
  POST /embed-batch   — generate embeddings for product texts
  POST /search        — semantic search: query → ranked product IDs
  POST /categorize    — assign canonical categories to products
  POST /enrich        — LLM-enrich new products via Ollama
  POST /process       — full pipeline: embed → categorize → enrich → export
  POST /export        — export product-intelligence.json.gz
  POST /import        — import from product-intelligence artifact
  GET  /health        — readiness check
"""

import json, gzip, base64, os, time, sqlite3, logging
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
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma2:2b")
CATEGORIES_PATH = Path(__file__).parent / "categories.json"
EXPORT_PATH = DATA_DIR / "product-intelligence.json.gz"
ENRICH_BATCH_SIZE = int(os.getenv("ENRICH_BATCH_SIZE", "500"))

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


@app.post("/enrich")
async def enrich():
    """LLM-enrich products that have no enrichedAt timestamp, via Ollama."""
    conn = get_db_rw()
    try:
        rows = conn.execute(
            "SELECT id, nameLt, nameEn, categoryLt, categoryEn, brand FROM Product WHERE enrichedAt IS NULL LIMIT ?",
            (ENRICH_BATCH_SIZE,)
        ).fetchall()

        if not rows:
            return {"enriched": 0, "message": "No products to enrich"}

        log.info(f"[Enrich] Enriching {len(rows)} products via Ollama ({OLLAMA_MODEL})...")
        enriched_count = 0

        async with httpx.AsyncClient(timeout=120.0) as client:
            for row in rows:
                product_text = _build_product_text(row)
                prompt = _build_enrich_prompt(product_text)

                try:
                    resp = await client.post(f"{OLLAMA_URL}/api/generate", json={
                        "model": OLLAMA_MODEL,
                        "prompt": prompt,
                        "stream": False,
                        "format": ENRICH_SCHEMA,
                        "options": {"temperature": 0.1, "num_predict": 300},
                    })
                    if resp.status_code != 200:
                        log.warning(f"[Enrich] Ollama returned {resp.status_code} for product {row['id']}")
                        continue

                    result = resp.json()
                    response_text = result.get("response", "")
                    enrichment = _parse_enrichment(response_text)

                    if enrichment:
                        conn.execute(
                            "UPDATE Product SET enrichment = ?, enrichedAt = datetime('now') WHERE id = ?",
                            (json.dumps(enrichment), row["id"])
                        )
                        enriched_count += 1
                except Exception as e:
                    log.warning(f"[Enrich] Error enriching product {row['id']}: {e}")
                    continue

        conn.commit()
        log.info(f"[Enrich] Enriched {enriched_count}/{len(rows)} products")

        # Re-embed enriched products to include LLM tags
        if enriched_count > 0:
            _reembed_enriched(conn, enriched_count)

        return {"enriched": enriched_count, "total_pending": len(rows)}
    finally:
        conn.close()


@app.post("/process")
async def process():
    """Full pipeline: embed new products → categorize → enrich → export."""
    results = {}

    # Step 1: Embed new/updated products
    results["embed"] = _embed_new_products()

    # Step 2: Categorize uncategorized products
    results["categorize"] = _categorize_new_products()

    # Step 3: LLM enrichment (if Ollama is available)
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            health = await client.get(f"{OLLAMA_URL}/api/tags")
            if health.status_code == 200:
                enrich_result = await enrich()
                results["enrich"] = enrich_result
            else:
                results["enrich"] = {"skipped": True, "reason": "Ollama not healthy"}
    except Exception:
        results["enrich"] = {"skipped": True, "reason": "Ollama not available"}

    # Step 4: Export
    results["export"] = _do_export()

    return results


@app.post("/export")
def export_data():
    return _do_export()


@app.post("/import")
def import_data():
    return _do_import()


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


# JSON schema for Ollama structured outputs — guarantees valid JSON matching this shape
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


def _build_enrich_prompt(product_text: str) -> str:
    return f"""You classify Lithuanian grocery products. Return a JSON object for this product.

Examples:

Product: Rokiškio pienas 2.5% riebumo, 1L | Rokiškio milk 2.5% fat, 1L | Pieno produktai | Rokiškio
Result: {{"name_clean":"Rokiškio Milk 2.5% Fat 1L","is_food":true,"primary_category":"Dairy","tags_en":["milk","fresh milk","dairy","rokiškio","low fat"],"tags_lt":["pienas","šviežias pienas","rokiškio","pieno produktai"],"attributes":{{"type":"fresh","packaging":"carton"}}}}

Product: Fairy indų ploviklis Lemon 900ml | Fairy dish soap Lemon 900ml | Valymo priemonės
Result: {{"name_clean":"Fairy Dish Soap Lemon 900ml","is_food":false,"primary_category":"Cleaning Products","tags_en":["dish soap","dishwashing","cleaning","fairy","lemon"],"tags_lt":["indų ploviklis","valymo priemonė","fairy","citrinos kvapas"],"attributes":{{"type":"liquid","scent":"lemon"}}}}

Product: Karūna šokoladinis batonėlis su karamele 40g | Karūna chocolate bar with caramel 40g | Saldumynai | Karūna
Result: {{"name_clean":"Karūna Chocolate Bar with Caramel 40g","is_food":true,"primary_category":"Sweets & Chocolate","tags_en":["chocolate","candy bar","caramel","sweet","snack","karūna"],"tags_lt":["šokoladas","batonėlis","karamelė","saldainiai","karūna","užkandis"],"attributes":{{"type":"confectionery","flavor":"caramel"}}}}

Product: Pedigree šunims su jautiena 400g | Pedigree dog food with beef 400g | Gyvūnų maistas | Pedigree
Result: {{"name_clean":"Pedigree Dog Food with Beef 400g","is_food":false,"primary_category":"Pet Food","tags_en":["dog food","pet food","pedigree","beef","dog"],"tags_lt":["šunų maistas","gyvūnų maistas","pedigree","jautiena","šuo"],"attributes":{{"type":"wet","protein":"beef"}}}}

Rules:
- name_clean: English product name with brand and size
- is_food: false for cleaning, pet food, hygiene, paper products
- primary_category: broad English category (Dairy, Poultry, Beverages, Snacks, Cleaning Products, etc.)
- tags_en: 4-7 English search words a shopper would use
- tags_lt: 4-7 Lithuanian search words a shopper would use
- attributes: filterable properties like type, flavor, scent, packaging

Product: {product_text}
Result:"""


def _parse_enrichment(text: str) -> Optional[dict]:
    """Parse LLM response. With format schema, Ollama guarantees valid JSON."""
    text = text.strip()
    try:
        data = json.loads(text)
        if isinstance(data, dict) and "name_clean" in data:
            return data
    except json.JSONDecodeError:
        log.warning(f"[Enrich] Failed to parse response: {text[:200]}")
    return None


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
