FROM python:3.11-slim

WORKDIR /app

# Install requirements first for caching
COPY packages/embedder/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download model at build time so it's baked into the image
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')"

COPY packages/embedder/ .

EXPOSE 8000

CMD ["python", "main.py"]
