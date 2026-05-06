import type { NextRequest } from 'next/server';

/**
 * Outcome of attempting to transmit an XML to the SDI via a provider.
 * `accepted` is the *provider* acceptance (the request was well-formed and
 * accepted into their queue) — NOT the SDI acceptance, which arrives later
 * asynchronously via webhook (RC) and is recorded as an SdiEvent.
 */
export type SdiTransmitResult = {
  providerId: string;          // identifier we'll use to query status / reconcile webhooks
  accepted: boolean;
  errorMessage?: string;
};

/**
 * Status snapshot from the provider. Used by polling fallback when the
 * provider doesn't push webhooks reliably.
 */
export type SdiStatusSnapshot = {
  status: 'pending' | 'transmitted' | 'accepted' | 'rejected' | 'not_delivered' | 'expired';
  rawProviderStatus?: string;
  rejectionReason?: string;
  acceptedAt?: Date;
  rejectedAt?: Date;
};

/**
 * Webhook event normalized across providers. Each adapter parses its own
 * payload format and emits this canonical shape, so the application logic
 * (writing SdiEvent rows, updating Invoice.sdiStatus) is provider-agnostic.
 */
export type SdiWebhookEvent = {
  /** Provider id of the invoice this notification refers to. */
  providerId: string;
  /** SDI event type as defined by AdE: NS, RC, MC, NE, MT, EC, DT, AT. */
  eventType: 'NS' | 'RC' | 'MC' | 'NE' | 'MT' | 'EC' | 'DT' | 'AT';
  receivedAt: Date;
  rawPayload: string;
  errorCode?: string;
  errorMessage?: string;
};

export interface SdiProvider {
  /** Stable identifier used in InvoiceSettings.sdiProvider. */
  readonly name: 'acube' | 'aruba' | 'fatture-in-cloud' | 'file-system';

  /** Submit the XML to the provider. The provider then forwards to SDI. */
  transmit(args: {
    xml: string;
    invoiceId: string;
    tenantId: string;
  }): Promise<SdiTransmitResult>;

  /**
   * Poll the provider for the current status of a previously transmitted
   * invoice. Implementations that rely solely on webhooks may throw "not
   * supported" — callers fall back to whatever is in the DB.
   */
  getStatus(providerId: string): Promise<SdiStatusSnapshot>;

  /**
   * Parse an inbound webhook request. Each provider has a different payload
   * shape — this function normalizes them. Throws if the payload is invalid
   * or the signature cannot be verified.
   */
  parseWebhook(req: NextRequest): Promise<SdiWebhookEvent>;
}

export class SdiProviderError extends Error {
  constructor(public providerName: string, message: string, public cause?: unknown) {
    super(`[${providerName}] ${message}`);
    this.name = 'SdiProviderError';
  }
}
