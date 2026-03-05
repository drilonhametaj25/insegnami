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

# ========================================
# VERIFY ENVIRONMENT VARIABLES
# ========================================
echo "Verifying environment variables..."

# Load .env if exists
if [ -f "$APP_DIR/.env" ]; then
    set -a
    source "$APP_DIR/.env"
    set +a
    echo "Loaded .env file"
else
    echo "WARNING: No .env file found at $APP_DIR/.env"
fi

# Check critical variables
ERRORS=0

if [ -z "$NEXTAUTH_SECRET" ]; then
    echo "ERROR: NEXTAUTH_SECRET is not set"
    ERRORS=$((ERRORS + 1))
elif [ ${#NEXTAUTH_SECRET} -lt 32 ]; then
    echo "ERROR: NEXTAUTH_SECRET must be at least 32 characters (current: ${#NEXTAUTH_SECRET})"
    ERRORS=$((ERRORS + 1))
fi

if [ -z "$NEXTAUTH_URL" ]; then
    echo "ERROR: NEXTAUTH_URL is not set"
    ERRORS=$((ERRORS + 1))
fi

if [ -z "$POSTGRES_PASSWORD" ]; then
    echo "ERROR: POSTGRES_PASSWORD is not set"
    ERRORS=$((ERRORS + 1))
fi

if [ $ERRORS -gt 0 ]; then
    echo ""
    echo "==========================================="
    echo "DEPLOYMENT ABORTED: Missing environment variables"
    echo "==========================================="
    echo ""
    echo "Please create $APP_DIR/.env with the following:"
    echo ""
    echo "  POSTGRES_USER=insegnami"
    echo "  POSTGRES_PASSWORD=<your-secure-password>"
    echo "  POSTGRES_DB=insegnami"
    echo "  NEXTAUTH_URL=https://insegnami.pro"
    echo "  NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>"
    echo ""
    echo "Generate a secure secret with:"
    echo "  openssl rand -base64 32"
    echo ""
    exit 1
fi

echo "Environment variables OK"

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

# Database seed (only first time - checks if demo user exists)
echo "Checking if database seed is needed..."
DEMO_EXISTS=$(docker compose -f $COMPOSE_FILE exec -T postgres psql -U insegnami -d insegnami -tAc "SELECT COUNT(*) FROM users WHERE email='demo@insegnami.pro'" 2>/dev/null || echo "0")

if [ "$DEMO_EXISTS" = "0" ] || [ -z "$DEMO_EXISTS" ]; then
    echo "Running database seed (first time setup)..."
    # Use direct SQL instead of tsx (not available in production)
    docker compose -f $COMPOSE_FILE exec -T postgres psql -U insegnami -d insegnami << 'EOSQL'
INSERT INTO tenants (id, name, slug, plan, "featureFlags", "isActive", "createdAt", "updatedAt")
VALUES ('demo-tenant-001', 'Scuola Demo', 'scuola-demo', 'professional', '{}', true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, password, "firstName", "lastName", status, "createdAt", "updatedAt")
VALUES ('demo-user-001', 'demo@insegnami.pro', '$2a$12$2huAAWatvaTZelQfP6ITzOzGzcnk.HzwNQc65vQ71ueaUWjDQ8RAa', 'Demo', 'User', 'ACTIVE', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_tenants (id, "userId", "tenantId", role, permissions, "createdAt", "updatedAt")
VALUES ('demo-ut-001', 'demo-user-001', 'demo-tenant-001', 'ADMIN', '{}', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
EOSQL
    echo "Database seed completed"
else
    echo "Database already seeded (demo user exists), skipping..."
fi

# Create SUPERADMIN user if not exists
echo "Checking if superadmin user exists..."
SUPERADMIN_EXISTS=$(docker compose -f $COMPOSE_FILE exec -T postgres psql -U insegnami -d insegnami -tAc "SELECT COUNT(*) FROM users WHERE email='admin@insegnami.pro'" 2>/dev/null || echo "0")

if [ "$SUPERADMIN_EXISTS" = "0" ] || [ -z "$SUPERADMIN_EXISTS" ]; then
    echo "Creating superadmin user..."
    docker compose -f $COMPOSE_FILE exec -T postgres psql -U insegnami -d insegnami << 'EOSQL'
-- Create superadmin user (password: SuperAdmin123!)
INSERT INTO users (id, email, password, "firstName", "lastName", status, "createdAt", "updatedAt")
VALUES ('superadmin-001', 'admin@insegnami.pro', '$2a$12$wAOBnAkLLvNsa8AgULDgm.xFNkHmVR6TPNLzCoYLcB6KkYZB6ej7W', 'Super', 'Admin', 'ACTIVE', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Link to demo tenant with SUPERADMIN role
INSERT INTO user_tenants (id, "userId", "tenantId", role, permissions, "createdAt", "updatedAt")
VALUES ('superadmin-ut-001', 'superadmin-001', 'demo-tenant-001', 'SUPERADMIN', '{}', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
EOSQL
    echo "Superadmin user created"
else
    echo "Superadmin user already exists, skipping..."
fi

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
