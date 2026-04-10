#!/bin/sh
set -e

# Ensure data directory is writable by nextjs user
chown nextjs:nodejs /app/data

# Initialize database from template if volume is empty or DB is invalid
if [ ! -s /app/data/grocery.db ]; then
  echo "Initializing database from template..."
  cp /app/init.db /app/data/grocery.db
  chown nextjs:nodejs /app/data/grocery.db
  echo "Database initialized."
fi

# Migrate database schema - add any missing columns/tables
echo "Ensuring database schema is up to date..."
DB=/app/data/grocery.db
# Add searchIndex column to Product if missing
sqlite3 "$DB" "SELECT searchIndex FROM Product LIMIT 0;" 2>/dev/null || \
  sqlite3 "$DB" "ALTER TABLE Product ADD COLUMN searchIndex TEXT;" 2>&1 || true
# Create searchIndex index if missing
sqlite3 "$DB" "CREATE INDEX IF NOT EXISTS Product_searchIndex_idx ON Product(searchIndex);" 2>&1 || true
# Create ScraperConfig table if missing
sqlite3 "$DB" "CREATE TABLE IF NOT EXISTS ScraperConfig (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, url TEXT NOT NULL, storeName TEXT NOT NULL, chain TEXT NOT NULL DEFAULT 'CUSTOM', containerSel TEXT NOT NULL, nameSel TEXT NOT NULL, priceSel TEXT NOT NULL, linkSel TEXT, imageSel TEXT, categorySel TEXT, paginationSel TEXT, enabled BOOLEAN NOT NULL DEFAULT 1, lastRunAt DATETIME, lastRunCount INTEGER NOT NULL DEFAULT 0, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);" 2>&1 || true
# Add enrichment columns to Product if missing
sqlite3 "$DB" "SELECT canonicalCategory FROM Product LIMIT 0;" 2>/dev/null || \
  sqlite3 "$DB" "ALTER TABLE Product ADD COLUMN canonicalCategory TEXT;" 2>&1 || true
sqlite3 "$DB" "SELECT enrichment FROM Product LIMIT 0;" 2>/dev/null || \
  sqlite3 "$DB" "ALTER TABLE Product ADD COLUMN enrichment TEXT;" 2>&1 || true
sqlite3 "$DB" "SELECT enrichedAt FROM Product LIMIT 0;" 2>/dev/null || \
  sqlite3 "$DB" "ALTER TABLE Product ADD COLUMN enrichedAt DATETIME;" 2>&1 || true
sqlite3 "$DB" "CREATE INDEX IF NOT EXISTS Product_canonicalCategory_idx ON Product(canonicalCategory);" 2>&1 || true
# Create ProductGroup table if missing
sqlite3 "$DB" "CREATE TABLE IF NOT EXISTS ProductGroup (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, nameEn TEXT, canonicalCategory TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);" 2>&1 || true
sqlite3 "$DB" "CREATE INDEX IF NOT EXISTS ProductGroup_canonicalCategory_idx ON ProductGroup(canonicalCategory);" 2>&1 || true
# Add productGroupId column to Product if missing
sqlite3 "$DB" "SELECT productGroupId FROM Product LIMIT 0;" 2>/dev/null || \
  sqlite3 "$DB" "ALTER TABLE Product ADD COLUMN productGroupId INTEGER REFERENCES ProductGroup(id);" 2>&1 || true
sqlite3 "$DB" "CREATE INDEX IF NOT EXISTS Product_productGroupId_idx ON Product(productGroupId);" 2>&1 || true
# Enable WAL mode for concurrent access
sqlite3 "$DB" "PRAGMA journal_mode=WAL;" 2>&1 || true
echo "Schema migration done."

exec su-exec nextjs node server.js
