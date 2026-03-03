-- InsegnaMi.pro Production Seed
-- Creates demo tenant and user for testing
-- Password: Demo123! (bcrypt hash with 12 rounds)

-- Create demo tenant
INSERT INTO tenants (id, name, slug, plan, "featureFlags", "isActive", "createdAt", "updatedAt")
VALUES (
  'demo-tenant-001',
  'Scuola Demo',
  'scuola-demo',
  'professional',
  '{"analytics": true, "sms": false}',
  true,
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Create demo user (password: Demo123!)
INSERT INTO users (id, email, password, "firstName", "lastName", status, "createdAt", "updatedAt")
VALUES (
  'demo-user-001',
  'demo@insegnami.pro',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.V4ferVKnPie86y',
  'Demo',
  'User',
  'ACTIVE',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Link user to tenant as ADMIN
INSERT INTO user_tenants (id, "userId", "tenantId", role, permissions, "createdAt", "updatedAt")
VALUES (
  'demo-ut-001',
  'demo-user-001',
  'demo-tenant-001',
  'ADMIN',
  '{}',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;
