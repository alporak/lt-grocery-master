#!/bin/sh
set -e

DB_PATH="${DB_PATH:-/app/data/grocery.db}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M)
BACKUP_FILE="$BACKUP_DIR/grocery-$TIMESTAMP.db"

echo "[Backup] Starting backup of $DB_PATH to $BACKUP_FILE"

sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

echo "[Backup] Verifying backup integrity..."
sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" | grep -q "ok"
echo "[Backup] Integrity check passed"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[Backup] Created: $BACKUP_FILE ($BACKUP_SIZE)"

DELETED=$(find "$BACKUP_DIR" -name "grocery-*.db" -mtime +"$RETENTION_DAYS" -delete -print 2>/dev/null | wc -l)
echo "[Backup] Pruned $DELETED backup(s) older than $RETENTION_DAYS days"

REMAINING=$(find "$BACKUP_DIR" -name "grocery-*.db" | wc -l)
echo "[Backup] $REMAINING backup(s) retained"
