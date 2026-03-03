import { redis } from './redis';
import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix?: string; // Optional prefix for the Redis key
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
  error?: NextResponse;
}

/**
 * Rate limiter using Redis sliding window
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const { windowMs, maxRequests, keyPrefix = 'rate-limit' } = config;

  // Get IP address from headers or connection
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  const key = `${keyPrefix}:${ip}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    const client = redis.getClient();

    if (!client) {
      // If Redis is not available, allow the request but log warning
      console.warn('Rate limiting unavailable: Redis not configured');
      return { success: true, remaining: maxRequests, reset: now + windowMs };
    }

    // Use sorted set for sliding window rate limiting
    // Remove old entries
    await client.zremrangebyscore(key, 0, windowStart);

    // Count requests in current window
    const requestCount = await client.zcard(key);

    if (requestCount >= maxRequests) {
      // Get oldest entry to calculate reset time
      const oldest = await client.zrange(key, 0, 0, 'WITHSCORES');
      const resetTime = oldest.length >= 2
        ? parseInt(oldest[1]) + windowMs
        : now + windowMs;

      return {
        success: false,
        remaining: 0,
        reset: resetTime,
        error: NextResponse.json(
          {
            error: 'Troppe richieste. Riprova più tardi.',
            retryAfter: Math.ceil((resetTime - now) / 1000)
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((resetTime - now) / 1000)),
              'X-RateLimit-Limit': String(maxRequests),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil(resetTime / 1000)),
            }
          }
        )
      };
    }

    // Add current request
    await client.zadd(key, now, `${now}:${Math.random()}`);

    // Set expiry on the key
    await client.expire(key, Math.ceil(windowMs / 1000));

    const remaining = maxRequests - requestCount - 1;

    return {
      success: true,
      remaining,
      reset: now + windowMs
    };

  } catch (error) {
    console.error('Rate limit error:', error);
    // On error, allow the request but log
    return { success: true, remaining: maxRequests, reset: now + windowMs };
  }
}

/**
 * Pre-configured rate limiters for common use cases
 */
export const rateLimiters = {
  // Strict: 5 requests per minute (for auth endpoints)
  auth: (request: NextRequest) => rateLimit(request, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    keyPrefix: 'rl:auth'
  }),

  // Moderate: 10 requests per minute (for password reset)
  passwordReset: (request: NextRequest) => rateLimit(request, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    keyPrefix: 'rl:pwd-reset'
  }),

  // Relaxed: 30 requests per minute (for API endpoints)
  api: (request: NextRequest) => rateLimit(request, {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    keyPrefix: 'rl:api'
  }),

  // Very strict: 3 requests per 5 minutes (for email sending)
  email: (request: NextRequest) => rateLimit(request, {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 3,
    keyPrefix: 'rl:email'
  }),
};

export default rateLimit;
