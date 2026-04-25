# Embedder v2 — Implementation Plan

**Goal:** Rewrite the embedder service: Gemini-only (no MiniLM/Groq/Ollama/swarm),
LT/EN categorisation + cleaning via Gemini enrichment, semantic search kept,
monolith split into focused modules.

---

## Phase 0: Findings (READ-ONLY — do not change code)

### Files involved
| File | Lines | Role |
|---|---|---|
| `packages/embedder/main.py` | 2257 | Entire service — one giant file |
| `packages/embedder/bulk-enrich.py` | 449 | Redundant standalone enrichment script |
| `packages/embedder/requirements.txt` | 6 | Deps incl. sentence-transformers |
| `packages/embedder/Dockerfile` | 17 | Bakes in MiniLM model at build time |
| `packages/embedder/categories.json` | — | Canonical category list |
| `packages/embedder/brands.json` | — | Brand normalisation list |
| `docker-compose.yml` | 54 | Still passes `MODEL_NAME` + no EMBEDDING_PROVIDER |
| `packages/web/src/lib/search.ts` | 930 | `semanticSearch()` calls `POST /search` on embedder |

### What currently works (keep)
- `POST /search` — cosine sim on in-memory numpy array (already Gemini embeddings when `EMBEDDING_PROVIDER=gemini`)
- `POST /embed-batch` — external embed trigger
- `POST /match-list` — Gemini query expansion + semantic search
- `POST /group` / `_do_grouping` — barcode + embedding similarity grouping
- `POST /export` / `POST /import` — artifact round-trip
- `GET /health`, `/categories-summary`, `/category/{id}/brands`
- `POST /enrich/preview` — preview Gemini enrichment result
- `_gemini_call` — core Gemini enrichment API call
- `_build_composite_text` — uses enrichment.search_text for embedding
- `BULK_ENRICH_SYSTEM_PROMPT` — already updated to v3 schema (name_en, search_text, etc.)

### What to DELETE
| Symbol / file | Reason |
|---|---|
| `GROQ_API_KEY/URL/MODEL/BATCH_SIZE/REQUEST_INTERVAL` | Groq removed |
| `OLLAMA_URL/MODEL/BATCH_SIZE/CHUNK_SIZE/PARALLEL_REQUESTS` | Ollama removed |
| `GEMINI2_API_KEY`, `GEMINI3_API_KEY`, `GEMINI_API_KEYS list` | Single key only |
| `MULTI_PROVIDERS list` | Unused |
| `_llm_chat()` | Groq/Ollama LLM chat |
| `TranslateBatchRequest` + `POST /translate-batch` | Groq/Ollama translation |
| `EnrichRequest` + `POST /enrich` (Groq path) | Groq enrichment |
| `_api_worker()` | Groq/Ollama swarm worker |
| `_gemini_scheduler()` | Auto-scheduler (was already disabled) |
| `_gemini_state` scheduler fields | Scheduler removed |
| `POST /gemini-enrich/start`, `/stop`, `/run-once`, `/status` | Scheduler removed |
| `GET /ollama-health` | Ollama removed |
| `GET /providers` | Multi-key worker listing |
| `_has_multi_provider_keys()` | Multi-key check |
| `_bulk_enrich_manager` multi-key logic | Simplify to single call |
| `_gemini_worker` queue-based worker | Swarm removed |
| `_gemini_run_batch_once()` | Only needed by disabled scheduler |
| `TRANSLATE_SYSTEM_PROMPT` | Translation removed |
| `LIST_EXPAND_SYSTEM_PROMPT` | Inlined into `_expand_list_items` or kept |
| `model` global (SentenceTransformer) | MiniLM removed |
| `bulk-enrich.py` | Entire file deleted |
| `sentence-transformers==3.3.1` in requirements.txt | MiniLM removed |
| MiniLM download in Dockerfile | MiniLM removed |
| `MODEL_NAME` env var everywhere | MiniLM removed |

### Bugs to fix
1. **`_db_save_batch` line 1070**: `if "name_clean" in items[i]` — new prompt outputs `name_en` not `name_clean`.
   Fix: `if isinstance(items[i], dict) and ("name_en" in items[i] or "name_clean" in items[i])`

2. **`load_categories` uses `model.encode`** (line 151) — must switch to `_embed_texts_gemini`.
   BUT: `_embed_texts_gemini` is defined after `load_categories`. Either move or lazy-load.

