# Embedding Replan — Phased Implementation Plan

Paired with `_design/embedding-strategy-replan.md`. Each phase is self-contained: a fresh agent session can pick up any phase, execute it, and run its verification.

**Assumed answers to open questions**:
- Keep MiniLM as fallback via `EMBEDDING_PROVIDER` env flag.
- Embedding dim = 768.
- Re-enrichment = single overnight job, re-uses existing `/bulk-enrich` swarm manager.

---

## Phase 0 — Documentation Discovery (run once, before writing code)

**Allowed APIs** (verified live on 2026-04-23 against this repo's key):

- `google.genai.Client(api_key=...)` — already used in `packages/embedder/main.py` (`_gemini_call`).
- `client.models.generate_content(model=..., contents=..., config=types.GenerateContentConfig(...))` — synchronous; async via `client.aio.models.generate_content` (existing pattern in `main.py:928`).
- `types.GenerateContentConfig(system_instruction, temperature, max_output_tokens, response_mime_type, thinking_config)` — current code uses this shape.
- `client.models.embed_content(model="gemini-embedding-001", contents=[...], config=types.EmbedContentConfig(task_type=..., output_dimensionality=...))` — NEW for this plan. Returns `response.embeddings[i].values: list[float]`.
- `task_type` values: `"RETRIEVAL_DOCUMENT"` (for indexing products), `"RETRIEVAL_QUERY"` (for user searches). Asymmetric.
- `output_dimensionality`: 768 (our target), 1536, 3072 (default).

**Anti-patterns — do NOT invent**:
- No `gemini-3-flash-preview` embedding (Flash is a generation model; 404s on embed).
- No `text-embedding-004` on this key / API version (confirmed 404).
- No `response_schema` without verifying SDK version supports it in `GenerateContentConfig` — current code uses `response_mime_type="application/json"` with instructions, which works.
- No per-product Gemini call from the web request path — always batch, or use pre-computed vectors.

**Reference files** (read before editing):
- `packages/embedder/main.py` lines 52-67 (Gemini config), 783-831 (current prompt), 908-955 (current `_gemini_call`), 1706-1791 (current `_build_composite_text`, `_build_product_text`, `_embed_new_products`), 385-410 (`/search` endpoint), 1764-1791 (composite-text construction to change).
- `packages/web/src/lib/search.ts` lines 823-897 (`parseSearchQuery`, `semanticSearch`).
- `packages/embedder/bulk-enrich.py` (standalone worker — must also be updated if kept in use; lower priority, single file).
- `_design/embedding-strategy-replan.md` (target design).

**Verification**: before Phase 1, run `grep -n "GEMINI_EMBEDDING_MODEL\|gemini-embedding-001\|RETRIEVAL_DOCUMENT" packages/embedder/main.py` — must be empty (confirms we haven't started).

---

## Phase 1 — New enrichment prompt + `ENRICH_VERSION` bump

**Goal**: Gemini Flash Preview produces the new enrichment shape (`search_text`, `query_variants`, `size{}`). All existing products become "pending re-enrichment" via version gate.

**Changes**:

1. `packages/embedder/main.py`:
   - Bump `ENRICH_VERSION = 3` (line 42).
   - Replace `BULK_ENRICH_SYSTEM_PROMPT` (lines 783-831) with the prompt text from `_design/embedding-strategy-replan.md` §4 — copy verbatim the `PROMPT_B` block from `/tmp/gemini_probe.py` (lines 55-83, the string starting `"You enrich Lithuanian grocery products for semantic search..."`) into the module constant. This prompt is live-verified.
   - Update `_db_save_batch` (lines 856-893): on successful item, persist new fields by writing the full `item` dict to `enrichment` (already does). No column changes needed — `search_text`, `query_variants`, `size` live inside the JSON blob.
   - Keep `name_clean → nameEn` mapping for back-compat; additionally copy `item["name_en"]` if `name_clean` missing.

2. Live-verify the prompt before running at scale: add a `/enrich/preview` endpoint (POST body: `product_ids: int[]`) that runs Gemini on just those rows and returns the raw JSON without writing. ~30 lines, reuses `_gemini_call`.

**Verification**:
- `grep -n 'ENRICH_VERSION = 3' packages/embedder/main.py` → one hit.
- `grep -n 'search_text' packages/embedder/main.py` → at least one hit in the prompt string.
- Boot embedder, call `/enrich/preview` with 3 known product IDs, confirm returned JSON has `search_text`, `query_variants`, `size` fields populated and `canonical_category` ∈ `_CATEGORY_IDS_SET`.
- `SELECT COUNT(*) FROM Product WHERE enrichmentVersion < 3 OR enrichmentVersion IS NULL` → equals total product count (all need re-enrich).

**Anti-patterns**:
- Do NOT drop the old `tags_en`/`tags_lt` fields from `_db_save_batch`'s save path — leave them if LLM emits them, just stop relying on them.
- Do NOT invent a `response_schema` kwarg on `GenerateContentConfig` — keep `response_mime_type="application/json"` as the current code does.
- Do NOT change `_CATEGORY_IDS` list — prompt explicitly references it; changing causes silent miscategorisation.

---

## Phase 2 — Embedding pipeline: Gemini embeddings + MiniLM fallback

**Goal**: product documents and user queries are embedded via `gemini-embedding-001` at 768d, with MiniLM retained as a compile-time fallback. Embedding source-of-truth becomes `enrichment.search_text`.

**Changes to `packages/embedder/main.py`**:

1. New config block near line 68:
   ```
   EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "gemini")  # "gemini" | "minilm"
   GEMINI_EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
   GEMINI_EMBEDDING_DIM   = int(os.getenv("GEMINI_EMBEDDING_DIM", "768"))
   GEMINI_EMBEDDING_BATCH = int(os.getenv("GEMINI_EMBEDDING_BATCH", "100"))
   ```

2. New helper `_embed_texts_gemini(texts, task_type)`:
   - Uses existing `genai.Client(api_key=GEMINI_API_KEY)`.
   - Calls `client.models.embed_content(model=GEMINI_EMBEDDING_MODEL, contents=batch, config=types.EmbedContentConfig(task_type=task_type, output_dimensionality=GEMINI_EMBEDDING_DIM))`.
   - Returns a `np.ndarray` shape `(N, dim)`, already L2-normalised (normalise manually post-fetch: `v / ||v||`).
   - Retries on 429 with `retry-after` honour.
   - Splits input into chunks of `GEMINI_EMBEDDING_BATCH`.

3. New helper `_embed_texts(texts, task_type)` that routes on `EMBEDDING_PROVIDER`:
   - `"gemini"` → `_embed_texts_gemini(texts, task_type)`.
   - `"minilm"` → existing `model.encode(texts, normalize_embeddings=True)` (ignores `task_type`).

4. Refactor `_embed_new_products` (line 1717-1761):
   - Replace call to `model.encode(...)` with `_embed_texts(texts, "RETRIEVAL_DOCUMENT")`.
   - Replace `_build_composite_text(row)` body to return **`enrichment.search_text` only** when present, falling back to the current concat for pre-enriched products (so the system remains functional during re-enrichment rollout).

5. Refactor `/search` endpoint (lines 385-410):
   - Change `query_vec = model.encode([req.query], normalize_embeddings=True)` → `query_vec = _embed_texts([req.query], "RETRIEVAL_QUERY")`.
   - Keep scoring / filter logic unchanged.

6. Refactor `_reembed_enriched` (line 1835): same substitution (`_embed_texts(..., "RETRIEVAL_DOCUMENT")`).

7. `/categorize` endpoint (line 413) — currently uses MiniLM against pre-computed `category_embeddings`. Either (a) keep on MiniLM (categories are English keywords, simple signal, zero API cost), or (b) switch to Gemini. Recommendation: keep on MiniLM to avoid quota burn on categorisation. Leave `category_embeddings` loaded unchanged.

8. Embeddings export/import artifact (`_do_export` / `_do_import`, lines 1864-1995): update `"embedding_dim": GEMINI_EMBEDDING_DIM` and `"model": GEMINI_EMBEDDING_MODEL if EMBEDDING_PROVIDER=="gemini" else MODEL_NAME`. Import must reject a dim-mismatched artifact (already does via `if len(vec) == dim` guard — just ensure `dim` is read from artifact, not hard-coded 384).

**Verification**:
- `grep -n "_embed_texts_gemini\|gemini-embedding-001" packages/embedder/main.py` → at least 2 hits.
- Boot embedder with `EMBEDDING_PROVIDER=gemini`. `/health` returns OK.
- Boot embedder with `EMBEDDING_PROVIDER=minilm`. `/health` returns OK (fallback works).
- Manual sanity: `curl -X POST /search -d '{"query":"pienas","limit":3}'` returns products containing milk tokens in top-3. Same for `"milk"`, `"šaldyta pica"`.
- `EXPORT_PATH` artifact json has `"embedding_dim": 768` after one `/export` run.

**Anti-patterns**:
- Do NOT remove the `sentence-transformers` import or `model = SentenceTransformer(...)` init in `lifespan` — `/categorize` still uses it.
- Do NOT embed user queries as `RETRIEVAL_DOCUMENT` — asymmetry matters, retrieval quality drops ~5 points.
- Do NOT mix dims in the index: if re-embedding is partial, keep an `embedding_dim` sidecar in `product_ids.json` and refuse to concat vectors of different dims; drop the old `embeddings.npy` at migration start to force full rebuild.

---

## Phase 3 — Re-enrich + re-embed all products

**Goal**: every product in DB gets new `enrichment` JSON and a Gemini-based 768d vector, atomically.

**Changes** (no new code; just operational steps, callable via existing endpoints):

1. Ensure `_design/embedding-strategy-replan.md` and Phases 1-2 are merged.
2. Stop the periodic scrape cron (`docker-compose stop scraper` or pause cron) for the duration.
3. Reset vector store: `POST /reset` — clears `embeddings.npy`.
4. Trigger re-enrichment: `POST /bulk-enrich` — hits `_run_bulk_enrich` → `_bulk_enrich_manager` → fans out across GEMINI_API_KEY[1..3] workers. Because `ENRICH_VERSION` bumped, `_bulk_enrich_manager` query at lines 1287-1291 returns ALL products.
5. After manager completes, run `POST /process` which internally calls `_embed_new_products` → all products now get Gemini vectors from their new `enrichment.search_text`. Then `_do_grouping` rebuilds product groups, then `_do_export` writes the artifact.
6. Smoke test: `/search?query=pienas` → milk products top-3. `/categories-summary` → no category has >50% "other". Spot-check 10 random enriched rows for `search_text` sanity.

**Verification**:
- `SELECT COUNT(*) FROM Product WHERE enrichmentVersion = 3` = total product count.
- `len(product_ids)` in embedder memory = total count, `embeddings.shape == (count, 768)`.
- Product-intelligence artifact size proportional to count × (few KB/product). Commit to `lt-grocery-master-db` repo.

**Anti-patterns**:
- Do NOT run Phase 3 before Phase 2 is fully merged — `_embed_new_products` will still use MiniLM and you'll burn Gemini quota on enrichment for nothing.
- Do NOT skip the `/reset` step — stale 384d vectors will cause shape-mismatch errors on first `/search`.
- Do NOT let the scraper run mid-migration; new rows will partially embed with new code while old rows still have MiniLM vectors.

---

## Phase 4 — Query-side: grocery-list matching

**Goal**: `GroceryListItem.itemName` (free text like `"milk"`, `"bread"`) resolves to a `productGroupId` automatically via Gemini-assisted query fanout. Pinned items unaffected.

**Changes**:

1. New endpoint `POST /match-list` in `packages/embedder/main.py`:
   ```
   Request:  { items: [{ id: int, name: string }], store_ids?: int[], top_k?: int }
   Response: { matches: [{ id: int, group_id: int|null, score: float, product_ids: int[] }] }
   ```

2. Logic:
   - One Gemini Flash Preview call per request. System prompt: "For each grocery-list item, output 3-5 short realistic search queries (mix LT/EN). Return `{ items: [{ id, queries: [...] }] }`." (<400 tokens.)
   - Embed all expanded queries in one `embed_content` batch call (`task_type=RETRIEVAL_QUERY`).
   - For each original item, compute max cosine sim per product across its queries, group by `productGroupId`, pick best group.
   - Cache on `itemName` hash (in-memory LRU, 10k entries) — grocery lists repeat the same words often.

3. `packages/web/src/lib/search.ts`: add `batchMatchListItems(items)` that calls `/match-list`. Wire into the list-detail page (already referenced elsewhere as pinning UI).

**Verification**:
- Unit-like check: `curl -X POST /match-list -d '{"items":[{"id":1,"name":"milk"},{"id":2,"name":"duona"}]}'` returns group IDs whose representative products contain milk / bread.
- Latency: single call with 20 items should complete < 3s (1 LLM call ~1.5s + 1 embed batch ~0.5s + scoring local).
- Cache hit on second identical request < 50ms.

**Anti-patterns**:
- Do NOT call Gemini per list item — one batched call per list request.
- Do NOT embed each variant individually — single `embed_content` batch.
- Do NOT bypass the group layer — return `group_id`, not raw product IDs, so price comparison downstream still works.

---

## Phase 5 — Incremental re-enrich on new scrapes

**Goal**: newly scraped products get enriched + embedded without manual intervention, using the same Gemini pipeline.

**Changes**: already works via existing scheduler (`_gemini_scheduler`) + `_embed_new_products` once Phases 1-2 are in. Just re-enable scraper cron after Phase 3 finishes.

**Verification**:
- Run one scrape manually. New products appear with `enrichmentVersion IS NULL`.
- Within `GEMINI_WAIT_SECONDS`, they flip to `enrichmentVersion = 3` and gain `search_text`.
- Next `/search` call returns them.

---

## Final Verification (full-system)

Run all before declaring done:

1. `grep -n "paraphrase-multilingual-MiniLM" packages/embedder/main.py` — only inside MiniLM fallback branch.
2. `grep -n "ENRICH_VERSION = 3" packages/embedder/main.py` — exactly one.
3. DB: zero rows with `enrichmentVersion < 3` once Phase 3 completes.
4. `GET /health` returns `embeddings_count = total_product_count`.
5. Manual search tests (in order; all must return sensible top-3):
   - `"pienas"` → milk products
   - `"milk 1l"` → 1L milk products ahead of 0.5L
   - `"mleko"` → milk products (cross-lingual)
   - `"rokiskio"` (diacritic-less) → Rokiškio-brand products
   - `"šaldyta pica"` → frozen pizza
   - `"dish soap"` → Fairy / other dishwashing liquids
6. Grocery list: create a list with `["milk","bread","eggs","cheese"]`; each resolves to a non-null `productGroupId`.
7. `/bulk-enrich/status` shows no error; `/gemini-enrich/status` pending_count = 0.

Flip the old model artifact (`product-intelligence.json.gz`) into `lt-grocery-master-db` repo and commit.
