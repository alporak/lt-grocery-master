import sqlite3, json, logging
from config import DB_PATH, ENRICH_VERSION

log = logging.getLogger("embedder")

_CATEGORY_IDS =[
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

def _run_db_migrations():
    conn = get_db_rw()
    try:
        existing = {row[1] for row in conn.execute("PRAGMA table_info(Product)").fetchall()}
        migrations =[
            ("subcategory", "TEXT"),
            ("enrichmentVersion", "INTEGER"),
        ]
        for col, col_type in migrations:
            if col not in existing:
                conn.execute(f"ALTER TABLE Product ADD COLUMN {col} {col_type}")
                log.info(f"[Migration] Added column Product.{col}")
        existing_gli = {row[1] for row in conn.execute("PRAGMA table_info(GroceryListItem)").fetchall()}
        gli_migrations =[
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

def get_db():
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn

def get_db_rw():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def _normalize_brand(brand: str | None) -> str | None:
    if not brand:
        return None
    brand = brand.strip()
    if not brand:
        return None
    if brand.isupper() and len(brand) <= 6:
        return brand
    if brand.isupper():
        brand = brand.title()
    return brand

def _validate_canonical_category(cat: str | None) -> str | None:
    if cat and cat in _CATEGORY_IDS_SET:
        return cat
    return None

def _db_save_batch(rows: list, items: list, source: str = "auto"):
    conn = get_db_rw()
    try:
        for i, row in enumerate(rows):
            if i < len(items) and isinstance(items[i], dict) and ("name_en" in items[i] or "name_clean" in items[i]):
                item = items[i]
                name_clean = item.get("name_en") or item.get("name_clean") or None
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

def _db_save_by_id(items: list, source: str = "opencode"):
    """Save enrichment items keyed by product_id instead of positional index."""
    conn = get_db_rw()
    try:
        ids = [it["product_id"] for it in items if isinstance(it, dict) and "product_id" in it and ("name_en" in it or "name_clean" in it)]
        if not ids:
            return
        placeholders = ",".join("?" * len(ids))
        rows = conn.execute(
            f"SELECT id FROM Product WHERE id IN ({placeholders})", ids
        ).fetchall()
        row_map = {r["id"]: r for r in rows}
        for item in items:
            if not isinstance(item, dict):
                continue
            pid = item.get("product_id")
            if not pid or pid not in row_map:
                continue
            if "name_en" not in item and "name_clean" not in item:
                continue
            name_clean = item.get("name_en") or item.get("name_clean") or None
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
                    pid,
                )
            )
        conn.commit()
    finally:
        conn.close()
