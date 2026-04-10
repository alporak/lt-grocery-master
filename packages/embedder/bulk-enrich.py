#!/usr/bin/env python3
"""
High-throughput bulk enrichment using ALL available Groq models in parallel.
Batches multiple products per API call and runs all models concurrently
for maximum speed (~15-17x faster than single-model sequential).

Usage:
  GROQ_API_KEY=gsk_... python3 bulk-enrich.py
  DATA_DIR=/app/data GROQ_API_KEY=gsk_... python3 bulk-enrich.py

  # Use only specific models:
  GROQ_MODELS=llama-3.1-8b-instant,llama-3.3-70b-versatile python3 bulk-enrich.py
"""

import json, os, sys, time, sqlite3, asyncio, logging, re

logging.basicConfig(level=logging.INFO, format="%(asctime)s [bulk-enrich] %(message)s")
log = logging.getLogger("bulk-enrich")

try:
    import httpx
except ImportError:
    log.error("httpx not installed. Run: pip install httpx")
    sys.exit(1)

# --- Config ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
DATA_DIR = os.getenv("DATA_DIR", "/app/data")
DB_PATH = os.path.join(DATA_DIR, "grocery.db")
COMMIT_EVERY = 200  # commit to DB every N enriched products

if not GROQ_API_KEY:
    log.error("Set GROQ_API_KEY env var. Get a free key at https://console.groq.com/keys")
    sys.exit(1)

# Each model has INDEPENDENT rate limits on Groq free tier.
# By running all models in parallel with batched requests, we multiply throughput.
#   tpm  = tokens per minute limit
#   rpd  = requests per day limit
#   batch = products per API call (tuned per model capacity)
MODELS = [
    {"id": "llama-3.1-8b-instant",                          "tpm": 6000,  "rpd": 14400, "batch": 10},
    {"id": "llama-3.3-70b-versatile",                       "tpm": 12000, "rpd": 1000,  "batch": 12},
    {"id": "meta-llama/llama-4-scout-17b-16e-instruct",     "tpm": 30000, "rpd": 1000,  "batch": 20},
    {"id": "meta-llama/llama-4-maverick-17b-128e-instruct", "tpm": 6000,  "rpd": 1000,  "batch": 10},
    {"id": "qwen/qwen3-32b",                                "tpm": 6000,  "rpd": 1000,  "batch": 10},
    {"id": "openai/gpt-oss-120b",                           "tpm": 8000,  "rpd": 1000,  "batch": 10},
    {"id": "openai/gpt-oss-20b",                            "tpm": 8000,  "rpd": 1000,  "batch": 10},
    {"id": "moonshotai/kimi-k2-instruct",                   "tpm": 10000, "rpd": 1000,  "batch": 12},
]

# Override to use only specific models:  GROQ_MODELS=model1,model2
_enabled = os.getenv("GROQ_MODELS", "")
ENABLED_MODELS = [m.strip() for m in _enabled.split(",") if m.strip()] if _enabled else None

SYSTEM_PROMPT = """You classify Lithuanian grocery products. Return a JSON object where keys are the product numbers (as strings) and values are classification objects.

Each classification object must have:
- name_clean: English product name with brand and size
- is_food: boolean (false for cleaning, pet food, hygiene, paper products)
- primary_category: broad English category (Dairy, Beverages, Cleaning Products, etc.)
- tags_en: 4-7 English search terms a shopper would use
- tags_lt: 4-7 Lithuanian search terms a shopper would use
- attributes: object with filterable properties (type, flavor, scent, packaging, etc.)

Example input:
1: Rokiškio pienas 2.5%, 1L | Rokiškio milk 2.5% fat | Pieno produktai | Rokiškio
2: Fairy indų ploviklis Lemon 900ml | Fairy dish soap Lemon 900ml | Valymo priemonės

Example output:
{"1":{"name_clean":"Rokiškio Milk 2.5% Fat 1L","is_food":true,"primary_category":"Dairy","tags_en":["milk","fresh milk","dairy","rokiškio","low fat"],"tags_lt":["pienas","šviežias pienas","rokiškio","pieno produktai"],"attributes":{"type":"fresh","packaging":"carton"}},"2":{"name_clean":"Fairy Dish Soap Lemon 900ml","is_food":false,"primary_category":"Cleaning Products","tags_en":["dish soap","dishwashing","cleaning","fairy","lemon"],"tags_lt":["indų ploviklis","valymo priemonė","fairy","citrinos kvapas"],"attributes":{"type":"liquid","scent":"lemon"}}}"""


