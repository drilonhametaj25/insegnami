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
  '$2a$12$2huAAWatvaTZelQfP6ITzOzGzcnk.HzwNQc65vQ71ueaUWjDQ8RAa',
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

-- Create superadmin user (password: SuperAdmin123!)
INSERT INTO users (id, email, password, "firstName", "lastName", status, "createdAt", "updatedAt")
VALUES (
  'superadmin-001',
  'admin@insegnami.pro',
  '$2a$12$wAOBnAkLLvNsa8AgULDgm.xFNkHmVR6TPNLzCoYLcB6KkYZB6ej7W',
  'Super',
  'Admin',
  'ACTIVE',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- Link superadmin to tenant with SUPERADMIN role
INSERT INTO user_tenants (id, "userId", "tenantId", role, permissions, "createdAt", "updatedAt")
VALUES (
  'superadmin-ut-001',
  'superadmin-001',
  'demo-tenant-001',
  'SUPERADMIN',
  '{}',
  NOW(),
  NOW()
) ON CONFLICT (id) DO NOTHING;
