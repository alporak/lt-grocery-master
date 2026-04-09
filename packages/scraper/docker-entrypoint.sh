#!/bin/sh
set -e

# Wait for the database file to exist (web container creates it)
echo "[Scraper] Waiting for database..."
while [ ! -s /app/data/grocery.db ]; do
  sleep 2
done

# Migrate database schema to match current Prisma schema
echo "[Scraper] Ensuring database schema is up to date..."
DATABASE_URL=file:/app/data/grocery.db npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "[Scraper] Schema migration warning (non-fatal)"

echo "[Scraper] Starting..."
exec npm start
