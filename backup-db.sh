#!/bin/bash

# Configuration
DB_PATH="./server/database/sqlite.db"
BACKUP_DIR="./backups"
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/salarix_backup_$DATE.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Perform backup using sqlite3 .backup command (safest for WAL mode)
# This command ensures a consistent snapshot even if the DB is in WAL mode and active
if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"
else
    # Fallback for systems without sqlite3 CLI - Note: potentially inconsistent if DB is active in WAL mode
    cp "$DB_PATH" "$BACKUP_FILE"
    # Also copy WAL and SHM if they exist (though they might be ahead of the main DB)
    [ -f "${DB_PATH}-wal" ] && cp "${DB_PATH}-wal" "${BACKUP_FILE}-wal"
    [ -f "${DB_PATH}-shm" ] && cp "${DB_PATH}-shm" "${BACKUP_FILE}-shm"
fi

# Gzip the backup
gzip "$BACKUP_FILE"

# Delete backups older than 30 days
find "$BACKUP_DIR" -type f -name "salarix_backup_*.db.gz" -mtime +30 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