3. **`_categorize_new_products` uses `model.encode`** (line 2069) — switch to `_embed_texts`.

4. **`/categorize` endpoint uses `model.encode`** (line 435) — switch to `_embed_texts`.

5. **`lifespan` loads MiniLM** (lines 195-197) — remove entirely.

6. **`_embed_new_products` calls `_build_composite_text`** but function is defined after it
   (minor ordering issue — fine in Python but will be cleaner after split).

### Token-efficiency notes (Gemini)
- `gemini-embedding-001` is correct model for embeddings (validated in obs 69-70)
- `GEMINI_EMBEDDING_DIM=768` is optimal default (768 is native dim)
- `GEMINI_EMBEDDING_BATCH=100` is safe (Gemini limit: 100 docs/call)
- For enrichment LLM: switch `GEMINI_MODEL` default to `gemini-2.0-flash` (cheaper than flash-preview)
- `GEMINI_THINKING_BUDGET=0` correct (no thinking = cheapest)
- Batching 250 products per LLM call (`GEMINI_BATCH_SIZE=250`) is aggressive but valid with large context

---

## Phase 1: Delete dead code in main.py

**Context needed:** Read `packages/embedder/main.py` in full.
**Goal:** Remove all Groq, Ollama, MiniLM, swarm, multi-key, and disabled scheduler code.
**Do NOT split into modules yet** — just cut dead code from the monolith.

### Step-by-step deletions (in order, top to bottom of file)

**Config section (lines ~30-80):**
- Delete: `MODEL_NAME`, all `GROQ_*`, all `OLLAMA_*` constants
- Delete: `GEMINI_API_KEYS` list (multi-key), keep only `GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")`
- Keep: all `GEMINI_*` single-key constants, `EMBEDDING_PROVIDER`, `GEMINI_EMBEDDING_*`
- Delete: `model = None` global (SentenceTransformer)

**Lifespan (lines ~191-228):**
- Delete: `from sentence_transformers import SentenceTransformer; model = SentenceTransformer(MODEL_NAME)` block
- Delete: `_gemini_state["scheduler_active"] = False` lines (x2)
- Delete: `if GEMINI_API_KEYS:` startup log block

**Endpoints to delete entirely:**
- `GET /ollama-health` (~lines 333-351)
- `POST /translate-batch` + `TranslateBatchRequest` + `TRANSLATE_SYSTEM_PROMPT` (~lines 635-719)
- `POST /enrich` + `EnrichRequest` (~lines 722-802) — Groq/Ollama path only; keep `/enrich/preview`
- `POST /process` + `ProcessRequest` (~lines 838-878) — calls Groq enrich; delete entire endpoint
- `GET /providers` (~lines 1438-1457)
- `POST /gemini-enrich/start`, `stop`, `run-once`, `status` (~lines 1615-1638)

**Internal functions to delete:**
- `_llm_chat()` (~lines 259-318)
- `_api_worker()` (~lines 1342-1431)
- `_has_multi_provider_keys()` (~line 1434)
- `_gemini_scheduler()` (~lines 1209-1252)
- `_gemini_run_batch_once()` (~lines 1255-1277)
- `_gemini_worker()` (queue-based, ~lines 1166-1206)

**Simplify `_bulk_enrich_manager`:**
- It currently takes `keys: list[str] | None` for multi-key swarm
- Rewrite to: fetch unenriched rows in batches of `GEMINI_BATCH_SIZE`, call `_gemini_call()` sequentially with rate pacing (`60/GEMINI_RPM` delay between calls), update `_bulk_enrich_state`
- Remove `asyncio.Queue` + worker spawning entirely
- Keep `POST /bulk-enrich`, `POST /bulk-enrich/stop`, `GET /bulk-enrich/status`

**Simplify `BulkEnrichRequest`:**
- Remove `worker_indices`, `providers`, `provider`, `provider_models` fields
- Keep as empty body (or remove entirely, use no request body)

**`_bulk_enrich_state`:**
- Remove `active_workers` field (no workers anymore)

**Delete `bulk-enrich.py`:**
```bash
rm packages/embedder/bulk-enrich.py
```

