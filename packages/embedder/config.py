import os
from pathlib import Path

DATA_DIR = Path(os.getenv("DATA_DIR", "/app/data"))
DB_PATH = DATA_DIR / "grocery.db"
EMBEDDINGS_DIR = DATA_DIR / "embeddings"
CATEGORIES_PATH = Path(__file__).parent / "categories.json"
BRANDS_PATH = Path(__file__).parent / "brands.json"
EXPORT_PATH = DATA_DIR / "product-intelligence.json.gz"
ENRICH_VERSION = 3  # Increment to force re-enrichment of all products

# --- Gemini config ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GEMINI_BATCH_SIZE = int(os.getenv("GEMINI_BATCH_SIZE", "250"))
GEMINI_THINKING_BUDGET = int(os.getenv("GEMINI_THINKING_BUDGET", "0"))   # 0 = disabled (fastest)
GEMINI_WAIT_SECONDS = int(os.getenv("GEMINI_WAIT_SECONDS", "180"))       # 3 min between runs
GEMINI_RPM = int(os.getenv("GEMINI_RPM", "10"))                          # free tier: 10 RPM/key

# --- Gemini embedding config ---
EMBEDDING_PROVIDER = "gemini"
GEMINI_EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
GEMINI_EMBEDDING_DIM   = int(os.getenv("GEMINI_EMBEDDING_DIM", "768"))
GEMINI_EMBEDDING_BATCH = int(os.getenv("GEMINI_EMBEDDING_BATCH", "100"))