def build_product_text(row) -> str:
    parts = [row["nameLt"]]
    if row["nameEn"]:
        parts.append(row["nameEn"])
    if row["categoryLt"]:
        parts.append(row["categoryLt"])
    if row["brand"]:
        parts.append(row["brand"])
    return " | ".join(parts)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def estimate_tokens(batch_size: int) -> int:
    """Rough estimate of total tokens (input + output) for a batched request."""
    return 600 + 130 * batch_size


class ModelWorker:
    """Async worker that processes products using a single Groq model."""

    def __init__(self, cfg: dict, client: httpx.AsyncClient,
                 queue: asyncio.Queue, result_queue: asyncio.Queue):
        self.model_id = cfg["id"]
        self.batch_size = cfg["batch"]
        self.tpm = cfg["tpm"]
        self.rpd = cfg["rpd"]
        self.client = client
        self.queue = queue
        self.result_queue = result_queue

        # Rate limiting: space requests to stay within TPM (use 90% to be safe)
        est_tokens = estimate_tokens(self.batch_size)
        self.min_interval = max(60.0 * est_tokens / (self.tpm * 0.9), 1.0)
        self.last_request = 0.0
        self.requests_today = 0

        # State
        self.enabled = True
        self.consecutive_errors = 0
        self.json_mode = True
        self.products_ok = 0
        self.products_fail = 0

    @property
    def est_products_per_min(self) -> float:
        return self.batch_size * 60.0 / self.min_interval

    async def run(self):
        log.info(f"  [{self.model_id}] batch={self.batch_size}, "
                 f"interval={self.min_interval:.1f}s, "
                 f"~{self.est_products_per_min:.0f} products/min")

        while self.enabled:
            # Pull a batch from the shared queue
            batch = []
            for _ in range(self.batch_size):
                try:
                    item = self.queue.get_nowait()
                    batch.append(item)
                except asyncio.QueueEmpty:
                    break

            if not batch:
                break  # queue empty, done

            # Check daily request limit
            if self.requests_today >= self.rpd:
                log.warning(f"[{self.model_id}] Daily limit ({self.rpd}) reached, stopping")
                for item in batch:
                    await self.queue.put(item)
                break

            # Rate limit
            now = time.monotonic()
            wait = self.min_interval - (now - self.last_request)
            if wait > 0:
                await asyncio.sleep(wait)

            # Call API
            results = await self._call_api(batch)
            self.last_request = time.monotonic()
            self.requests_today += 1

            if results is None:
                self.consecutive_errors += 1
                if self.consecutive_errors >= 3:
                    log.error(f"[{self.model_id}] {self.consecutive_errors} consecutive errors, disabling")
                    for item in batch:
                        item["retries"] = item.get("retries", 0) + 1
                        if item["retries"] < 3:
                            await self.queue.put(item)
                    self.enabled = False
                    break
                # Put back for retry
                for item in batch:
                    item["retries"] = item.get("retries", 0) + 1
                    if item["retries"] < 3:
                        await self.queue.put(item)
                    else:
                        self.products_fail += 1
                continue

            self.consecutive_errors = 0

            # Match results to batch items
            for i, item in enumerate(batch):
                key = str(i + 1)
                if key in results and self._validate(results[key]):
                    await self.result_queue.put((item["id"], results[key]))
                    self.products_ok += 1
                else:
                    self.products_fail += 1
                    item["retries"] = item.get("retries", 0) + 1
                    if item["retries"] < 3:
                        await self.queue.put(item)

        status = "DONE" if self.enabled else "DISABLED"
        log.info(f"[{self.model_id}] {status}: {self.products_ok} ok, "
                 f"{self.products_fail} fail, {self.requests_today} API calls")

    def _validate(self, obj) -> bool:
        return (isinstance(obj, dict)
                and "name_clean" in obj
                and "primary_category" in obj)

    async def _call_api(self, batch: list) -> dict | None:
        """Send a batched enrichment request. Returns {\"1\": {...}, \"2\": {...}} or None."""
        lines = [f"{i+1}: {item['text']}" for i, item in enumerate(batch)]
        user_content = "\n".join(lines)

        payload = {
            "model": self.model_id,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            "temperature": 0.1,
            "max_tokens": 180 * len(batch),
        }
        if self.json_mode:
            payload["response_format"] = {"type": "json_object"}

        try:
            resp = await self.client.post(GROQ_URL, json=payload, headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            })

            if resp.status_code == 429:
                retry_after = float(resp.headers.get("retry-after", "30"))
                log.warning(f"[{self.model_id}] Rate limited, waiting {retry_after:.0f}s")
                await asyncio.sleep(retry_after)
                # Widen the interval to avoid hitting limits again
                self.min_interval = min(self.min_interval * 1.5, 120)
                return None

            if resp.status_code == 400:
                err = resp.text[:300]
                if "json" in err.lower() or "response_format" in err.lower():
                    log.warning(f"[{self.model_id}] JSON mode unsupported, falling back to text")
                    self.json_mode = False
                    return await self._call_api(batch)
                log.warning(f"[{self.model_id}] Bad request: {err}")
                return None

            if resp.status_code == 404:
                log.error(f"[{self.model_id}] Model not found, disabling")
                self.enabled = False
                return None

            if resp.status_code != 200:
                log.warning(f"[{self.model_id}] HTTP {resp.status_code}: {resp.text[:200]}")
                return None

            result = resp.json()
            content = result["choices"][0]["message"]["content"]

            # Adjust rate based on actual token usage
            usage = result.get("usage", {})
            actual_tokens = usage.get("total_tokens", 0)
            if actual_tokens > 0:
                new_interval = max(60.0 * actual_tokens / (self.tpm * 0.9), 1.0)
                # Smooth adjustment
                self.min_interval = self.min_interval * 0.3 + new_interval * 0.7

            # Strip thinking tags (qwen3 etc.)
            content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()

            data = json.loads(content)
            if isinstance(data, dict):
                return data

        except json.JSONDecodeError:
            # Try extracting JSON from text response
            try:
                match = re.search(r'\{[\s\S]+\}', content)
                if match:
                    return json.loads(match.group())
            except Exception:
                pass
            log.warning(f"[{self.model_id}] Invalid JSON in response")
        except Exception as e:
            log.warning(f"[{self.model_id}] Error: {e}")

        return None


