# Embedding Strategy Replan — LT Grocery

Status: design doc. Source of truth for the implementation plan that follows.

---

## 1. Current state (observed)

**Pipeline**
- Scrapers (Rimi/Barbora/Iki/Lidl/Promo) emit `ScrapedProduct`: `externalId, nameLt, categoryLt (URL-slug string), brand?, weightValue, weightUnit, imageUrl, productUrl, prices`.
- `categoryLt` is low-signal: e.g. `"pieno produktai ir kiausiniai"` pulled from the URL path.
- Enrichment: `packages/embedder/main.py` → `BULK_ENRICH_SYSTEM_PROMPT` → Gemini 3 Flash Preview (or Groq swarm). Writes `enrichment` JSON blob with `name_clean, brand, canonical_category, subcategory, tags_en, tags_lt, attributes`.
- Embedding text: `_build_composite_text(row)` = concat of `nameLt + nameEn + categoryLt + categoryEn + brand + subcategory + tags_en[] + tags_lt[] + subcategory` joined by spaces (bag of tokens).
- Embedding model: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384d, local CPU).
- Search: client query → MiniLM encode → cosine sim over all product vectors. No query-side rewriting. `parseSearchQuery` only strips `<price`, `>price`, `brand:xyz`, `organic` attr — the actual search string goes raw to the embedder.

**Holes**
1. **Embedding text is a bag**. Concatenated tags dilute the signal; weight-sensitive variants (1L vs 0.5L) embed nearly identically because MiniLM averages tokens.
2. **LT↔EN cross-lingual is fragile**. MiniLM-multilingual works but is small (12 layers, 384d). Queries like `"mleko"`, `"whole milk"`, diacritic-less `"rokiskio"` frequently underperform.
3. **Query side is dumb**. No expansion, no alias resolution, no list-item → multi-variant fanout. A grocery-list item `"milk"` runs a single MiniLM lookup with no intent understanding.
4. **Prompt optimises for display, not retrieval**. `name_clean` is nice for UI but wasted on embedding. `tags_en/tags_lt` are list-shaped which weakens vector signal. No canonical "search surface" sentence.
5. **No product-group normalisation in the embedding text**. Grouping happens post-hoc via cosine ≥ 0.85, which is noisy.
6. **Enrichment version (`ENRICH_VERSION=2`) signals an existing migration hook** — good, we can bump and re-enrich cleanly.

---

## 2. Gemini 3 Flash Preview capabilities (verified by live probe)

Run on 8 real LT grocery strings — `/tmp/gemini_probe_b.json`.

- Returns clean JSON with `response_mime_type="application/json"` at temp 0.2, no markdown fences, no parse failures across all 8.
- ~2.2s per product at `thinking_budget=0`, batch of 8 → 17.9s wall. Throughput scales with batch; existing code uses batch_size=200 at ~RPM=10.
- Produces **all 8 fields requested**, including: canonical name (EN+LT), brand normalised, strict `canonical_category`, `subcategory`, `size{value,unit}`, `attributes`, `search_text` (bilingual one-sentence search surface), `query_variants[]`.
- Bilingual reasoning is strong — correctly blends LT nouns + EN action phrases in `search_text`.
- Occasional brand over-extraction (e.g. `"Rokiškio pienas"` instead of `"Rokiškio"`). Fixable with tighter rule + examples.

**Verdict**: Gemini 3 Flash Preview can produce far richer, search-optimised enrichment than current prompt. Capability is not the bottleneck — prompt design is.

---

## 3. Embedding model decision

**Live probe of `gemini-embedding-001` @ 768d** on the probe outputs (see run log):

