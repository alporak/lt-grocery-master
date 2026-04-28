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
  GET  /providers     — mock endpoint to satisfy the frontend layout requirements
"""

import json, gzip, base64, os, time, sqlite3, logging, asyncio, re
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(message)s")
log = logging.getLogger("embedder")

from config import *
from db import get_db, get_db_rw, _run_db_migrations, _db_save_batch, _db_save_by_id
import embeddings as emb_module
from embeddings import (load_embeddings, save_embeddings, _embed_texts,
                        _embed_new_products, _reembed_enriched)
from enrichment import BULK_ENRICH_SYSTEM_PROMPT, _gemini_call, _gemini_enrich_batch
from grouping import _do_grouping

# --- Global state ---
canonical_categories: list[dict] = []
category_embeddings: Optional[np.ndarray] = None
known_brands: list[dict] =[]  # loaded from brands.json


def load_brands():
    global known_brands
    if not BRANDS_PATH.exists():
        log.warning("brands.json not found, skipping brand loading")
        return
    with open(BRANDS_PATH) as f:
        known_brands = json.load(f)
    log.info(f"Loaded {len(known_brands)} known brands")


def load_categories():
    global canonical_categories, category_embeddings
    if not CATEGORIES_PATH.exists():
        log.warning("categories.json not found, skipping category loading")
        return
    with open(CATEGORIES_PATH) as f:
        canonical_categories = json.load(f)
    texts =[]
    for cat in canonical_categories:
        parts = [cat["en"], cat["lt"]]
        parts.extend(cat.get("keywords",[]))
        texts.append(" ".join(parts))
    if GEMINI_API_KEY:
        from embeddings import _embed_texts_gemini
        category_embeddings = _embed_texts_gemini(texts, "RETRIEVAL_DOCUMENT")
        log.info(f"Loaded {len(canonical_categories)} canonical categories with Gemini embeddings")
    else:
        log.warning("[Categories] No GEMINI_API_KEY — category embeddings skipped")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _run_db_migrations()
    load_categories()
    load_brands()
    load_embeddings()
    # Auto-import if no embeddings but artifact exists
    if len(emb_module.product_ids) == 0 and EXPORT_PATH.exists():
        log.info("No local embeddings found, importing from artifact...")
        _do_import()
    # Reset products that were marked as attempted (enrichedAt set) but have no actual data
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
    if GEMINI_API_KEY:
        log.info("[Gemini] API key configured. Use /bulk-enrich to start enrichment.")
    else:
        log.info("[Gemini] No API key configured")
    yield
    log.info("Shutting down")


app = FastAPI(title="Grocery Embedder", lifespan=lifespan)


# --- Pydantic models ---

class EmbedBatchRequest(BaseModel):
    ids: list[int]
    texts: list[str]
    store_ids: list[int] =[]

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
        "embeddings_count": len(emb_module.product_ids),
        "categories_count": len(canonical_categories),
    }

@app.get("/providers")
def get_providers():
    """Satisfy the frontend provider check request safely"""
    return {
        "providers":[
            {
                "id": "gemini", 
                "name": "Gemini (Paid API)", 
                # The frontend expects an array of 'models' here, not a single string!
                "models":[
                    {"id": GEMINI_MODEL, "name": "Gemini 3.1 Flash Lite"}
                ]
            }
        ],
        "active": "gemini"
    }

@app.post("/reset")
def reset():
    """Clear all embeddings from memory and disk."""
    emb_module.embeddings = None
    emb_module.product_ids =[]
    emb_module.product_store_ids =[]
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
    if len(req.ids) != len(req.texts):
        raise HTTPException(400, "ids and texts must have same length")
    if len(req.ids) == 0:
        return {"updated": 0}

    store_ids_input = req.store_ids if req.store_ids else [0] * len(req.ids)
    new_vecs = _embed_texts(req.texts, "RETRIEVAL_DOCUMENT")

    id_to_idx = {pid: i for i, pid in enumerate(emb_module.product_ids)}
    for i, pid in enumerate(req.ids):
        if pid in id_to_idx:
            idx = id_to_idx[pid]
            emb_module.embeddings[idx] = new_vecs[i]
            emb_module.product_store_ids[idx] = store_ids_input[i]
        else:
            emb_module.product_ids.append(pid)
            emb_module.product_store_ids.append(store_ids_input[i])
            if emb_module.embeddings is None:
                emb_module.embeddings = new_vecs[i:i+1].copy()
            else:
                emb_module.embeddings = np.vstack([emb_module.embeddings, new_vecs[i:i+1]])

    save_embeddings()
    return {"updated": len(req.ids), "total": len(emb_module.product_ids)}


@app.post("/search")
def search(req: SearchRequest):
    if emb_module.embeddings is None or len(emb_module.product_ids) == 0:
        return {"results": []}

    query_vec = _embed_texts([req.query], "RETRIEVAL_QUERY")
    scores = (emb_module.embeddings @ query_vec.T).flatten()

    # Filter by store_ids if provided
    if req.store_ids:
        store_set = set(req.store_ids)
        mask = np.array([sid in store_set for sid in emb_module.product_store_ids])
        scores = np.where(mask, scores, -1.0)

    top_k = min(req.limit, len(emb_module.product_ids))
    top_indices = np.argpartition(scores, -top_k)[-top_k:]
    top_indices = top_indices[np.argsort(scores[top_indices])[::-1]]

    results = []
    for idx in top_indices:
        s = float(scores[idx])
        if s <= 0:
            break
        results.append({"id": emb_module.product_ids[idx], "score": round(s, 4)})

    return {"results": results}


@app.post("/categorize")
def categorize(req: CategorizeRequest):
    if category_embeddings is None or len(canonical_categories) == 0:
        raise HTTPException(503, "Categories not loaded")
    if len(req.ids) != len(req.texts):
        raise HTTPException(400, "ids and texts must have same length")

    vecs = _embed_texts(req.texts, "RETRIEVAL_DOCUMENT")
    similarities = vecs @ category_embeddings.T  # (N, num_categories)
    best_indices = similarities.argmax(axis=1)

    results =[]
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


# --- List item matching ---

class MatchListRequest(BaseModel):
    items: list[dict]   # [{"id": int, "name": str}, ...]
    store_ids: list[int] = []
    top_k: int = 5


_match_cache: dict[str, tuple[int | None, float]] = {}  # name_hash → (group_id, score)
_MATCH_CACHE_MAX = 10000

LIST_EXPAND_SYSTEM_PROMPT = (
    "You are a grocery search assistant for Lithuanian grocery stores. "
    "For each grocery list item, produce 3-5 short realistic search queries that a shopper would type "
    "to find that item. Mix Lithuanian and English. Include diacritic-less variants. "
    "Return ONLY valid JSON: {\"items\": [{\"id\": <id>, \"queries\": [<q1>, <q2>, ...]}, ...]}"
)


async def _expand_list_items(items: list[dict]) -> dict[int, list[str]]:
    """Call Gemini once to expand all list item names into search queries. Returns {item_id: [queries]}."""
    if not GEMINI_API_KEY:
        return {item["id"]: [item["name"]] for item in items}

    from google import genai
    from google.genai import types as gtypes

    numbered = "\n".join(f"{item['id']}: {item['name']}" for item in items)
    client = genai.Client(api_key=GEMINI_API_KEY)
    cfg = gtypes.GenerateContentConfig(
        system_instruction=LIST_EXPAND_SYSTEM_PROMPT,
        temperature=0.1,
        max_output_tokens=1024,
        response_mime_type="application/json",
    )
    try:
        resp = await client.aio.models.generate_content(
            model=GEMINI_MODEL,
            contents=numbered,
            config=cfg,
        )
        data = json.loads(resp.text)
        result = {}
        for entry in data.get("items", []):
            result[entry["id"]] = entry.get("queries", [entry.get("name", "")])
        for item in items:
            if item["id"] not in result:
                result[item["id"]] = [item["name"]]
        return result
    except Exception as e:
        log.warning(f"[MatchList] Gemini expand error: {e}")
        return {item["id"]: [item["name"]] for item in items}


@app.post("/match-list")
async def match_list(req: MatchListRequest):
    """Match grocery list items to product groups via Gemini query expansion + semantic search."""
    if emb_module.embeddings is None or len(emb_module.product_ids) == 0:
        return {"matches":[]}

    # Separate cached vs uncached items
    cache_hits: dict[int, tuple[int | None, float]] = {}
    uncached: list[dict] =[]
    for item in req.items:
        key = item["name"].lower().strip()
        if key in _match_cache:
            cache_hits[item["id"]] = _match_cache[key]
        else:
            uncached.append(item)

    expanded: dict[int, list[str]] = {}
    if uncached:
        expanded = await _expand_list_items(uncached)

    # Collect all queries to embed in one batch
    all_queries: list[str] =[]
    query_item_map: list[int] =[]  # parallel: which item_id each query belongs to
    for item in uncached:
        for q in expanded.get(item["id"], [item["name"]]):
            all_queries.append(q)
            query_item_map.append(item["id"])

    matches_out: list[dict] = []

    for item in req.items:
        iid = item["id"]
        if iid in cache_hits:
            gid, score = cache_hits[iid]
            matches_out.append({"id": iid, "group_id": gid, "score": round(score, 4), "product_ids":[]})

    if all_queries:
        # Offload blocking _embed_texts to thread
        query_vecs = await asyncio.to_thread(_embed_texts, all_queries, "RETRIEVAL_QUERY")

        store_set = set(req.store_ids)
        if store_set:
            mask = np.array([sid in store_set for sid in emb_module.product_store_ids], dtype=bool)
        else:
            mask = np.ones(len(emb_module.product_ids), dtype=bool)

        conn = get_db()
        try:
            group_rows = conn.execute(
                "SELECT id, productGroupId FROM Product WHERE productGroupId IS NOT NULL"
            ).fetchall()
        finally:
            conn.close()
        pid_to_group: dict[int, int] = {r["id"]: r["productGroupId"] for r in group_rows}

        item_queries: dict[int, list[int]] = {}
        for qi, iid in enumerate(query_item_map):
            item_queries.setdefault(iid,[]).append(qi)

        emb_arr = emb_module.embeddings

        for item in uncached:
            iid = item["id"]
            qi_list = item_queries.get(iid,[])
            if not qi_list:
                matches_out.append({"id": iid, "group_id": None, "score": 0.0, "product_ids":[]})
                continue

            q_vecs = query_vecs[qi_list]
            sims = (emb_arr @ q_vecs.T)
            if store_set:
                sims[~mask, :] = -1.0
            max_sims = sims.max(axis=1)

            top_k = min(req.top_k, len(emb_module.product_ids))
            top_idx = np.argpartition(max_sims, -top_k)[-top_k:]
            top_idx = top_idx[np.argsort(max_sims[top_idx])[::-1]]

            group_scores: dict[int, float] = {}
            group_pids: dict[int, list[int]] = {}
            ungrouped_best = (None, 0.0,[])

            for idx in top_idx:
                pid = emb_module.product_ids[idx]
                sc = float(max_sims[idx])
                if sc <= 0:
                    break
                gid = pid_to_group.get(pid)
                if gid:
                    if gid not in group_scores or sc > group_scores[gid]:
                        group_scores[gid] = sc
                    group_pids.setdefault(gid,[]).append(pid)
                else:
                    if sc > ungrouped_best[1]:
                        ungrouped_best = (None, sc, [pid])

            if group_scores:
                best_gid = max(group_scores, key=lambda g: group_scores[g])
                best_score = group_scores[best_gid]
                best_pids = group_pids[best_gid]
            else:
                best_gid, best_score, best_pids = ungrouped_best

            key = item["name"].lower().strip()
            _match_cache[key] = (best_gid, best_score)
            if len(_match_cache) > _MATCH_CACHE_MAX:
                oldest = next(iter(_match_cache))
                del _match_cache[oldest]

            matches_out.append({
                "id": iid,
                "group_id": best_gid,
                "score": round(best_score, 4),
                "product_ids": best_pids[:10],
            })

    order = {item["id"]: i for i, item in enumerate(req.items)}
    matches_out.sort(key=lambda m: order.get(m["id"], 999))
    return {"matches": matches_out}


class EnrichPreviewRequest(BaseModel):
    product_ids: list[int]


@app.post("/enrich/preview")
async def enrich_preview(req: EnrichPreviewRequest):
    if not GEMINI_API_KEY:
        raise HTTPException(503, "GEMINI_API_KEY not configured")
    if not req.product_ids:
        return {"results":[]}

    conn = get_db()
    try:
        placeholders = ",".join("?" * len(req.product_ids))
        rows = conn.execute(
            f"SELECT id, nameLt, nameEn, categoryLt, categoryEn, brand FROM Product WHERE id IN ({placeholders})",
            req.product_ids,
        ).fetchall()
    finally:
        conn.close()

    if not rows:
        return {"results":[]}

    rows = [dict(r) for r in rows]
    items, err = await _gemini_call(GEMINI_API_KEY, rows)
    if err:
        raise HTTPException(500, f"Gemini error: {err}")

    return {"input_count": len(rows), "results": items}


@app.post("/export")
def export_data():
    return _do_export()

@app.post("/import")
def import_data():
    return _do_import()

@app.get("/categories-summary")
def categories_summary():
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT canonicalCategory, subcategory, COUNT(*) as cnt
            FROM Product
            WHERE canonicalCategory IS NOT NULL
            GROUP BY canonicalCategory, subcategory
            ORDER BY canonicalCategory, cnt DESC
        """).fetchall()

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

        result =[]
        for cat in canonical_categories:
            cid = cat["id"]
            info = cat_map.get(cid, {"count": 0, "subcategories": []})
            result.append({
                "id": cid,
                "en": cat["en"],
                "lt": cat["lt"],
                "count": info["count"],
                "subcategories": info["subcategories"][:20],
            })
        return {"categories": result}
    finally:
        conn.close()


