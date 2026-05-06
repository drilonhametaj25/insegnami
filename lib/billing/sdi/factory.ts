import { prisma } from '@/lib/db';
import { FileSystemSdiProvider } from './providers/file-system';
import type { SdiProvider } from './provider.interface';
import { SdiProviderError } from './provider.interface';

/**
 * Resolve the active SDI provider for a tenant.
 *
 * Reads InvoiceSettings.sdiProvider; when absent or set to "file-system"
 * returns the disk-backed dev stub. Real providers (acube, aruba,
 * fatture-in-cloud) will be plugged here as they're implemented — the
 * factory is the single seam that keeps the rest of the codebase
 * provider-agnostic.
 */
export async function getSdiProviderForTenant(tenantId: string): Promise<SdiProvider> {
  const settings = await prisma.invoiceSettings.findUnique({
    where: { tenantId },
    select: { sdiProvider: true },
  });

  const name = settings?.sdiProvider ?? 'file-system';
  return getSdiProviderByName(name);
}

export function getSdiProviderByName(name: string): SdiProvider {
  switch (name) {
    case 'file-system':
      return new FileSystemSdiProvider();
    case 'acube':
    case 'aruba':
    case 'fatture-in-cloud':
      // Adapter not yet implemented — fall back loudly so we don't silently
      // ship a no-op into production.
      throw new SdiProviderError(name, 'provider adapter not implemented yet');
    default:
      throw new SdiProviderError(name, `unknown SDI provider: ${name}`);
  }
}
