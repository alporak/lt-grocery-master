import json, asyncio, logging
from config import GEMINI_API_KEY, GEMINI_MODEL, GEMINI_THINKING_BUDGET, ENRICH_VERSION
from db import get_db, _db_save_batch, _CATEGORY_IDS

log = logging.getLogger("embedder")

BULK_ENRICH_SYSTEM_PROMPT = (
    "You enrich Lithuanian grocery products for semantic search and grocery-list matching.\n"
    "For EACH product produce a JSON object in the `results` array.\n\n"
    "Required fields:\n"
    "  name_en: clean English canonical name `[Brand] [Product] [Variant] [Size]` e.g. `Rokiškio Milk 2.5% 1L`\n"
    "  name_lt: same in clean Lithuanian\n"
    "  brand: producer brand only (null if none). Store banners (IKI, RIMI) only if truly store-brand.\n"
    "  canonical_category: EXACTLY one of: " + ", ".join(_CATEGORY_IDS) + "\n"
    "  subcategory: fine-grained type (e.g. 'UHT milk', 'chicken breast', 'dark chocolate')\n"
    "  is_food: bool\n"
    "  size: {\"value\": number_or_null, \"unit\": \"g\" or \"kg\" or \"ml\" or \"l\" or \"vnt\" or null}\n"
    "  attributes: 1-5 relevant filterable key-value pairs\n"
    "  search_text: ONE SENTENCE (25-40 words) combining EN and LT terms a shopper could use, "
    "written as natural search surface, NOT bullet list. Include brand, product type, common synonyms, "
    "key variant (size/percent/flavour), and 2-3 intent phrases like `for making sandwiches`, "
    "`lactose-free option`. This text will be embedded for retrieval.\n"
    "  query_variants: 4-6 realistic user queries (mix LT and EN, short and long, abbreviations, diacritic-less spellings ok)\n\n"
    "Rules:\n"
    "- Never invent products. If input is ambiguous, prefer generic terms.\n"
    "- `search_text` must help a grocery-list matcher: include the list-item words users type "
    "('milk', 'pienas', 'whole milk') AND discriminating variant tokens so size variants stay separable.\n"
    "- Output ONLY valid JSON: {\"results\": [...]}. No markdown. No explanations. "
    "Exactly one object per input product in `results` array.\n\n"
    "CRITICAL: Return ONLY valid JSON. No markdown. No explanations. "
    "Exactly one object per input product in `results` array."
)


def _build_product_text(row) -> str:
    parts = [row["nameLt"]]
    if row["nameEn"]:
        parts.append(row["nameEn"])
    if row["categoryLt"]:
        parts.append(row["categoryLt"])
    if row["brand"]:
        parts.append(row["brand"])
    return " | ".join(parts)


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
    enriched = sum(1 for i, r in enumerate(rows) if i < len(items) and isinstance(items[i], dict) and ("name_en" in items[i] or "name_clean" in items[i]))
    failed = len(rows) - enriched
    log.info(f"[Gemini] Enriched {enriched} products ({failed} mismatched/failed — will retry).")
    return enriched, failed, None