@app.get("/category/{category_id}/brands")
def category_brands(category_id: str):
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
                    "subcategories":[],
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


# --- Bulk enrichment ---

_bulk_enrich_state = {
    "running": False,
    "total": 0,
    "done": 0,
    "failed": 0,
    "error": None,
    "started_at": None,
    "finished_at": None,
}

async def _bulk_enrich_manager():
    global _bulk_enrich_state
    state = _bulk_enrich_state

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
        log.info("[BulkEnrich] No products need enrichment.")
        state["running"] = False
        state["finished_at"] = time.time()
        return

    if not GEMINI_API_KEY:
        state["error"] = "No GEMINI_API_KEY configured."
        state["running"] = False
        return

    batches = [
        [dict(r) for r in rows[i:i + GEMINI_BATCH_SIZE]]
        for i in range(0, total, GEMINI_BATCH_SIZE)
    ]

    sem = asyncio.Semaphore(GEMINI_CONCURRENCY)
    delay = 60.0 / max(1, GEMINI_RPM)
    db_lock = asyncio.Lock()

    async def process_batch(idx: int, batch_rows: list):
        if idx < GEMINI_CONCURRENCY:
            await asyncio.sleep(idx * delay)
            
        async with sem:
            if not state["running"]:
                return
            await asyncio.sleep(delay)
            items, err = await _gemini_call(GEMINI_API_KEY, batch_rows)
            
            if err:
                log.warning(f"[BulkEnrich] Batch error: {err[:120]}")
                state["failed"] += len(batch_rows)
            else:
                async with db_lock:
                    await asyncio.to_thread(_db_save_batch, batch_rows, items, "auto")
                enriched = sum(
                    1 for j, r in enumerate(batch_rows)
                    if j < len(items) and isinstance(items[j], dict) and ("name_en" in items[j] or "name_clean" in items[j])
                )
                state["done"] += enriched
                state["failed"] += len(batch_rows) - enriched
                log.info(f"[BulkEnrich] {state['done']}/{total} done, {state['failed']} failed")

    tasks =[asyncio.create_task(process_batch(i, b)) for i, b in enumerate(batches)]
    await asyncio.gather(*tasks)

    state["running"] = False
    state["finished_at"] = time.time()
    log.info(f"[BulkEnrich] Done — enriched: {state['done']}, failed: {state['failed']}")


