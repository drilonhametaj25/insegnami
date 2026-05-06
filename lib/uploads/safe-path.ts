import path from 'node:path';

/**
 * Resolve a user-supplied upload URL to an absolute filesystem path,
 * refusing anything that escapes the public/uploads root.
 *
 * The previous DELETE materials handler accepted `/uploads/{anything}` and
 * passed it straight to fs.unlink. A material URL like
 *   /uploads/../../../.env
 * would resolve to the project root and unlink the env file. The exploit
 * required an admin who could create the Material row, but admins are
 * never trusted with arbitrary fs writes — this is the canonical
 * "confused deputy" pattern.
 *
 * Returns null when the url is unsafe (not under uploads, contains
 * traversal segments, or resolves outside the root). The caller MUST
 * treat null as "do not touch the filesystem".
 */
export function resolveSafeUploadPath(url: string | null | undefined): string | null {
  if (!url) return null;

  // Must start with our well-known mount.
  if (!url.startsWith('/uploads/')) return null;

  // Reject any traversal segment outright. path.normalize would also
  // catch most cases, but rejecting explicitly is clearer in code review.
  if (url.includes('..') || url.includes('\0')) return null;

  const root = path.resolve(process.cwd(), 'public', 'uploads');
  const candidate = path.resolve(process.cwd(), 'public', url.replace(/^\//, ''));

  // The resolved path must live UNDER the uploads root. We compare with
  // path.sep appended so /tmp/uploads-evil doesn't slip past
  // /tmp/uploads.startsWith(/tmp/uploads).
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (!candidate.startsWith(rootWithSep)) return null;

  return candidate;
}