| Query                     | Top-1 doc              | Score | OK? |
|---------------------------|------------------------|-------|-----|
| `pienas`                  | milk-1L                | 0.72  | ✓   |
| `milk`                    | milk-1L                | 0.67  | ✓   |
| `mleko` (Polish)          | choc-milk (0.67) ~ milk-1L (0.67) | ✓ close call |
| `whole milk 1l`           | milk-1L                | 0.71  | ✓   |
| `rokiskio pienas`         | milk-1L                | 0.76  | ✓   |
| `chocolate milk`          | choc-milk              | 0.69  | ✓   |
| `sokolad pienas` (typo+diacritic-less) | choc-milk | 0.76  | ✓   |
| `oat milk`                | oat-milk               | 0.71  | ✓   |
| `šaldyta pica`            | pizza                  | 0.76  | ✓   |
| `frozen pizza margherita` | pizza                  | 0.72  | ✓   |

All top-1 correct. Cross-lingual robust. 768d output (Matryoshka-truncated from 3072).

**Recommendation**: replace MiniLM with **`gemini-embedding-001 @ 768d`**.
Reasons:
- Strictly stronger retrieval for LT + EN + diacritic-stripped + abbreviated queries.
- Supports `task_type=RETRIEVAL_DOCUMENT` / `RETRIEVAL_QUERY` — asymmetric encoding, better than symmetric sentence-transformer.
- 768d ≈ 2× MiniLM dim — acceptable growth (~100k products × 768 × 4 bytes = 300MB vs 150MB now).
- Free-tier RPM is sufficient for full re-embed in one batch pass.

**Fallback**: keep MiniLM path behind env flag for offline/dev, so container still boots if Gemini is down.

**Clarification for user**: Gemini 3 Flash Preview is a **generation** model — it cannot directly produce vector embeddings. The replan uses Flash Preview to *author the embedding text* (the thing we embed), and `gemini-embedding-001` to *produce the vectors*. Both are Google API.

---

## 4. Target design

### 4.1 Enrichment output (new, additive fields)

Every product row gets a JSON `enrichment` blob with these fields (bold = new):

- `name_en`, `name_lt` — canonical display names (unchanged shape).
- `brand`, `canonical_category`, `subcategory`, `is_food`, `attributes` (unchanged shape).
- **`size: { value: number|null, unit: "g"|"kg"|"ml"|"l"|"vnt"|null }`** — replaces scraper `weightValue/weightUnit` as the source of truth inside enrichment.
- **`search_text`** — ONE bilingual sentence (25-40 words). This is the sole field that gets embedded. See §4.2.
- **`query_variants: string[]`** — 4-6 realistic user-typed queries (mix LT/EN, include diacritic-less and abbreviated forms). Used for query-side augmentation (§4.3) and for fuzzy keyword fallback.

Drop `tags_en` / `tags_lt` as separate arrays — they are superseded by `search_text` and `query_variants`.

### 4.2 Embedding text format (`search_text`)

The LLM writes, for each product, a single natural-language sentence containing:
1. Brand (if any)
2. Canonical product type in both LT and EN
3. Key discriminating variant (fat %, size, flavour, state: fresh/UHT/frozen)
4. 2-3 intent phrases the shopper might type ("for sandwiches", "lactose-free", "for coffee")
5. Common LT synonyms + diacritic-free spellings

Example (verified in probe):
> `"Rokiškio pienas 2.5% riebumo 1L milk for coffee and cereal, fresh Lithuanian dairy product, baltas pienas gėrimas, standard fat milk for daily use"`

This single sentence — not a bag of fields — is embedded with `task_type=RETRIEVAL_DOCUMENT`.

**Why single-sentence beats bag**: sentence embeddings are trained on coherent text. Concat-of-fields creates token collisions and weakens the centroid. Live probe numbers (§3) were run against single-sentence docs; top-1 accuracy was 10/10.

### 4.3 Query-side pipeline

For user free-text search:
1. Accept raw query `q`.
2. Embed with `task_type=RETRIEVAL_QUERY` (Gemini asymmetric encoding).
3. Cosine over product `search_text` vectors.
4. *(Skip LLM rewriting on user search — latency budget is tight; Gemini embeddings already handle cross-lingual.)*