@app.post("/bulk-enrich")
async def bulk_enrich():
    global _bulk_enrich_state
    if _bulk_enrich_state["running"]:
        return {"error": "Enrichment already running"}
    if not GEMINI_API_KEY:
        return {"error": "GEMINI_API_KEY not configured"}
    _bulk_enrich_state = {
        "running": True, "total": 0, "done": 0, "failed": 0,
        "error": None, "started_at": time.time(), "finished_at": None,
    }
    asyncio.create_task(_bulk_enrich_manager())
    return {"status": "triggered", "message": "Check /bulk-enrich/status for progress"}

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


# --- Product Grouping ---

_group_state = {
    "running": False, "total": 0, "groups_created": 0, "products_grouped": 0, "error": None,
}

@app.post("/group")
async def group_products():
    """Group similar products across stores using barcodes and embedding similarity."""
    global _group_state
    if _group_state["running"]:
        return {"error": "Grouping already running"}

    _group_state = {"running": True, "total": 0, "groups_created": 0, "products_grouped": 0, "error": None}

    try:
        # Pushed blocking calculations out to a threadpool
        result = await asyncio.to_thread(_do_grouping)
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


def _do_export() -> dict:
    conn = get_db()
    try:
        rows = conn.execute("""
            SELECT p.id, p.externalId, p.storeId, p.nameEn, p.canonicalCategory,
                   p.enrichment, s.slug as storeSlug
            FROM Product p
            JOIN Store s ON s.id = p.storeId
        """).fetchall()

        id_to_idx = {pid: i for i, pid in enumerate(emb_module.product_ids)}
        products_out =[]
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
            idx = id_to_idx.get(row["id"])
            if idx is not None and emb_module.embeddings is not None:
                vec = emb_module.embeddings[idx].astype(np.float32)
                entry["embedding"] = base64.b64encode(vec.tobytes()).decode("ascii")

            products_out.append(entry)

        artifact = {
            "version": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "model": GEMINI_EMBEDDING_MODEL,
            "embedding_dim": GEMINI_EMBEDDING_DIM,
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
    global embeddings, product_ids, product_store_ids
    if not EXPORT_PATH.exists():
        return {"imported": 0, "message": "No artifact file found"}

    log.info(f"[Import] Loading artifact from {EXPORT_PATH}...")
    with gzip.open(str(EXPORT_PATH), "rt", encoding="utf-8") as f:
        artifact = json.load(f)

    dim = artifact.get("embedding_dim", 384)
    products = artifact.get("products",[])

    conn = get_db_rw()
    try:
        db_rows = conn.execute("""
            SELECT p.id, p.storeId, p.externalId, s.slug as storeSlug
            FROM Product p JOIN Store s ON s.id = p.storeId
        """).fetchall()

        db_lookup = {(r["storeSlug"], r["externalId"]): r for r in db_rows}

        new_ids = []
        new_store_ids = []
        new_vecs =[]
        applied = 0

        for entry in products:
            key = (entry.get("storeSlug"), entry.get("externalId"))
            db_row = db_lookup.get(key)
            if not db_row:
                continue

            pid = db_row["id"]
            sid = db_row["storeId"]

            updates = []
            params =[]
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

            if entry.get("embedding"):
                vec_bytes = base64.b64decode(entry["embedding"])
                vec = np.frombuffer(vec_bytes, dtype=np.float32)
                if len(vec) == dim:
                    new_ids.append(pid)
                    new_store_ids.append(sid)
                    new_vecs.append(vec)

            applied += 1

        conn.commit()

        if new_vecs:
            embeddings = np.array(new_vecs, dtype=np.float32)
            product_ids = new_ids
            product_store_ids = new_store_ids
            save_embeddings()

        log.info(f"[Import] Applied {applied} products, {len(new_vecs)} embeddings")
        return {"imported": applied, "embeddings": len(new_vecs)}
    finally:
        conn.close()

@app.post("/process")
async def process_pipeline():
    """Full pipeline: embed -> enrich -> group -> export. Synchronous."""
    global _bulk_enrich_state

    if _bulk_enrich_state["running"]:
        return {"error": "Enrichment already running"}
    if not GEMINI_API_KEY:
        return {"error": "GEMINI_API_KEY not configured"}

    _bulk_enrich_state = {
        "running": True, "total": 0, "done": 0, "failed": 0,
        "error": None, "started_at": time.time(), "finished_at": None,
    }

    results: dict = {}

    # Step 1: Embed new products
    try:
        embed_result = _embed_new_products()
        results["embed"] = embed_result
    except Exception as e:
        results["embed"] = {"error": str(e)}

    # Step 2: Enrich (synchronous await)
    try:
        await _bulk_enrich_manager()
        results["enrich"] = {
            "total": _bulk_enrich_state["total"],
            "done": _bulk_enrich_state["done"],
            "failed": _bulk_enrich_state["failed"],
        }
    except Exception as e:
        results["enrich"] = {"error": str(e)}

    # Step 3: Group
    try:
        group_result = _do_grouping()
        results["group"] = group_result
    except Exception as e:
        results["group"] = {"error": str(e)}

    # Step 4: Export
    try:
        export_result = _do_export()
        results["export"] = export_result
    except Exception as e:
        results["export"] = {"error": str(e)}

    _bulk_enrich_state["running"] = False
    _bulk_enrich_state["finished_at"] = time.time()

    return {"status": "complete", "results": results}


@app.get("/enrich/needed")
def enrich_needed(limit: int = 50):
    """Return unenriched products for external enrichment (opencode)."""
    conn = get_db()
    try:
        total = conn.execute(
            "SELECT COUNT(*) FROM Product WHERE enrichmentVersion IS NULL OR enrichmentVersion < ?",
            (ENRICH_VERSION,)
        ).fetchone()[0]
        rows = conn.execute(
            "SELECT id, nameLt, nameEn, categoryLt, categoryEn, brand FROM Product "
            "WHERE enrichmentVersion IS NULL OR enrichmentVersion < ? "
            "ORDER BY id LIMIT ?",
            (ENRICH_VERSION, limit)
        ).fetchall()
        products = [dict(r) for r in rows]
        return {"products": products, "count": total}
    finally:
        conn.close()


@app.post("/enrich/save")
def enrich_save(body: dict):
    """Save externally-enriched product data. Body: {'results': [{product_id, name_en, ...}, ...]}."""
    items = body.get("results", [])
    if not items or not isinstance(items, list):
        raise HTTPException(400, "Missing 'results' array")
    _db_save_by_id(items, source="opencode")
    return {"saved": len(items)}


@app.post("/enrich/auto")
def enrich_auto():
    """Auto-enrich all unenriched products using keyword/category matching. No API calls."""
    from db import _db_save_by_id

    # Extended keyword map — broader Lithuanian word forms
    EXTRA_KW = {
        "poultry": ["viščiuk", "paukštiena", "sparnel", "šlaunel", "blauzdel", "filė višt", "vištiena", "vištienos", "broilerių", "broileris", "paukštienos", "kalakutiena", "ančiukų", "ančiuku", "antiena", "antienos"],
        "beef": ["jautiena", "jautienos", "antrekotas", "jautien", "guliaš", "gulias", "veršienos", "versienos", "veršiena", "jaučio", "jaucio", "billa premium"],
        "pork": ["kiauliena", "kiaulienos", "šoninė", "sonine", "šonkaul", "sonkaul", "sprandin", "kumpis", "išpjova", "mentė", "mente", "nugarinė", "šonkauliai", "sonkauliai", "šešlykas", "saslykas", "karka", "dešrel", "desrel"],
        "lamb": ["aviena", "ėriena", "avienos"],
        "minced-meat": ["faršas", "malta", "smulkinta", "jautiena malta", "kiauliena malta", "kotletai"],
        "deli-meat": ["dešrel", "desrel", "dešra", "desra", "rūkyt", "rukyt", "kumpis", "šaltai rūkytas", "karštai rūkytas", "šaltai rukyt", "karštai rukyt", "skilandis", "medžiotojų", "medziotoju"],
        "fish-seafood": ["žuvis", "žuvies", "zuvies", "lašiša", "lasisa", "šamo", "samo", "upėtakis", "upetakis", "dorados", "skumbrės", "skumbres", "karpių", "karp", "argentinos", "ančiuvių", "anchiuviu", "silke", "silkė", "menkė", "menke", "tunas", "krevetės", "krevetes", "žuvies", "žuvys", "silkių", "silkiu", "tuno"],
        "vegetables": ["daržov", "darzov", "morkos", "svogūnai", "svogunai", "paprikos", "pomidorai", "bulvės", "bulves", "cukinijos", "baklažan", "bakezan", "smidrai", "kukurūz", "kukuruz", "morkytes", "kopūstai", "kopustai", "česnakai", "cesnakai", "salierai", "bulvytės", "bulvytes", "ridikė", "ridike", "ananasas", "žirneliai", "zirneliai"],
        "salads-herbs": ["salotos", "lapinės", "lapines", "lollo biondo", "salierai"],
        "mushrooms": ["pievagryb", "grybai", "šampinjonai", "portabela", "rudieji pievagrybiai"],
        "fruits": ["vaisiai", "obuol", "apelsin", "banan", "kivi", "vynuog", "citrin", "brašk", "braske", "mandarinai", "avokadai", "kriaušės", "kriause", "avietės", "avietes", "šilauogės", "silauoges", "mangai", "greipfrutai", "mango", "aviet", "slyvos", "slyva", "gervuog", "ananasas"],
        "cheese": ["sūris", "suris", "sūrio", "surio", "camembert", "cheddar", "emmental", "lydytas sūris", "lydytas suris", "varškė", "varske"],
        "eggs": ["kiaušin", "kiaušiniai", "kikis"],
        "bread": ["duona", "batonas", "bandel", "bandeles", "bandelės", "brioche", "mėsainio bandelės", "duonos gaminiai"],
        "sauces-condiments": ["kečupas", "kecupas", "marinatas", "padažas", "padazas", "marinade", "čatnis", "catnis", "glazūra", "glazura", "padažo"],
        "spices": ["prieskoniai", "pipirai", "prieskon", "kmynai", "marinatas", "prieskoniai"],
        "pet-food": ["šunų", "kačių", "šunims", "katėms", "gyvūnų", "gyvunams", "gyvunu"],
        "ready-meals": ["gulias", "troškinti", "troskinimui", "troškinimui", "lietiniai", "lietin", "blynai", "koldūnai", "cepelinai", "kukuliai", "mišrain", "misrain"],
        "frozen-food": ["šaldyt", "saldyt", "ledai", "šaldytas", "saldyti"],
        "sweets-chocolate": ["šokolad", "sokolad", "saldain", "saldumyn", "kremas", "desertas", "zefyrai", "marshmallow", "sausain", "slyvo", "gervuog"],
        "snacks": ["traškuč", "traskuc", "riešut", "riesut", "pistacijos", "pistacij", "kreker", "užkand", "uzkand", "sūdyti", "sudyti", "kepintos", "druska", "javinuk", "javure"],
        "cleaning": ["šluost", "sluost", "valymo", "ploviklis", "plovikli"],
        "paper-products": ["popieriniai", "tualetinis", "servetėl", "servetel"],
        "personal-care": ["šampūn", "sampun", "muilas", "dušo", "duso", "drėgnos", "dregnos", "kosmetika"],
        "baby-food": ["kūdiki", "kudiki", "vaiku", "kūdik", "kudik"],
        "other": [],
    }

    # Direct mapping from store categoryLt to canonical category
    CAT_LT_MAP = [
        (["pieno produktai", "pienas", "pienelis", "pieniškas", "kefyras", "jogurtas", "grietin", "sūris", "suris", "varškė", "varsk", "kiaušinin", "kiaušiniai", "kikis"], ["milk", "cheese", "yogurt", "butter-cream", "cottage-cheese", "eggs"]),
        (["mėsa", "mesa ir zuvis", "vistiena", "kiauliena", "jautiena"], ["poultry", "pork", "beef", "minced-meat", "deli-meat"]),
        (["žuvis", "zuvies", "jūros gėrybės", "juros gerybes", "žuvys"], ["fish-seafood"]),
        (["daržov", "darzov", "vaisiai", "vaisi"], ["vegetables", "fruits"]),
        (["duonos gaminiai", "konditerija", "kulinarija", "kepiniai"], ["bread", "bakery"]),
        (["gėrim", "gerim", "vanduo", "sultys", "alus", "vynas", "alkoholiniai"], ["beer", "wine", "spirits", "soda-soft-drinks", "water", "juice"]),
        (["higiena", "grožio", "grozio", "kosmetika", "sveikata", "asmens"], ["personal-care", "health", "paper-products"]),
        (["vaiku", "kūdiki", "kudiki", "baby"], ["baby-food"]),
        (["gyvūn", "gyvun", "šunų", "kačių", "sunu", "kaciu", "pet", "namini"], ["pet-food"]),
        (["namų ūkio", "namu ukio", "valymo", "plovik", "buities", "skalbimo"], ["cleaning", "laundry", "paper-products"]),
        (["užkand", "uzkand", "saldumyn", "saldaini", "šokolad", "sokolad", "traškuč", "traskuc", "sausain"], ["snacks", "sweets-chocolate", "cereals"]),
        (["prieskoniai", "padaž", "padaz", "marinat", "aliejus", "actas"], ["spices", "sauces-condiments", "oil-vinegar", "flour-baking"]),
        (["griliui", "barbekiu", "šašlyk", "saslyk", "kepsni"], ["poultry", "pork", "beef", "deli-meat"]),
        (["konserv", "konservuot"], ["canned-food"]),
        (["frozen", "šaldyt", "saldyt", "šaldik"], ["frozen-food"]),
        (["ryžiai", "ryziai", "kruopos", "grikiai", "makaron", "miltai", "kepimo"], ["rice-grains", "pasta", "flour-baking"]),
        (["sultys", "nektaras", "smoothie", "gazuoti gėrimai", "limonadas"], ["juice", "soda-soft-drinks"]),
        (["alaus", "alus", "craft", "lager"], ["beer"]),
        (["vyno", "vynas", "šampano"], ["wine"]),
        (["degtin", "viskio", "romas", "džinas", "dzinas", "stiprieji"], ["spirits"]),
        (["kava", "arbata", "kavos", "kavos pupel"], ["coffee", "tea"]),
    ]

    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT id, nameLt, categoryLt, brand FROM Product "
            "WHERE enrichmentVersion IS NULL OR enrichmentVersion < ? "
            "ORDER BY id",
            (ENRICH_VERSION,)
        ).fetchall()
    finally:
        conn.close()

    items = []
    brand_re = re.compile(r'\b(CLEVER|BON VIA|HEINZ|SANTA MARIA|PRESIDENT|GRILL PARTY|PREMIUM|IKI ŪKIS|IKI MĖSA|PAGAMINTA IKI|GRYNUOLIAI|KLAIPĖDOS MAISTAS|LOLLO BIONDO|BRIOCHE|GIMINIŲ|GIMINIU|THAI|HEINZ)\b', re.IGNORECASE)
    size_re = re.compile(r'(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|vnt|vienet|vnt\.|pak\.)', re.IGNORECASE)

    for row in rows:
        pid = row["id"]
        name = row["nameLt"] or ""
        cat_lt = row["categoryLt"] or ""
        text = f"{name} {cat_lt}".lower()

        # Score canonical categories
        best_cat = "other"
        best_score = 0
        for cat in canonical_categories:
            cid = cat["id"]
            score = 0
            for kw in cat.get("keywords", []):
                if kw.lower() in text:
                    score += 1
            for kw in EXTRA_KW.get(cid, []):
                if kw.lower() in text:
                    score += 2
            if score > best_score:
                best_score = score
                best_cat = cid

        # Score via categoryLt store categories
        cat_lt_lower = cat_lt.lower()
        for patterns, cat_ids in CAT_LT_MAP:
            for pat in patterns:
                if pat.lower() in cat_lt_lower:
                    for cid in cat_ids:
                        score = 1 + (1 if cid == "other" else 2)
                        if score > best_score:
                            best_score = score
                            best_cat = cid

        # Check categoryLt for clues when keywords fail
        if best_score == 0 and cat_lt:
            cat_lt_lower = cat_lt.lower()
            if any(w in cat_lt_lower for w in ["mėsa", "mesa", "žuvis", "zuvies", "fish", "jūros"]):
                best_cat = "other"  # keep as-is, meat categories need clear food signal
            elif any(w in cat_lt_lower for w in ["gėrim", "gerimy", "vanduo"]):
                if any(w in text for w in ["alus", "beer", "ale", "lager"]):
                    best_cat = "beer"
                elif any(w in text for w in ["vynas", "vyno", "wine"]):
                    best_cat = "wine"
                elif any(w in text for w in ["degtin", "vodka", "whisky", "džinas", "romas"]):
                    best_cat = "spirits"
                else:
                    best_cat = "soda-soft-drinks"

        # Extract brand (uppercase words known as brands, or uppercase in name)
        brand = None
        bm = brand_re.search(name)
        if bm:
            brand_raw = bm.group(1)
            brand = brand_raw if brand_raw.isupper() else brand_raw.title()

        # Extract size
        size_m = size_re.search(name)
        size_val = None
        size_unit = None
        if size_m:
            try:
                size_val = float(size_m.group(1).replace(",", "."))
                size_unit = size_m.group(2).lower()
            except ValueError:
                pass

        # Clean name for English version
        name_en = name.strip()
        name_en = re.sub(r'\s+,', ',', name_en)
        en_map = {
            "kiaulienos": "Pork", "jautienos": "Beef", "vištienos": "Chicken",
            "viščiukų": "Chicken", "broilerių": "Broiler", "šviežias": "Fresh",
            "švieži": "Fresh", "marinuota": "Marinated", "marinuotas": "Marinated",
            "rūkyta": "Smoked", "rūkytos": "Smoked", "rūkytas": "Smoked",
            "šaltai": "Cold", "karštai": "Hot",
            "be kaulo": "Boneless", "su kaulu": "Bone-in",
            "šoninė": "Belly", "sprandinė": "Neck", "kumpis": "Ham",
            "mentė": "Shoulder", "išpjova": "Tenderloin",
            "šonkauliai": "Ribs", "filė": "Fillet", "kepsniai": "Steaks",
            "dešrelės": "Sausages", "dešrelė": "Sausage",
            "mėsa": "Meat", "troškinimui": "for Stewing",
            "pievagrybiai": "Mushrooms", "grybai": "Mushrooms",
            "paprikos": "Peppers", "svogūnai": "Onions",
            "morkos": "Carrots", "pomidorai": "Tomatoes",
            "bulvės": "Potatoes", "cukinijos": "Zucchini",
            "baklažanai": "Eggplants", "salotos": "Salad",
            "sūris": "Cheese", "pienas": "Milk",
            "kečupas": "Ketchup", "marinatas": "Marinade",
            "bandelės": "Buns", "bandelė": "Bun",
        }
        for lt_word, en_word in en_map.items():
            name_en = re.sub(re.escape(lt_word), en_word, name_en, flags=re.IGNORECASE)
        name_en = " ".join(w.capitalize() for w in name_en.split())

        item = {
            "product_id": pid,
            "name_en": name_en,
            "name_lt": name.strip(),
            "brand": brand,
            "canonical_category": best_cat,
            "subcategory": None,
            "is_food": best_cat not in ("cleaning", "laundry", "paper-products", "personal-care", "health", "pet-food", "baby-food", "other"),
            "size": {"value": size_val, "unit": size_unit},
            "attributes": {"category": cat_lt} if cat_lt else {},
            "search_text": f"{name_en} {brand or ''} {cat_lt}".strip(),
            "query_variants": [name.strip(), name_en],
        }
        items.append(item)

    _db_save_by_id(items, source="auto-keyword")
    return {"enriched": len(items)}


