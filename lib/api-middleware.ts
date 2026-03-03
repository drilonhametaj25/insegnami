import { NextRequest, NextResponse } from 'next/server';

// Maximum payload size: 1MB
const MAX_BODY_SIZE = 1024 * 1024;

/**
 * Check if request payload exceeds size limit
 * Returns NextResponse with 413 error if too large, null otherwise
 *
 * BUG-029 fix: Prevent DoS via large payloads
 */
export async function withBodySizeLimit(
  request: NextRequest,
  maxSize: number = MAX_BODY_SIZE
): Promise<NextResponse | null> {
  const contentLength = request.headers.get('content-length');

  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    return NextResponse.json(
      { error: 'Payload too large', maxSize: `${maxSize / 1024 / 1024}MB` },
      { status: 413 }
    );
  }

  return null;
}

/**
 * Sanitize error for logging - removes sensitive data
 * BUG-048 fix: Prevent secrets in error logs
 */
export function sanitizeError(error: unknown): { message: string; name: string } {
  if (error instanceof Error) {
    return {
      message: error.message.replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
                           .replace(/sk_[a-zA-Z0-9_]+/g, 'sk_[REDACTED]')
                           .replace(/whsec_[a-zA-Z0-9_]+/g, 'whsec_[REDACTED]'),
      name: error.name
    };
  }
  return { message: 'Unknown error', name: 'UnknownError' };
}

/**
 * Get a public-safe error message for API responses
 * BUG-050 fix: Prevent verbose error messages from leaking internal info
 *
 * Logs the full error server-side, returns generic message to client
 */
export function getPublicErrorMessage(
  error: unknown,
  fallback: string = 'Si è verificato un errore. Riprova.'
): string {
  // Log full error server-side for debugging
  console.error('[INTERNAL ERROR]', error instanceof Error ? error.stack : error);

  // Return generic message to client
  return fallback;
}

/**
 * Escape HTML to prevent XSS in email templates
 * BUG-032 fix: XSS prevention
 */
export function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Enforce pagination limits
 * BUG-031 fix: Prevent excessive pagination
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaults: { page: number; limit: number; maxLimit: number } = { page: 1, limit: 10, maxLimit: 100 }
): { page: number; limit: number; skip: number } {
  const page = Math.max(parseInt(searchParams.get('page') || String(defaults.page), 10), 1);
  const requestedLimit = parseInt(searchParams.get('limit') || String(defaults.limit), 10);
  const limit = Math.min(Math.max(requestedLimit, 1), defaults.maxLimit);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}