async def test_model(client: httpx.AsyncClient, cfg: dict) -> bool:
    """Quick test: send one product to verify the model works."""
    test_text = "Rokiškio pienas 2.5%, 1L | Rokiškio milk 2.5% fat | Pieno produktai"
    payload = {
        "model": cfg["id"],
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"1: {test_text}"},
        ],
        "temperature": 0.1,
        "max_tokens": 300,
        "response_format": {"type": "json_object"},
    }
    try:
        resp = await client.post(GROQ_URL, json=payload, headers={
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json",
        })
        if resp.status_code == 400:
            # Retry without JSON mode
            del payload["response_format"]
            resp = await client.post(GROQ_URL, json=payload, headers={
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json",
            })
        if resp.status_code == 200:
            result = resp.json()
            content = result["choices"][0]["message"]["content"]
            content = re.sub(r'<think>.*?</think>', '', content, flags=re.DOTALL).strip()
            data = json.loads(content)
            if isinstance(data, dict) and ("1" in data or "name_clean" in data):
                return True
    except Exception as e:
        log.debug(f"  Test failed for {cfg['id']}: {e}")
    return False


async def db_writer(conn, result_queue: asyncio.Queue, stop_event: asyncio.Event, stats: dict):
    """Single writer task that batches commits to SQLite."""
    pending = 0
    while not stop_event.is_set() or not result_queue.empty():
        try:
            product_id, enrichment = await asyncio.wait_for(result_queue.get(), timeout=2.0)
        except asyncio.TimeoutError:
            if pending > 0:
                conn.commit()
                pending = 0
            continue

        conn.execute(
            "UPDATE Product SET enrichment = ?, enrichedAt = datetime('now') WHERE id = ?",
            (json.dumps(enrichment), product_id)
        )
        pending += 1
        stats["enriched"] += 1

        if pending >= COMMIT_EVERY:
            conn.commit()
            log.info(f"Progress: {stats['enriched']} / {stats['total']} enriched "
                     f"({stats['enriched']*100//stats['total']}%)")
            pending = 0

    if pending > 0:
        conn.commit()


