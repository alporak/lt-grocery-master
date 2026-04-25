import json, asyncio, logging, re
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

def _extract_json_object(text: str) -> str | None:
    if not text:
        return None
    s = text.strip()
    if s.startswith("```"):
        s = re.sub(r"^```(?:json)?\s*", "", s, flags=re.IGNORECASE)
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

async def _gemini_call(api_key: str, rows: list) -> tuple[list, str | None]:
    from google import genai
    from google.genai import types

    lines =[f"Product {i+1}: {_build_product_text(row)}" for i, row in enumerate(rows)]
    user_prompt = "\n".join(lines)

    cfg_kwargs: dict = {
        "system_instruction": BULK_ENRICH_SYSTEM_PROMPT,
        "temperature": 0.5,
        # FIX 1: Increased token limit to prevent truncated JSON responses.
        "max_output_tokens": 65536,
        "response_mime_type": "application/json",
    }
    if GEMINI_THINKING_BUDGET > 0:
        cfg_kwargs["thinking_config"] = types.ThinkingConfig(thinking_budget=GEMINI_THINKING_BUDGET)

    client = genai.Client(api_key=api_key)
    
    log.info(f"[Gemini] Yollanıyor: {len(rows)} ürün ({GEMINI_MODEL} modeliyle)... Lütfen bekleyin.")
    
    for attempt in range(3):
        try:
            response = await client.aio.models.generate_content(
                model=GEMINI_MODEL,
                contents=user_prompt,
                config=types.GenerateContentConfig(**cfg_kwargs),
            )
            
            try:
                text = response.text
                log.info(f"[Gemini] Yanıt geldi! İşleniyor... (Boyut: {len(text)} karakter)")
            except ValueError as e:
                return[], f"Yanıt metni engellendi veya eksik: {e}"
                
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                log.warning("[Gemini] Gelen JSON bozuk, kurtarma deneniyor...")
                extracted = _extract_json_object(text)
                if not extracted:
                    return [], f"JSON parse edilemedi: {text[:100]}..."
                parsed = json.loads(extracted)
                
            items = parsed.get("results",[])
            if not isinstance(items, list):
                items = [parsed]
                
            return items, None
            
        except Exception as e:
            msg = str(e)
            # FIX 2: Added '503' to the retry condition to handle server overload.
            if "429" in msg or "RESOURCE_EXHAUSTED" in msg or "503" in msg:
                wait_time = 10 * (attempt + 1)
                log.warning(f"[Gemini] Geçici sunucu hatası ({msg[:20]})! {wait_time} saniye bekleniyor... (Deneme {attempt+1}/3)")
                await asyncio.sleep(wait_time)
                continue
            log.error(f"[Gemini] Beklenmeyen hata: {msg}")
            return[], msg
            
    return[], "Maksimum deneme sayısına ulaşıldı."

async def _gemini_enrich_batch(rows: list) -> tuple[int, int, str | None]:
    if not GEMINI_API_KEY:
        return 0, len(rows), "No GEMINI_API_KEY configured"
    items, err = await _gemini_call(GEMINI_API_KEY, rows)
    if err:
        log.error(f"[Gemini] Batch hatası: {err}")
        # Mark all as failed since the batch call itself failed
        _db_save_batch(rows, [], source="auto-failed") 
        return 0, len(rows), err
    
    _db_save_batch(rows, items, source="auto")
    enriched = sum(1 for i, r in enumerate(rows) if i < len(items) and isinstance(items[i], dict) and ("name_en" in items[i] or "name_clean" in items[i]))
    failed = len(rows) - enriched
    log.info(f"[Gemini] {enriched} ürün işlendi ({failed} eşleşmedi/başarısız — tekrar denenecek).")
    return enriched, failed, None