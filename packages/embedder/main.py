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
from db import get_db, get_db_rw, _run_db_migrations, _db_save_batch
import embeddings as emb_module
from embeddings import (load_embeddings, save_embeddings, _embed_texts,
                        _embed_new_products, _reembed_enriched)
from enrichment import BULK_ENRICH_SYSTEM_PROMPT, _gemini_call, _gemini_enrich_batch
from grouping import _do_grouping

# --- Global state ---
canonical_categories: list[dict] = []
category_embeddings: Optional[np.ndarray] = None
known_brands: list[dict] = []  # loaded from brands.json


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
    texts = []
    for cat in canonical_categories:
        parts = [cat["en"], cat["lt"]]
        parts.extend(cat.get("keywords", []))
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
        "embeddings_count": len(emb_module.product_ids),
        "categories_count": len(canonical_categories),
    }



@app.post("/reset")
def reset():
    """Clear all embeddings from memory and disk."""
    emb_module.embeddings = None
    emb_module.product_ids = []
    emb_module.product_store_ids = []
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
        # Fill any missing items with just their original name
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
        return {"matches": []}

    # Separate cached vs uncached items
    cache_hits: dict[int, tuple[int | None, float]] = {}
    uncached: list[dict] = []
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
    all_queries: list[str] = []
    query_item_map: list[int] = []  # parallel: which item_id each query belongs to
    for item in uncached:
        for q in expanded.get(item["id"], [item["name"]]):
            all_queries.append(q)
            query_item_map.append(item["id"])

    matches_out: list[dict] = []

    # Add cache hits first
    for item in req.items:
        iid = item["id"]
        if iid in cache_hits:
            gid, score = cache_hits[iid]
            matches_out.append({"id": iid, "group_id": gid, "score": round(score, 4), "product_ids": []})

    if all_queries:
        query_vecs = _embed_texts(all_queries, "RETRIEVAL_QUERY")  # (Q, dim)

        # Build store mask
        store_set = set(req.store_ids)
        if store_set:
            mask = np.array([sid in store_set for sid in emb_module.product_store_ids], dtype=bool)
        else:
            mask = np.ones(len(emb_module.product_ids), dtype=bool)

        # Load product group mapping from DB
        conn = get_db()
        try:
            group_rows = conn.execute(
                "SELECT id, productGroupId FROM Product WHERE productGroupId IS NOT NULL"
            ).fetchall()
        finally:
            conn.close()
        pid_to_group: dict[int, int] = {r["id"]: r["productGroupId"] for r in group_rows}

        # Score: for each item, take max sim over its queries, group by productGroupId
        item_queries: dict[int, list[int]] = {}
        for qi, iid in enumerate(query_item_map):
            item_queries.setdefault(iid, []).append(qi)

        emb_arr = emb_module.embeddings  # (P, dim)

        for item in uncached:
            iid = item["id"]
            qi_list = item_queries.get(iid, [])
            if not qi_list:
                matches_out.append({"id": iid, "group_id": None, "score": 0.0, "product_ids": []})
                continue

            # Max-over-queries similarity per product
            q_vecs = query_vecs[qi_list]   # (Q_i, dim)
            sims = (emb_arr @ q_vecs.T)    # (P, Q_i)
            if store_set:
                sims[~mask, :] = -1.0
            max_sims = sims.max(axis=1)    # (P,)

            top_k = min(req.top_k, len(emb_module.product_ids))
            top_idx = np.argpartition(max_sims, -top_k)[-top_k:]
            top_idx = top_idx[np.argsort(max_sims[top_idx])[::-1]]

            # Group by productGroupId
            group_scores: dict[int, float] = {}
            group_pids: dict[int, list[int]] = {}
            ungrouped_best = (None, 0.0, [])

            for idx in top_idx:
                pid = emb_module.product_ids[idx]
                sc = float(max_sims[idx])
                if sc <= 0:
                    break
                gid = pid_to_group.get(pid)
                if gid:
                    if gid not in group_scores or sc > group_scores[gid]:
                        group_scores[gid] = sc
                    group_pids.setdefault(gid, []).append(pid)
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
                # Evict oldest key
                oldest = next(iter(_match_cache))
                del _match_cache[oldest]

            matches_out.append({
                "id": iid,
                "group_id": best_gid,
                "score": round(best_score, 4),
                "product_ids": best_pids[:10],
            })

    # Restore order to match input
    order = {item["id"]: i for i, item in enumerate(req.items)}
    matches_out.sort(key=lambda m: order.get(m["id"], 999))
    return {"matches": matches_out}



class EnrichPreviewRequest(BaseModel):
    product_ids: list[int]


@app.post("/enrich/preview")
async def enrich_preview(req: EnrichPreviewRequest):
    """Run Gemini enrichment on specific product IDs and return raw JSON without writing to DB."""
    if not GEMINI_API_KEY:
        raise HTTPException(503, "GEMINI_API_KEY not configured")
    if not req.product_ids:
        return {"results": []}

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
        return {"results": []}

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

    delay = (60.0 / GEMINI_RPM) * 1.2  # conservative pacing

    for i in range(0, total, GEMINI_BATCH_SIZE):
        if not state["running"]:
            log.info("[BulkEnrich] Stopped by request.")
            break
        batch = [dict(r) for r in rows[i:i + GEMINI_BATCH_SIZE]]
        items, err = await _gemini_call(GEMINI_API_KEY, batch)
        if err:
            log.warning(f"[BulkEnrich] Batch error: {err[:120]}")
            state["failed"] += len(batch)
        else:
            _db_save_batch(batch, items, source="auto")
            enriched = sum(
                1 for j, r in enumerate(batch)
                if j < len(items) and isinstance(items[j], dict) and ("name_en" in items[j] or "name_clean" in items[j])
            )
            state["done"] += enriched
            state["failed"] += len(batch) - enriched
            log.info(f"[BulkEnrich] {state['done']}/{total} done, {state['failed']} failed")
        if i + GEMINI_BATCH_SIZE < total:
            await asyncio.sleep(delay)

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


# --- Internal helpers ---

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

        id_to_idx = {pid: i for i, pid in enumerate(emb_module.product_ids)}

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
            from enrichment import _build_product_text
            texts = [_build_product_text(r) for r in rows]
            vecs = _embed_texts(texts, "RETRIEVAL_DOCUMENT")
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
