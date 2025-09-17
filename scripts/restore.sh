#!/bin/bash

# Database restore script for InsegnaMi.pro

set -e

# Configuration
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-insegnami_db}
DB_USER=${DB_USER:-insegnami_user}
DB_PASSWORD=${DB_PASSWORD:-insegnami_password}

BACKUP_DIR=${BACKUP_DIR:-/backups}

# Check if backup file is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <backup_file>"
    echo "Available backups:"
    ls -la "$BACKUP_DIR"/insegnami_backup_*.sql.gz 2>/dev/null || echo "No backups found"
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
docker-compose -f docker/docker-compose.yml stop app worker 2>/dev/null || true

# Wait a moment for connections to close
sleep 2

# Restore database
echo "Restoring database..."
gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -d postgres \
  --quiet

# Check if restore was successful
if [ $? -eq 0 ]; then
    echo "Database restore completed successfully"
else
    echo "ERROR: Database restore failed"
    exit 1
fi

# Start the application
echo "Starting application..."
docker-compose -f docker/docker-compose.yml start app worker 2>/dev/null || true

echo "Restore process completed"
echo "Please verify that the application is working correctly"
