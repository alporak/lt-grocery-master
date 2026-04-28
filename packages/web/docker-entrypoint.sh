#!/bin/sh
set -e

# Ensure data directory is writable by nextjs user
chown nextjs:nodejs /app/data

# Fix ownership of database and WAL/SHM files (may be created by other containers)
chown nextjs:nodejs /app/data/grocery.db* 2>/dev/null || true

# Initialize database from template if volume is empty or DB is invalid
if [ ! -s /app/data/grocery.db ]; then
  echo "Initializing database from template..."
  cp /app/init.db /app/data/grocery.db
  chown nextjs:nodejs /app/data/grocery.db
  echo "Database initialized."
fi

# Apply schema migrations using the Prisma client (no external sqlite3 needed)
echo "Ensuring database schema is up to date..."
node /app/migrate-db.js

exec su-exec nextjs node server.js
