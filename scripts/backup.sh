#!/bin/bash

# Database backup script for InsegnaMi.pro
# I dump contengono PII (anagrafiche studenti/genitori): il backup è SEMPRE
# cifrato con AES-256-CBC. La chiave arriva da BACKUP_ENCRYPTION_KEY (env),
# propagata dal deploy CI (GitHub Secret).

set -e
set -o pipefail

# Configuration
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-${POSTGRES_DB:-insegnami}}
DB_USER=${DB_USER:-${POSTGRES_USER:-insegnami}}
DB_PASSWORD=${DB_PASSWORD:-${POSTGRES_PASSWORD:-}}

BACKUP_DIR=${BACKUP_DIR:-/backups}
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}

if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
    echo "ERROR: BACKUP_ENCRYPTION_KEY non impostata: i backup devono essere cifrati."
    echo "       Imposta la variabile (e salvala come GitHub Secret per il deploy)."
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/insegnami_backup_$TIMESTAMP.sql.gz.enc"

echo "Starting encrypted backup of database '$DB_NAME' to '$BACKUP_FILE'"

# Create database backup: dump -> gzip -> AES-256-CBC (PBKDF2, 200k iter)
PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --clean \
  --if-exists \
  --create \
  --format=plain \
  | gzip \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
      -pass env:BACKUP_ENCRYPTION_KEY \
      -out "$BACKUP_FILE"

# Check if backup was successful
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    echo "Backup completed successfully: $BACKUP_FILE"

    # Get backup size
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "Backup size: $BACKUP_SIZE"
else
    echo "ERROR: Backup failed or file is empty"
    exit 1
fi

# Clean up old backups (cifrati e legacy in chiaro)
echo "Cleaning up backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -name "insegnami_backup_*.sql.gz.enc" -type f -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "insegnami_backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete

# List remaining backups
echo "Current backups:"
ls -lah "$BACKUP_DIR"/insegnami_backup_* 2>/dev/null || echo "No backups found"

echo "Backup process completed"