### Verification checklist
- [ ] `grep -n "GROQ\|groq\|Groq" main.py` → 0 results
- [ ] `grep -n "OLLAMA\|ollama\|Ollama" main.py` → 0 results (except maybe comments)
- [ ] `grep -n "SentenceTransformer\|sentence_transformer\|MODEL_NAME" main.py` → 0 results
- [ ] `grep -n "_api_worker\|_gemini_worker\|_gemini_scheduler\|_gemini_run_batch_once" main.py` → 0 results
- [ ] `grep -n "GEMINI2_API_KEY\|GEMINI3_API_KEY\|GEMINI_API_KEYS" main.py` → 0 results
- [ ] `python -c "import ast; ast.parse(open('main.py').read()); print('syntax ok')"` → passes
- [ ] `python main.py` starts without error (test with `DATA_DIR=/tmp GEMINI_API_KEY=test`)

---

## Phase 2: Fix bugs + switch categorization to Gemini

**Context needed:** Read `packages/embedder/main.py` (post-Phase-1).
**Goal:** All remaining `model.encode` calls replaced with `_embed_texts`. Fix `_db_save_batch` gate check.

### 2a. Fix `_db_save_batch` save gate

**File:** `main.py`  
**Find:** `if i < len(items) and isinstance(items[i], dict) and "name_clean" in items[i]:`  
**Replace with:** `if i < len(items) and isinstance(items[i], dict) and ("name_en" in items[i] or "name_clean" in items[i]):`

### 2b. Fix `load_categories` — replace `model.encode` with Gemini

**Current (line ~151):**
```python
if model is not None:
    category_embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
```

**Replace with:**
```python
if GEMINI_API_KEY:
    category_embeddings = _embed_texts_gemini(texts, "RETRIEVAL_DOCUMENT")
    log.info(f"Loaded {len(canonical_categories)} canonical categories with Gemini embeddings")
else:
    log.warning("[Categories] No GEMINI_API_KEY — category embeddings skipped")
```

NOTE: `_embed_texts_gemini` is currently defined at line ~1912, AFTER `load_categories`. 
Move `_embed_texts_gemini` and `_embed_texts` to BEFORE `load_categories` in the file, 
OR call `load_categories` from lifespan AFTER startup setup (it already is — Python resolves at call time, not definition time, so this is actually fine as-is).

### 2c. Fix `/categorize` endpoint — replace `model.encode`

**Current (line ~435):**
```python
vecs = model.encode(req.texts, normalize_embeddings=True, show_progress_bar=False, batch_size=64)
```
**Replace with:**
```python
vecs = _embed_texts(req.texts, "RETRIEVAL_DOCUMENT")
```

Also fix similarity with category_embeddings (already uses numpy `@` operator — stays the same).

### 2d. Fix `_categorize_new_products` — replace `model.encode`

**Current (line ~2069):**
```python
vecs = model.encode(texts, normalize_embeddings=True, show_progress_bar=True, batch_size=64)
```
**Replace with:**
```python
vecs = _embed_texts(texts, "RETRIEVAL_DOCUMENT")
```

### 2e. Remove MiniLM fallback from `_embed_texts`

**Current:**
```python
def _embed_texts(texts, task_type="RETRIEVAL_DOCUMENT"):
    if EMBEDDING_PROVIDER == "gemini":
        return _embed_texts_gemini(texts, task_type)
    return model.encode(texts, normalize_embeddings=True, show_progress_bar=False, batch_size=64)
```

**Replace with:**
```python
def _embed_texts(texts: list[str], task_type: str = "RETRIEVAL_DOCUMENT") -> np.ndarray:
    return _embed_texts_gemini(texts, task_type)
```

### 2f. Update `health` endpoint response

Remove `"model": MODEL_NAME` from `/health` response.
Replace with `"embedding_model": GEMINI_EMBEDDING_MODEL, "enrichment_model": GEMINI_MODEL`.

### Verification checklist
- [ ] `grep -n "model\.encode" main.py` → 0 results
- [ ] `grep -n "model is not None" main.py` → 0 results  
- [ ] Test: `curl -X POST /enrich/preview -d '{"product_ids":[1]}'` returns `name_en` field
- [ ] `_db_save_batch` no longer silently skips products with `name_en` responses

---

## Phase 3: Split monolith into modules

**Context needed:** Read `packages/embedder/main.py` (post-Phase-2). Should be ~1400 lines at this point.
**Goal:** Split into 5 focused files. No logic changes — pure restructuring.