async def main():
    conn = get_db()

    total_pending = conn.execute("SELECT count(*) FROM Product WHERE enrichedAt IS NULL").fetchone()[0]
    total_done = conn.execute("SELECT count(*) FROM Product WHERE enrichedAt IS NOT NULL").fetchone()[0]
    log.info(f"Products: {total_done} enriched, {total_pending} pending")

    if total_pending == 0:
        log.info("Nothing to do!")
        conn.close()
        return

    # Filter models if GROQ_MODELS is set
    models = MODELS
    if ENABLED_MODELS:
        models = [m for m in models if m["id"] in ENABLED_MODELS]
        if not models:
            log.error(f"No models matched GROQ_MODELS={_enabled}")
            sys.exit(1)

    # Test which models actually work
    log.info(f"Testing {len(models)} models...")
    async with httpx.AsyncClient(timeout=30.0) as test_client:
        test_results = await asyncio.gather(
            *[test_model(test_client, cfg) for cfg in models]
        )
    # Brief pause to let test request rate limits reset
    await asyncio.sleep(2)

    working_models = [m for m, ok in zip(models, test_results) if ok]
    failed_models = [m["id"] for m, ok in zip(models, test_results) if not ok]
    if failed_models:
        log.warning(f"Models unavailable (skipping): {', '.join(failed_models)}")
    if not working_models:
        log.error("No working models found!")
        conn.close()
        sys.exit(1)

    # Estimate throughput
    total_ppm = sum(
        m["batch"] * m["tpm"] * 0.9 / estimate_tokens(m["batch"])
        for m in working_models
    )
    est_minutes = total_pending / total_ppm
    log.info(f"Using {len(working_models)} models, est ~{total_ppm:.0f} products/min, "
             f"~{est_minutes:.0f} min for {total_pending} products")

    # Load all pending products into queue
    queue = asyncio.Queue()
    rows = conn.execute(
        "SELECT id, nameLt, nameEn, categoryLt, categoryEn, brand "
        "FROM Product WHERE enrichedAt IS NULL"
    ).fetchall()

    for row in rows:
        queue.put_nowait({
            "id": row["id"],
            "text": build_product_text(row),
            "retries": 0,
        })

    result_queue = asyncio.Queue()
    stop_event = asyncio.Event()
    stats = {"enriched": 0, "total": total_pending}

    start_time = time.monotonic()

    async with httpx.AsyncClient(timeout=60.0) as client:
        # Start DB writer
        writer_task = asyncio.create_task(
            db_writer(conn, result_queue, stop_event, stats)
        )

        # Start one worker per model
        log.info("Starting workers:")
        worker_tasks = []
        for cfg in working_models:
            worker = ModelWorker(cfg, client, queue, result_queue)
            worker_tasks.append(asyncio.create_task(worker.run()))

        # Wait for all workers to finish
        await asyncio.gather(*worker_tasks)

        # Signal writer to flush and stop
        stop_event.set()
        await writer_task

    elapsed = time.monotonic() - start_time
    rate = stats["enriched"] / (elapsed / 60) if elapsed > 0 else 0
    log.info(f"Finished! {stats['enriched']}/{total_pending} enriched "
             f"in {elapsed/60:.1f} min ({rate:.0f} products/min)")
    conn.close()


if __name__ == "__main__":
    asyncio.run(main())