@app.get("/enrich/auto/status")
def enrich_auto_status():
    """Check how many products still need enrichment."""
    conn = get_db()
    try:
        total = conn.execute("SELECT COUNT(*) FROM Product").fetchone()[0]
        done = conn.execute("SELECT COUNT(*) FROM Product WHERE enrichmentVersion = ?", (ENRICH_VERSION,)).fetchone()[0]
        return {"total": total, "enriched": done, "remaining": total - done}
    finally:
        conn.close()

    items = []
    brand_patterns = re.compile(r'\b(CLEVER|BON VIA|HEINZ|SANTA MARIA|PRESIDENT|GRILL PARTY|PREMIUM|IKI ŪKIS|IKI MĖSA|PAGAMINTA IKI|GRYNUOLIAI|KLAIPĖDOS MAISTAS|LOLLO BIONDO)\b', re.IGNORECASE)
    size_re = re.compile(r'(\d+(?:[.,]\d+)?)\s*(g|kg|ml|l|vnt|vienet|pakuotė|pak\.)', re.IGNORECASE)

    for row in rows:
        pid = row["id"]
        name = row["nameLt"] or ""
        cat_lt = row["categoryLt"] or ""
        text = f"{name} {cat_lt}".lower()

        # Score categories by keyword matches
        best_cat = "other"
        best_score = 0
        for cat in canonical_categories:
            score = 0
            for kw in cat.get("keywords", []):
                if kw.lower() in text:
                    score += 1
            if score > best_score:
                best_score = score
                best_cat = cat["id"]

        # Extract brand
        brand = None
        bm = brand_patterns.search(name)
        if bm:
            brand = bm.group(1).title()

        # Extract size
        size_m = size_re.search(name)
        size_val = None
        size_unit = None
        if size_m:
            try:
                size_val = float(size_m.group(1).replace(",", "."))
                size_unit = size_m.group(2).lower()
            except ValueError:
                pass

        # Simple English name (upper-case cleaned)
        name_en = name.strip()
        name_en = re.sub(r'\s+,', ',', name_en)
        # Replace known LT food words with EN equivalents
        en_map = {
            "kiaulienos": "Pork", "jautienos": "Beef", "vištienos": "Chicken",
            "viščiukų": "Chicken", "broilerių": "Chicken", "šviežias": "Fresh",
            "švieži": "Fresh", "marinuota": "Marinated", "marinuotas": "Marinated",
            "rūkyta": "Smoked", "rūkytos": "Smoked", "rūkytas": "Smoked",
            "šalta": "Cold", "karštai": "Hot",
            "be kaulo": "Boneless", "su kaulu": "Bone-in",
            "šoninė": "Belly", "sprandinė": "Neck", "kumpis": "Ham",
            "mentė": "Shoulder", "išpjova": "Tenderloin",
            "šonkauliai": "Ribs", "filė": "Fillet", "kepsniai": "Steaks",
            "dešrelės": "Sausages", "dešrelė": "Sausage",
            "mėsa": "Meat", "troškinimui": "for Stewing",
            "pievagrybiai": "Mushrooms", "grybai": "Mushrooms",
            "paprikos": "Peppers", "svogūnai": "Onions",
            "morkos": "Carrots", "pomidorai": "Tomatoes",
            "bulvės": "Potatoes", "cukinijos": "Zucchini",
            "baklažanai": "Eggplants", "salotos": "Salad",
            "sūris": "Cheese", "pienas": "Milk",
            "kečupas": "Ketchup", "marinatas": "Marinade",
            "bandelės": "Buns", "bandelė": "Bun",
        }
        for lt_word, en_word in en_map.items():
            name_en = re.sub(re.escape(lt_word), en_word, name_en, flags=re.IGNORECASE)
        # Capitalize first letter of each word
        name_en = " ".join(w.capitalize() for w in name_en.split())

        item = {
            "product_id": pid,
            "name_en": name_en,
            "name_lt": name.strip(),
            "brand": brand,
            "canonical_category": best_cat,
            "subcategory": None,
            "is_food": best_cat not in ("cleaning", "laundry", "paper-products", "personal-care", "health", "pet-food", "baby-food", "other"),
            "size": {"value": size_val, "unit": size_unit},
            "attributes": {"category": cat_lt} if cat_lt else {},
            "search_text": f"{name_en} {brand or ''} {cat_lt}".strip(),
            "query_variants": [name.strip(), name_en],
        }
        items.append(item)

    _db_save_by_id(items, source="auto-keyword")
    return {"enriched": len(items)}


@app.post("/enrich/auto/status")
def enrich_auto_status():
    """Check how many products still need enrichment."""
    conn = get_db()
    try:
        total = conn.execute("SELECT COUNT(*) FROM Product").fetchone()[0]
        done = conn.execute("SELECT COUNT(*) FROM Product WHERE enrichmentVersion = ?", (ENRICH_VERSION,)).fetchone()[0]
        return {"total": total, "enriched": done, "remaining": total - done}
    finally:
        conn.close()
def enrich_reembed(body: dict):
    """Re-embed enriched products and embed new ones. Body: {'count': N}."""
    count = body.get("count", 20)
    conn = get_db_rw()
    try:
        _reembed_enriched(conn, count)
    finally:
        conn.close()
    new_result = _embed_new_products()
    return {
        "reembedded": count,
        "new": new_result.get("embedded", 0),
        "total": len(emb_module.product_ids),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