### Target file structure
```
packages/embedder/
  config.py         # ~50 lines  — env vars + constants
  db.py             # ~120 lines — SQLite helpers + migrations + _db_save_batch + brand/cat helpers
  embeddings.py     # ~200 lines — Gemini embed, composite text builder, embed_new, reembed, search helpers
  enrichment.py     # ~150 lines — BULK_ENRICH_SYSTEM_PROMPT, _gemini_call, _build_product_text
  grouping.py       # ~180 lines — _do_grouping, _weights_compatible, _normalize_weight
  main.py           # ~700 lines — FastAPI app, lifespan, all endpoint handlers + _expand_list_items
```

### config.py
Move all constants from top of main.py:
```python
import os
from pathlib import Path

DATA_DIR = Path(os.getenv("DATA_DIR", "/app/data"))
DB_PATH = DATA_DIR / "grocery.db"
EMBEDDINGS_DIR = DATA_DIR / "embeddings"
CATEGORIES_PATH = Path(__file__).parent / "categories.json"
BRANDS_PATH = Path(__file__).parent / "brands.json"
EXPORT_PATH = DATA_DIR / "product-intelligence.json.gz"
ENRICH_VERSION = 3

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_BATCH_SIZE = int(os.getenv("GEMINI_BATCH_SIZE", "250"))
GEMINI_THINKING_BUDGET = int(os.getenv("GEMINI_THINKING_BUDGET", "0"))
GEMINI_WAIT_SECONDS = int(os.getenv("GEMINI_WAIT_SECONDS", "180"))
GEMINI_RPM = int(os.getenv("GEMINI_RPM", "10"))

EMBEDDING_PROVIDER = "gemini"  # hardcoded — MiniLM removed
GEMINI_EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
GEMINI_EMBEDDING_DIM = int(os.getenv("GEMINI_EMBEDDING_DIM", "768"))
GEMINI_EMBEDDING_BATCH = int(os.getenv("GEMINI_EMBEDDING_BATCH", "100"))
```

### db.py
Move: `get_db`, `get_db_rw`, `_run_db_migrations`, `_normalize_brand`, `_validate_canonical_category`, `_db_save_batch`, `_CATEGORY_IDS`, `_CATEGORY_IDS_SET`

Imports: `sqlite3, json, logging` + `from config import *`

### embeddings.py
Move: `_embed_texts_gemini`, `_embed_texts`, `_build_composite_text`, `_embed_new_products`, `_reembed_enriched`, `load_embeddings`, `save_embeddings`

Global state: `embeddings`, `product_ids`, `product_store_ids` — keep in this module

Imports: `numpy, logging, time` + `from config import *` + `from db import get_db, get_db_rw`

### enrichment.py
Move: `BULK_ENRICH_SYSTEM_PROMPT`, `_build_product_text`, `_gemini_call`, `_gemini_enrich_batch`

Imports: `json, asyncio, logging, google.genai` + `from config import *` + `from db import get_db, get_db_rw, _db_save_batch`

### grouping.py
Move: `_do_grouping`, `_weights_compatible`, `_normalize_weight`

Imports: `logging` + `from config import *` + `from db import get_db_rw` + `from embeddings import embeddings, product_ids`

### main.py (slimmed)
Keep: FastAPI app, lifespan, all endpoint route handlers, `_expand_list_items`, `_extract_json_object`, `_parse_llm_json_payload`, global state for bulk_enrich, `load_categories`, `load_brands`

Import from modules: `from config import *`, `from db import ...`, `from embeddings import ...`, `from enrichment import ...`, `from grouping import _do_grouping`

### Verification checklist
- [ ] `python -c "from main import app; print('import ok')"` — no import errors
- [ ] All 5 modules import cleanly individually
- [ ] `GET /health` returns 200
- [ ] `POST /bulk-enrich` triggers and `/bulk-enrich/status` reflects progress
- [ ] `POST /search` returns results (requires populated embeddings)

---

## Phase 4: Dockerfile + requirements + docker-compose cleanup

**Context needed:** Read `packages/embedder/Dockerfile`, `packages/embedder/requirements.txt`, `docker-compose.yml`.

### requirements.txt
**Current:**
```
fastapi==0.115.6
uvicorn[standard]==0.34.0
sentence-transformers==3.3.1
numpy>=1.26,<2.0
httpx==0.28.1
google-genai>=1.0.0
```

**New:**
```
fastapi==0.115.6
uvicorn[standard]==0.34.0
numpy>=1.26,<2.0
httpx==0.28.1
google-genai>=1.0.0
```

