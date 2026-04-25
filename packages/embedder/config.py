import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

DATA_DIR = Path(os.getenv("DATA_DIR", "/app/data"))
DB_PATH = DATA_DIR / "grocery.db"
EMBEDDINGS_DIR = DATA_DIR / "embeddings"
CATEGORIES_PATH = Path(__file__).parent / "categories.json"
BRANDS_PATH = Path(__file__).parent / "brands.json"
EXPORT_PATH = DATA_DIR / "product-intelligence.json.gz"
ENRICH_VERSION = 3

# --- Gemini config ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.1-flash-lite-preview")
GEMINI_BATCH_SIZE = int(os.getenv("GEMINI_BATCH_SIZE", "50"))
GEMINI_CONCURRENCY = int(os.getenv("GEMINI_CONCURRENCY", "5"))
GEMINI_THINKING_BUDGET = int(os.getenv("GEMINI_THINKING_BUDGET", "0"))
GEMINI_RPM = int(os.getenv("GEMINI_RPM", "300"))

# --- Gemini embedding config ---
EMBEDDING_PROVIDER = "gemini"
# Dokümana göre, toplu liste (batch array) yollayabildiğimiz ve task_type kullanabildiğimiz resmi model.
GEMINI_EMBEDDING_MODEL = os.getenv("GEMINI_EMBEDDING_MODEL", "gemini-embedding-001")
GEMINI_EMBEDDING_DIM   = int(os.getenv("GEMINI_EMBEDDING_DIM", "768"))
GEMINI_EMBEDDING_BATCH = int(os.getenv("GEMINI_EMBEDDING_BATCH", "100"))