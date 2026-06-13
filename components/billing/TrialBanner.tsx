'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Alert, Button, Group, Text, Box } from '@mantine/core';
import { IconClock, IconAlertTriangle, IconArrowRight } from '@tabler/icons-react';
import dayjs from 'dayjs';

/**
 * Banner compatto di sollecito all'attivazione dell'abbonamento.
 *
 * Mostrato SOLO a ADMIN/DIRECTOR il cui tenant è in prova o privo di un
 * abbonamento attivo: comunica i giorni residui di prova e offre un CTA
 * diretto verso /[locale]/dashboard/billing per scegliere un piano.
 *
 * Fail-safe: ritorna null per SUPERADMIN, per abbonamenti attivi, finché i
 * dati non sono caricati e su QUALSIASI errore di fetch (non deve mai
 * bloccare o sporcare la UI se il billing non risponde).
 *
 * Self-contained: nessuna prop richiesta, può essere montato ovunque nel
 * layout/dashboard.
 */

interface AccessStatus {
  ok: boolean;
  reason?: string;
}

interface SubscriptionStatusResponse {
  status?: string;
  subscription?: { trialEnd?: string | null } | null;
  tenant?: { trialUntil?: string | null } | null;
}

// Ruoli ammessi a gestire la fatturazione del tenant.
const BILLING_ROLES = ['ADMIN', 'DIRECTOR'];

export function TrialBanner() {
  const locale = useLocale();
  const { data: session, status: sessionStatus } = useSession();
  const [show, setShow] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    // Attendi che la sessione sia risolta prima di decidere.
    if (sessionStatus !== 'authenticated') return;

    const role = session?.user?.role;
    // SUPERADMIN o ruoli non-billing: nessun banner.
    if (!role || role === 'SUPERADMIN' || !BILLING_ROLES.includes(role)) return;

    let cancelled = false;

    (async () => {
      try {
        const [accessRes, subRes] = await Promise.all([
          fetch('/api/tenants/access-status'),
          fetch('/api/subscriptions'),
        ]);

        // Fail-safe: qualsiasi risposta non-ok → non mostrare nulla.
        if (!accessRes.ok || !subRes.ok) return;

        const access = (await accessRes.json()) as AccessStatus;
        const sub = (await subRes.json()) as SubscriptionStatusResponse;

        if (cancelled) return;

        const status = sub.status ?? '';

        // Abbonamento pienamente attivo: niente banner.
        if (status === 'active') return;

        // Determina la data di fine prova (subscription.trialEnd in TRIALING,
        // altrimenti tenant.trialUntil per i tenant ancora senza subscription).
        const trialEnd =
          sub.subscription?.trialEnd || sub.tenant?.trialUntil || null;

        const days = trialEnd
          ? Math.max(0, dayjs(trialEnd).diff(dayjs(), 'day'))
          : null;

        // Tenant bloccato dall'enforcement (trial scaduto / pagamento fallito /
        // abbonamento cancellato): banner in stato "warning" più incisivo.
        const isBlocked = access.ok === false;

        // Mostra il banner se: tenant bloccato, in prova, o privo di
        // abbonamento attivo (es. no_subscription, trial scaduto).
        const shouldShow =
          isBlocked ||
          status === 'trialing' ||
          status === 'no_subscription' ||
          status === 'past_due' ||
          status === 'cancelled' ||
          status === 'unpaid';

        if (!shouldShow) return;

        setDaysRemaining(days);
        setBlocked(isBlocked);
        setShow(true);
      } catch {
        // Fail-safe assoluto: nessun banner se il fetch fallisce.
        if (!cancelled) setShow(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionStatus, session?.user?.role]);

  if (!show) return null;

  const billingHref = `/${locale}/dashboard/billing`;

  const inTrialWithDays = !blocked && daysRemaining !== null && daysRemaining > 0;

  const title = blocked
    ? 'Accesso sospeso — attiva un abbonamento'
    : inTrialWithDays
      ? `Periodo di prova: ${daysRemaining} ${daysRemaining === 1 ? 'giorno rimasto' : 'giorni rimasti'}`
      : 'Attiva un abbonamento per continuare';

  const description = blocked
    ? 'Il tuo periodo di prova è terminato o l\'abbonamento non è attivo. Scegli un piano per riprendere a usare InsegnaMi.'
    : inTrialWithDays
      ? 'Scegli un piano ora per non perdere l\'accesso al termine della prova.'
      : 'Seleziona un piano per sbloccare tutte le funzionalità.';

  return (
    <Alert
      variant="light"
      color={blocked ? 'amber' : 'navy'}
      radius="md"
      icon={blocked ? <IconAlertTriangle size={20} /> : <IconClock size={20} />}
      data-testid="trial-banner"
    >
      <Group justify="space-between" align="center" gap="md" wrap="wrap">
        <Box style={{ flex: 1, minWidth: 200 }}>
          <Text fw={600} size="sm">
            {title}
          </Text>
          <Text size="xs" c="dimmed" mt={2}>
            {description}
          </Text>
        </Box>
        <Button
          component={Link}
          href={billingHref}
          size="sm"
          color={blocked ? 'amber' : 'navy'}
          variant="filled"
          rightSection={<IconArrowRight size={16} />}
          data-testid="trial-banner-cta"
        >
          Attiva abbonamento
        </Button>
      </Group>
    </Alert>
  );
}

export default TrialBanner;
