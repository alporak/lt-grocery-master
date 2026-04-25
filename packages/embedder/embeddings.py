import numpy as np, json, logging, time
from typing import Optional
from pathlib import Path
from config import (GEMINI_API_KEY, GEMINI_EMBEDDING_MODEL, GEMINI_EMBEDDING_DIM,
                    GEMINI_EMBEDDING_BATCH, GEMINI_RPM, EMBEDDINGS_DIR, DB_PATH, ENRICH_VERSION)
from db import get_db, get_db_rw

log = logging.getLogger("embedder")

# --- Global state ---
embeddings: Optional[np.ndarray] = None  # shape (N, dim)
product_ids: list[int] = []
product_store_ids: list[int] = []  # parallel array: storeId for each product


def load_embeddings():
    global embeddings, product_ids, product_store_ids
    emb_path = EMBEDDINGS_DIR / "embeddings.npy"
    ids_path = EMBEDDINGS_DIR / "product_ids.json"
    if emb_path.exists() and ids_path.exists():
        embeddings = np.load(str(emb_path))
        with open(ids_path) as f:
            data = json.load(f)
        product_ids = data["ids"]
        loaded_dim = data.get("embedding_dim")
        expected_dim = GEMINI_EMBEDDING_DIM
        if loaded_dim and loaded_dim != expected_dim:
            log.warning(f"[Embeddings] Dim mismatch: loaded {loaded_dim}d but provider expects {expected_dim}d. Clearing index — will rebuild.")
            embeddings = None
            product_ids = []
            product_store_ids = []
            return
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
        emb_dim = embeddings.shape[1] if embeddings is not None and len(embeddings.shape) > 1 else GEMINI_EMBEDDING_DIM
        json.dump({"ids": product_ids, "store_ids": product_store_ids, "embedding_dim": emb_dim}, f)
    log.info(f"Saved {len(product_ids)} embeddings to disk")


def _embed_texts_gemini(texts: list[str], task_type: str) -> np.ndarray:
    """Embed texts via gemini-embedding-001. Returns L2-normalised (N, dim) array."""
    from google import genai
    from google.genai import types as gtypes
    client = genai.Client(api_key=GEMINI_API_KEY)
    all_vecs: list[np.ndarray] = []
    for i in range(0, len(texts), GEMINI_EMBEDDING_BATCH):
        chunk = texts[i : i + GEMINI_EMBEDDING_BATCH]
        retries = 0
        while retries < 4:
            try:
                resp = client.models.embed_content(
                    model=GEMINI_EMBEDDING_MODEL,
                    contents=chunk,
                    config=gtypes.EmbedContentConfig(
                        task_type=task_type,
                        output_dimensionality=GEMINI_EMBEDDING_DIM,
                    ),
                )
                vecs = np.array([e.values for e in resp.embeddings], dtype=np.float32)
                norms = np.linalg.norm(vecs, axis=1, keepdims=True)
                norms = np.where(norms == 0, 1.0, norms)
                all_vecs.append(vecs / norms)
                break
            except Exception as e:
                msg = str(e)
                if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
                    wait = 30 * (retries + 1)
                    log.warning(f"[GeminiEmbed] Rate limited, waiting {wait}s (retry {retries+1}/4)")
                    import time as _time; _time.sleep(wait)
                    retries += 1
                else:
                    log.error(f"[GeminiEmbed] Error: {msg}")
                    raise
    return np.vstack(all_vecs) if all_vecs else np.zeros((0, GEMINI_EMBEDDING_DIM), dtype=np.float32)


def _embed_texts(texts: list[str], task_type: str = "RETRIEVAL_DOCUMENT") -> np.ndarray:
    return _embed_texts_gemini(texts, task_type)


def _build_composite_text(row) -> str:
    """Build rich text for embedding. Uses enrichment.search_text when available."""
    if row.get("enrichment"):
        try:
            enr = json.loads(row["enrichment"]) if isinstance(row["enrichment"], str) else row["enrichment"]
            st = enr.get("search_text")
            if st and isinstance(st, str) and len(st) > 10:
                return st
        except (json.JSONDecodeError, TypeError):
            pass
    # Fallback for unenriched products
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
    if row.get("enrichment"):
        try:
            enr = json.loads(row["enrichment"]) if isinstance(row["enrichment"], str) else row["enrichment"]
            if enr.get("tags_en"):
                parts.extend(enr["tags_en"])
            if enr.get("tags_lt"):
                parts.extend(enr["tags_lt"])
        except (json.JSONDecodeError, TypeError):
            pass
    return " ".join(parts)


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

        new_vecs = _embed_texts(texts, "RETRIEVAL_DOCUMENT")

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
        new_vecs = _embed_texts(texts, "RETRIEVAL_DOCUMENT")
        for i, idx in enumerate(indices):
            embeddings[idx] = new_vecs[i]
        save_embeddings()
        log.info(f"[Embed] Re-embedded {len(texts)} enriched products")
