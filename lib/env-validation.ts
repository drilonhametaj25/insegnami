import { z } from 'zod';

// Unsafe default secrets that should never be used in production
const UNSAFE_SECRETS = [
  'your-secret-key-here',
  'changeme',
  'secret',
  'password',
  'test',
  'development',
  'your-secret',
  'your-nextauth-secret',
];

// Environment variable schema
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Application mode
  MODE: z.enum(['self-hosted', 'saas']).optional(),

  // Database (required)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis (optional in development, required in production)
  REDIS_URL: z.string().optional(),

  // NextAuth (required)
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),
  NEXTAUTH_SECRET: z.string()
    .min(32, 'NEXTAUTH_SECRET must be at least 32 characters')
    .refine(
      (secret) => !UNSAFE_SECRETS.some(unsafe =>
        secret.toLowerCase().includes(unsafe.toLowerCase())
      ),
      'NEXTAUTH_SECRET cannot be a default/unsafe value. Please generate a secure secret with: openssl rand -base64 32'
    ),

  // SMTP (optional - will use queue fallback)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // Stripe (required for SaaS mode)
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // App config
  APP_NAME: z.string().optional(),
  APP_URL: z.string().url().optional(),
  SUPPORT_EMAIL: z.string().email().optional(),

  // Upload config
  UPLOAD_MAX_SIZE: z.string().transform(Number).optional(),
  UPLOAD_ALLOWED_TYPES: z.string().optional(),

  // Worker config
  WORKER_CONCURRENCY: z.string().transform(Number).optional(),
});

// Type for validated environment
export type Env = z.infer<typeof envSchema>;

// Validation result type
export interface EnvValidationResult {
  success: boolean;
  data?: Env;
  errors?: string[];
  warnings?: string[];
}

/**
 * Validates environment variables at startup
 * Throws in production if critical variables are missing
 */
export function validateEnv(): EnvValidationResult {
  const warnings: string[] = [];

  // Parse environment
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors.map(err =>
      `${err.path.join('.')}: ${err.message}`
    );

    // In production, fail hard on missing critical variables
    if (process.env.NODE_ENV === 'production') {
      console.error('❌ Environment validation failed:');
      errors.forEach(err => console.error(`  - ${err}`));
      throw new Error(`Environment validation failed: ${errors.join(', ')}`);
    }

    // In development, warn but continue
    console.warn('⚠️ Environment validation warnings:');
    errors.forEach(err => console.warn(`  - ${err}`));

    return { success: false, errors, warnings };
  }

  const env = result.data;

  // Additional validation for SaaS mode
  if (env.MODE === 'saas') {
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
      const msg = 'Stripe configuration required for SaaS mode';
      if (process.env.NODE_ENV === 'production') {
        throw new Error(msg);
      }
      warnings.push(msg);
    }
  }

  // Warn if Redis is not configured
  if (!env.REDIS_URL) {
    warnings.push('REDIS_URL not configured - rate limiting and caching will be disabled');
  }

  // Warn if SMTP is not configured
  if (!env.SMTP_HOST || !env.SMTP_USER) {
    warnings.push('SMTP not configured - emails will be queued but not sent');
  }

  // Log warnings if any
  if (warnings.length > 0) {
    console.warn('⚠️ Environment configuration warnings:');
    warnings.forEach(w => console.warn(`  - ${w}`));
  }

  console.log('✅ Environment validation passed');

  return { success: true, data: env, warnings };
}

/**
 * Get a validated environment variable (with type safety)
 */
export function getEnv<K extends keyof Env>(key: K): Env[K] | undefined {
  return process.env[key] as Env[K] | undefined;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

// Auto-validate on import (only on server side)
if (typeof window === 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build') {
  try {
    validateEnv();
  } catch (error) {
    // In production, this will throw and stop the app
    // In development, it just logs warnings
    if (process.env.NODE_ENV === 'production') {
      throw error;
    }
  }
}
