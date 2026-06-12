#!/bin/bash

# Database restore script for InsegnaMi.pro
# Supporta sia i backup cifrati (.sql.gz.enc, default) sia i legacy in
# chiaro (.sql.gz). Per i cifrati serve BACKUP_ENCRYPTION_KEY.

set -e
set -o pipefail

# Configuration
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-${POSTGRES_DB:-insegnami}}
DB_USER=${DB_USER:-${POSTGRES_USER:-insegnami}}
DB_PASSWORD=${DB_PASSWORD:-${POSTGRES_PASSWORD:-}}

BACKUP_DIR=${BACKUP_DIR:-/backups}
# In produzione i servizi girano con docker-compose.prod.yml; override
# possibile per ambienti dev (docker/docker-compose.yml)
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.prod.yml}

# Check if backup file is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup_file>"
    echo "Available backups:"
    ls -la "$BACKUP_DIR"/insegnami_backup_* 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    # Try to find the file in backup directory
    if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
        BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
    else
        echo "ERROR: Backup file '$BACKUP_FILE' not found"
        exit 1
    fi
fi

echo "Starting restore from backup: $BACKUP_FILE"

# Confirm restore operation
read -p "This will overwrite the current database '$DB_NAME'. Are you sure? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore cancelled"
    exit 0
fi

# Stop the application (if running via Docker Compose)
echo "Stopping application..."
docker compose -f "$COMPOSE_FILE" stop app worker 2>/dev/null || true

# Wait a moment for connections to close
sleep 2

# Restore database (decifra se .enc)
echo "Restoring database..."
case "$BACKUP_FILE" in
  *.enc)
    if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
        echo "ERROR: il backup è cifrato ma BACKUP_ENCRYPTION_KEY non è impostata"
        exit 1
    fi
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
        -pass env:BACKUP_ENCRYPTION_KEY -in "$BACKUP_FILE" \
      | gunzip -c \
      | PGPASSWORD="$DB_PASSWORD" psql \
          -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres --quiet
    ;;
  *)
    gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DB_PASSWORD" psql \
      -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres --quiet
    ;;
esac

echo "Database restore completed successfully"

# Start the application
echo "Starting application..."
docker compose -f "$COMPOSE_FILE" start app worker 2>/dev/null || true

echo "Restore process completed"
echo "Please verify that the application is working correctly"
