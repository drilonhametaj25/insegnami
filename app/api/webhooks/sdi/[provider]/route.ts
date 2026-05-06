import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSdiProviderByName } from '@/lib/billing/sdi/factory';
import { SdiProviderError } from '@/lib/billing/sdi/provider.interface';
import type { SdiTransmissionStatus, SdiEventType } from '@prisma/client';

interface RouteParams {
  params: Promise<{ provider: string }>;
}

/**
 * POST /api/webhooks/sdi/[provider]
 *
 * Public webhook (no auth) — providers post here when SDI emits a
 * notification (NS/RC/MC/NE/MT/EC/DT/AT). The provider adapter is
 * responsible for verifying the request signature in parseWebhook().
 *
 * Side effects:
 *   1. Append an SdiEvent row (immutable audit).
 *   2. Update Invoice.sdiStatus + the matching timestamp.
 *
 * Idempotency: if the same eventType for the same providerId arrived
 * already, we skip writing a duplicate SdiEvent (some providers retry).
 * Status update is naturally idempotent since we map eventType → status.
 *
 * The webhook deliberately returns 200 even on application-level errors
 * (logging them) to prevent providers retrying indefinitely on issues we
 * cannot fix (e.g. invoice deleted) — except for malformed/unauthenticated
 * requests, where we return 4xx so the provider re-queues.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { provider: providerName } = await params;

  let provider;
  try {
    provider = getSdiProviderByName(providerName);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown provider' },
      { status: 404 },
    );
  }

  let event;
  try {
    event = await provider.parseWebhook(request);
  } catch (err) {
    const message = err instanceof SdiProviderError ? err.message
      : err instanceof Error ? err.message
      : 'invalid webhook payload';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const invoice = await prisma.invoice.findFirst({
      where: { sdiIdentifier: event.providerId },
      select: { id: true, tenantId: true },
    });
    if (!invoice) {
      // Acknowledge so the provider stops retrying — invoice was likely
      // deleted before the webhook arrived. Log for inspection.
      console.warn(`SDI webhook: no invoice for providerId=${event.providerId} (${providerName})`);
      return NextResponse.json({ ok: true, skipped: 'invoice not found' });
    }

    // Idempotency: skip duplicate eventType for same invoice within 5 minutes.
    const existing = await prisma.sdiEvent.findFirst({
      where: {
        invoiceId: invoice.id,
        eventType: event.eventType,
        receivedAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json({ ok: true, deduplicated: true });
    }

    const sdiStatus = mapEventToStatus(event.eventType);

    await prisma.$transaction([
      prisma.sdiEvent.create({
        data: {
          invoiceId: invoice.id,
          eventType: event.eventType as SdiEventType,
          receivedAt: event.receivedAt,
          payloadXml: event.rawPayload,
          errorCode: event.errorCode,
          errorMessage: event.errorMessage,
        },
      }),
      prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          sdiStatus: sdiStatus ?? undefined,
          sdiAcceptedAt: event.eventType === 'RC' ? event.receivedAt : undefined,
          sdiRejectedReason: event.eventType === 'NS' ? (event.errorMessage ?? null) : undefined,
          ...(event.eventType === 'RC' || event.eventType === 'NE' ? { status: 'ACCEPTED' as const } : {}),
          ...(event.eventType === 'NS' ? { status: 'REJECTED' as const } : {}),
        },
      }),
    ]);

    return NextResponse.json({ ok: true, eventType: event.eventType });
  } catch (err) {
    console.error(`SDI webhook processing failed (${providerName})`, err);
    // Returning 200 with a marker prevents infinite retries; the SdiEvent
    // table won't have the row but we have it in logs for manual fix.
    return NextResponse.json({ ok: true, error: 'processing failed; logged' }, { status: 200 });
  }
}

function mapEventToStatus(eventType: string): SdiTransmissionStatus | null {
  switch (eventType) {
    case 'RC': return 'ACCEPTED';
    case 'NS': return 'REJECTED';
    case 'MC': return 'NOT_DELIVERED';
    case 'DT': return 'EXPIRED';
    case 'NE':
    case 'EC':
    case 'MT':
    case 'AT':
      // These are informational — don't change the high-level status.
      return null;
    default:
      return null;
  }
}
