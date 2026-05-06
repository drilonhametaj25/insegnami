import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import type {
  SdiProvider,
  SdiTransmitResult,
  SdiStatusSnapshot,
  SdiWebhookEvent,
} from '../provider.interface';
import { SdiProviderError } from '../provider.interface';

/**
 * Dev-only SDI provider. Writes the XML to disk under
 *   {SDI_FILE_SYSTEM_DIR ?? ./tmp/sdi}/{tenantId}/{providerId}.xml
 * and immediately reports `accepted: true` so the rest of the pipeline can be
 * exercised end-to-end without a real provider account.
 *
 * Webhooks are not real — they have to be triggered manually (e.g. by POSTing
 * a JSON payload to /api/webhooks/sdi/file-system) when testing the
 * status-update flow.
 */
export class FileSystemSdiProvider implements SdiProvider {
  readonly name = 'file-system' as const;

  private get baseDir(): string {
    return process.env.SDI_FILE_SYSTEM_DIR ?? path.join(process.cwd(), 'tmp', 'sdi');
  }

  async transmit({ xml, invoiceId, tenantId }: { xml: string; invoiceId: string; tenantId: string }): Promise<SdiTransmitResult> {
    try {
      const dir = path.join(this.baseDir, tenantId);
      await fs.mkdir(dir, { recursive: true });

      // Provider id is just a uuid for the dev provider. In real providers
      // it's the SDI identificativo SdI assegnato dal sistema di interscambio.
      const providerId = `fs-${randomUUID()}`;
      const filename = `${invoiceId}-${providerId}.xml`;
      await fs.writeFile(path.join(dir, filename), xml, 'utf8');

      return { providerId, accepted: true };
    } catch (err) {
      throw new SdiProviderError(this.name, 'failed to write XML to disk', err);
    }
  }

  async getStatus(_providerId: string): Promise<SdiStatusSnapshot> {
    // We don't actually round-trip through SDI — once written, we claim
    // it's accepted. Real providers query their API.
    return { status: 'accepted', rawProviderStatus: 'fs-stub-accepted' };
  }

  async parseWebhook(req: NextRequest): Promise<SdiWebhookEvent> {
    // Accept a JSON body shaped like
    // { providerId, eventType, errorCode?, errorMessage?, payload? }
    let body: any;
    try {
      body = await req.json();
    } catch {
      throw new SdiProviderError(this.name, 'invalid JSON in webhook body');
    }

    const { providerId, eventType, errorCode, errorMessage, payload } = body ?? {};
    if (!providerId || !eventType) {
      throw new SdiProviderError(this.name, 'missing providerId or eventType');
    }
    const allowed = ['NS', 'RC', 'MC', 'NE', 'MT', 'EC', 'DT', 'AT'] as const;
    if (!allowed.includes(eventType)) {
      throw new SdiProviderError(this.name, `unknown eventType: ${eventType}`);
    }

    return {
      providerId,
      eventType,
      receivedAt: new Date(),
      rawPayload: typeof payload === 'string' ? payload : JSON.stringify(payload ?? {}),
      errorCode,
      errorMessage,
    };
  }
}
