FROM python:3.11-slim

WORKDIR /app

# Install requirements first for caching
COPY packages/embedder/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY packages/embedder/ .

# Create nextjs user matching host UID/GID (1000:1000)
RUN groupadd --gid 1000 nextjs && \
    useradd --uid 1000 --gid 1000 -m nextjs && \
    chown -R nextjs:nextjs /app

USER nextjs

EXPOSE 8000

CMD ["python", "main.py"]
