import json, logging
import numpy as np
from config import DB_PATH
from db import get_db_rw
import embeddings as emb_module

log = logging.getLogger("embedder")


def _do_grouping() -> dict:
    """
    Group products using:
    1. Barcode matching (exact match across stores)
    2. Embedding similarity within same canonical category + compatible weight
    """
    if emb_module.embeddings is None or len(emb_module.product_ids) == 0:
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
        id_to_emb_idx = {pid: i for i, pid in enumerate(emb_module.product_ids)}

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
            cat_embs = emb_module.embeddings[indices]  # (N, 384)

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
