export const isProduction = process.env.NODE_ENV === 'production';
export const isDevelopment = process.env.NODE_ENV === 'development';

export const MODE = process.env.MODE as 'self-hosted' | 'saas';
export const isSaaSMode = MODE === 'saas';
export const isSelfHostedMode = MODE === 'self-hosted';

export const DATABASE_URL = process.env.DATABASE_URL!;
export const REDIS_URL = process.env.REDIS_URL!;
export const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET!;
export const NEXTAUTH_URL = process.env.NEXTAUTH_URL!;

// Email configuration
export const SMTP_CONFIG = {
  host: process.env.SMTP_HOST!,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASSWORD!,
  },
};

export const EMAIL_FROM = process.env.EMAIL_FROM || 'noreply@insegnami.pro';

// App configuration
export const APP_CONFIG = {
  name: process.env.APP_NAME || 'InsegnaMi.pro',
  url: process.env.APP_URL || 'http://localhost:3000',
  supportEmail: process.env.SUPPORT_EMAIL || 'support@insegnami.pro',
};

// Upload configuration
export const UPLOAD_CONFIG = {
  maxSize: parseInt(process.env.UPLOAD_MAX_SIZE || '10485760'), // 10MB default
  allowedTypes: (process.env.UPLOAD_ALLOWED_TYPES || 'jpg,jpeg,png,pdf,doc,docx').split(','),
};

// Worker configuration
export const WORKER_CONFIG = {
  concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
  redis: REDIS_URL,
};

// Feature flags (can be overridden per tenant in SaaS mode)
export const DEFAULT_FEATURES = {
  attendance: true,
  payments: true,
  communications: true,
  calendar: true,
  reports: true,
  analytics: false, // Premium feature
  parentPortal: true,
  mobileApp: true,
  integrations: false, // Premium feature
  advancedReporting: false, // Premium feature
};
