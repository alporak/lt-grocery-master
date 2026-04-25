FROM python:3.11-slim

WORKDIR /app

# Install requirements first for caching
COPY packages/embedder/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY packages/embedder/ .

EXPOSE 8000

CMD ["python", "main.py"]
