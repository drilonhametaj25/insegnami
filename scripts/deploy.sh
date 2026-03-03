#!/bin/bash
set -e

# InsegnaMi.pro Deployment Script
# This script is executed on the server during deployment

APP_DIR="/opt/insegnami"
COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_DIR="/opt/insegnami/backups"

echo "=========================================="
echo "InsegnaMi.pro Deployment"
echo "Started at: $(date)"
echo "=========================================="

cd "$APP_DIR"

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Backup database before deployment (if containers are running)
if docker compose -f $COMPOSE_FILE ps postgres 2>/dev/null | grep -q "running"; then
    echo "Creating database backup..."
    docker compose -f $COMPOSE_FILE exec -T postgres pg_dump -U insegnami insegnami > "$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql" || true
    echo "Backup created"
fi

# Pull latest changes (already done by GitHub Actions, but ensure we have them)
echo "Ensuring latest code..."
git fetch origin main
git reset --hard origin/main

# Build new image
echo "Building Docker image..."
docker compose -f $COMPOSE_FILE build --no-cache app

# Stop old containers gracefully
echo "Stopping old containers..."
docker compose -f $COMPOSE_FILE down --timeout 30 || true

# Start new containers
echo "Starting new containers..."
docker compose -f $COMPOSE_FILE up -d

# Wait for database to be ready
echo "Waiting for database to be ready..."
sleep 10

# Run database migrations (use local prisma, not npx which downloads latest)
echo "Running database migrations..."
docker compose -f $COMPOSE_FILE exec -T app node_modules/prisma/build/index.js migrate deploy

# Health check
echo "Running health check..."
sleep 5
for i in {1..10}; do
    if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
        echo "Health check passed!"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "Health check failed after 10 attempts"
        docker compose -f $COMPOSE_FILE logs app --tail 50
        exit 1
    fi
    echo "Waiting for app to be ready... (attempt $i/10)"
    sleep 5
done

# Cleanup old images
echo "Cleaning up old Docker images..."
docker image prune -f

# Cleanup old backups (keep last 7 days)
find "$BACKUP_DIR" -name "backup_*.sql" -mtime +7 -delete 2>/dev/null || true

echo "=========================================="
echo "Deployment completed successfully!"
echo "Finished at: $(date)"
echo "=========================================="