### Dockerfile
**Current:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY packages/embedder/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')"
COPY packages/embedder/ .
EXPOSE 8000
CMD ["python", "main.py"]
```

**New:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY packages/embedder/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY packages/embedder/ .
EXPOSE 8000
CMD ["python", "main.py"]
```

### docker-compose.yml (embedder service)
**Remove** `MODEL_NAME` env var.  
**Add** `EMBEDDING_PROVIDER=gemini` (explicit, not relying on default).  
**Change** `GEMINI_MODEL` default comment to reflect `gemini-2.0-flash`.

**New embedder env block:**
```yaml
environment:
  - DATA_DIR=/app/data
  - GEMINI_API_KEY=${GEMINI_API_KEY}
  - GEMINI_MODEL=${GEMINI_MODEL:-gemini-2.0-flash}
  - GEMINI_BATCH_SIZE=${GEMINI_BATCH_SIZE:-250}
  - GEMINI_THINKING_BUDGET=${GEMINI_THINKING_BUDGET:-0}
  - GEMINI_EMBEDDING_MODEL=${GEMINI_EMBEDDING_MODEL:-gemini-embedding-001}
  - GEMINI_EMBEDDING_DIM=${GEMINI_EMBEDDING_DIM:-768}
```

### Verification checklist
- [ ] `docker build -f packages/embedder/Dockerfile -t embedder-v2 .` succeeds
- [ ] Image size reduced (no MiniLM ~200MB model)
- [ ] `docker run --rm -e GEMINI_API_KEY=test embedder-v2 python -c "from main import app"` succeeds

---

## Phase 5: End-to-end verification

**Context needed:** Running docker-compose stack with real GEMINI_API_KEY.

### Smoke tests (run against live service)

```bash
# Health
curl http://localhost:8000/health
# Expected: {"status":"ok","embedding_model":"gemini-embedding-001","enrichment_model":"gemini-2.0-flash",...}

# Enrich preview (pick a real product id from DB)
curl -X POST http://localhost:8000/enrich/preview \
  -H "Content-Type: application/json" \
  -d '{"product_ids":[1,2,3]}'
# Expected: results with name_en, name_lt, canonical_category, search_text fields

# Trigger bulk enrich
curl -X POST http://localhost:8000/bulk-enrich
# Expected: {"status":"triggered",...}

# Check status
curl http://localhost:8000/bulk-enrich/status
# Expected: running=true, done=N, total=M

# Semantic search (after embeddings populated)
curl -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d '{"query":"chicken breast","limit":5}'
# Expected: results with product IDs and scores

# Match list items
curl -X POST http://localhost:8000/match-list \
  -H "Content-Type: application/json" \
  -d '{"items":[{"id":1,"name":"pienas"}]}'
# Expected: matches with group_id and score
```

### Web integration check
- Browse to `/search?q=pienas` — results appear
- Browse to categories page — categories load
- Grocery list matching works (if feature is active)

### Anti-patterns to grep for after all phases
```bash
grep -rn "GROQ\|groq\|Ollama\|ollama\|SentenceTransformer\|sentence_transformer\|model\.encode\|GEMINI2\|GEMINI3\|_api_worker\|_gemini_worker\|_gemini_scheduler\|bulk-enrich\.py" packages/embedder/
```
→ Should return 0 matches.

---

## Allowed APIs (verified from codebase)

### Gemini SDK (`google-genai`)
```python
# Enrichment
from google import genai
from google.genai import types
client = genai.Client(api_key=GEMINI_API_KEY)
response = await client.aio.models.generate_content(
    model="gemini-2.0-flash",
    contents=user_prompt,
    config=types.GenerateContentConfig(
        system_instruction=...,
        temperature=1.0,
        max_output_tokens=65536,
        response_mime_type="application/json",
    ),
)

# Embeddings (synchronous — wraps in asyncio.to_thread if needed)
resp = client.models.embed_content(
    model="gemini-embedding-001",
    contents=chunk,  # list[str], max 100
    config=types.EmbedContentConfig(
        task_type="RETRIEVAL_DOCUMENT",  # or "RETRIEVAL_QUERY"
        output_dimensionality=768,
    ),
)
vecs = np.array([e.values for e in resp.embeddings], dtype=np.float32)
```

### Do NOT use
- `openai` SDK or any OpenAI-compatible endpoint for Gemini
- `google.generativeai` (old SDK — use `google.genai`)
- `model.encode()` from sentence-transformers
- Any Groq/Ollama/Mistral API endpoint
- Multi-key `GEMINI_API_KEYS` list pattern