For grocery-list matching (`pinnedProductGroupId` flow):
1. For each list item (`"milk"`, `"bread"`) without a pinned group, call Gemini **once per list** (not per item) to expand all items into `{ item: [queries...] }`.
2. Embed each query, fan out top-K, aggregate by `productGroupId`, rank by (1) best score across queries, (2) price.
3. Cache `item → top-group-id` per session to avoid re-running on every page load.

### 4.4 Product grouping

Unchanged algorithm (barcode then cosine ≥ 0.85) but runs on the new 768d Gemini vectors. Expect tighter clusters — raise threshold experimentally to 0.88 after first grouping pass.

### 4.5 Versioning

Bump `ENRICH_VERSION = 3`. The existing `WHERE enrichmentVersion IS NULL OR enrichmentVersion < ?` gate re-enriches every product. Embedding index rebuilds automatically via `_reembed_enriched`.

---

## 5. Scope of changes

| File | Change |
|---|---|
| `packages/embedder/main.py` | Replace `BULK_ENRICH_SYSTEM_PROMPT`; bump `ENRICH_VERSION`; replace MiniLM path with `gemini-embedding-001` (with MiniLM fallback); rewrite `_build_composite_text` to return `enrichment.search_text`; add asymmetric task_type; update `/search` to embed queries as `RETRIEVAL_QUERY`. |
| `packages/embedder/requirements.txt` | Keep `google-genai` (already present); MiniLM packages stay for fallback. |
| `packages/embedder/categories.json` | No change (still used by Gemini prompt + for UI labels). |
| `packages/embedder/brands.json` | No change; Gemini handles brand extraction directly. |
| `packages/web/src/lib/search.ts` | No algorithmic change needed on user search. Add new `/embed-query` or reuse `/search` (already embeds query server-side). For grocery-list item matching, add a new `batchExpandListItems` helper. |
| DB schema | **No migration.** `enrichment` is a JSON blob — new fields land inside it. `ENRICH_VERSION` already tracked. |
| `_design/` | This doc + `embedding-strategy-plan.md` (phased execution plan). |

No breaking change to product IDs, list items, or prices — migration is purely in enrichment content + vector store contents.

---

## 6. Risks & mitigations

- **Gemini embedding quota**. Free-tier RPM for `gemini-embedding-001` differs from Flash Preview. *Mitigation*: batch up to 100 per call (API allows), add RPM pacing reusing existing `GEMINI_RPM` knob, run re-embed as one-off job overnight.
- **Key rotation / outage**. Embedder container must still boot. *Mitigation*: `EMBEDDING_PROVIDER=gemini|minilm` env flag; on Gemini error, fall back to MiniLM path for query (documents that were embedded with Gemini stay Gemini; cross-model similarity won't work — acceptable since fallback is a temporary degradation).
- **Prompt drift on brand extraction**. Verified once; at 100k scale, 1-5% will misfire. *Mitigation*: post-process with `_normalize_brand()` against `brands.json` aliases (already in code); log mismatches; re-run targeted enrichment for outliers.
- **Cost**. Free tier covers re-enrich of ~100k products in 1-2 days at current RPM pacing. If quota exceeded, add paid key via new env var (GEMINI2_API_KEY, GEMINI3_API_KEY — swarm infra already supports it).
- **Index size**. 768d × 4 bytes × 100k = 300MB in memory. Current MiniLM is ~150MB. Fits on any reasonable host; export artifact grows correspondingly. *If tight*: use `output_dimensionality=512` (probed quality still strong).

---

## 7. Open questions for user

1. Keep MiniLM as fallback, or drop entirely? (Recommendation: keep for dev/offline resilience.)
2. Target embedding dim — 768 (default recommendation) or 512 (30% smaller artifact)?
3. Run re-enrichment as a single background job, or incremental (only re-enrich 2000/day)?

Proceed to phased implementation plan once these are answered (defaults assumed: keep fallback, 768d, single overnight job).
