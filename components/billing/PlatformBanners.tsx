'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Alert, Button, Group, Text, Box } from '@mantine/core';
import { IconTool, IconCreditCard, IconArrowRight } from '@tabler/icons-react';
import dayjs from 'dayjs';

/**
 * Banner globali del layout dashboard:
 *
 * - MaintenanceBanner: la piattaforma è in manutenzione (PlatformSettings
 *   singleton via GET /api/platform/status). Il login/dashboard resta
 *   accessibile — in particolare ai SUPERADMIN — ma tutti vedono l'avviso.
 *
 * - DunningBanner: la subscription è PAST_DUE con gracePeriodEnd futuro
 *   (periodo di grazia): l'admin può ancora usare tutto ma deve aggiornare
 *   il metodo di pagamento entro la scadenza.
 *
 * Entrambi fail-safe: su qualunque errore di fetch non mostrano nulla.
 */

export function MaintenanceBanner() {
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/platform/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.maintenanceMode === true) setMaintenance(true);
      })
      .catch(() => {
        /* fail-safe: nessun banner */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!maintenance) return null;

  return (
    <Alert
      variant="light"
      color="orange"
      radius="md"
      mb="md"
      icon={<IconTool size={20} />}
      data-testid="maintenance-banner"
    >
      <Text fw={600} size="sm">
        Piattaforma in manutenzione
      </Text>
      <Text size="xs" c="dimmed" mt={2}>
        Stiamo effettuando interventi programmati: alcune funzionalità potrebbero essere
        temporaneamente non disponibili.
      </Text>
    </Alert>
  );
}

// Ruoli che possono agire sul pagamento
const BILLING_ROLES = ['ADMIN', 'DIRECTOR'];

export function DunningBanner() {
  const locale = useLocale();
  const { data: session, status: sessionStatus } = useSession();
  const [graceEnd, setGraceEnd] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return;
    const role = session?.user?.role;
    if (!role || !BILLING_ROLES.includes(role)) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/subscriptions');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        // PAST_DUE con periodo di grazia ancora aperto → avviso dunning
        if (
          data?.status === 'past_due' &&
          data?.gracePeriodEnd &&
          new Date(data.gracePeriodEnd) > new Date()
        ) {
          setGraceEnd(data.gracePeriodEnd);
        }
      } catch {
        /* fail-safe: nessun banner */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionStatus, session?.user?.role]);

  if (!graceEnd) return null;

  return (
    <Alert
      variant="light"
      color="red"
      radius="md"
      mb="md"
      icon={<IconCreditCard size={20} />}
      data-testid="dunning-banner"
    >
      <Group justify="space-between" align="center" gap="md" wrap="wrap">
        <Box style={{ flex: 1, minWidth: 220 }}>
          <Text fw={600} size="sm">
            Pagamento non riuscito
          </Text>
          <Text size="xs" c="dimmed" mt={2}>
            Aggiorna il metodo di pagamento entro il {dayjs(graceEnd).format('DD/MM/YYYY')} per
            evitare la sospensione del servizio.
          </Text>
        </Box>
        <Button
          component={Link}
          href={`/${locale}/dashboard/billing`}
          size="sm"
          color="red"
          variant="filled"
          rightSection={<IconArrowRight size={16} />}
          data-testid="dunning-banner-cta"
        >
          Aggiorna pagamento
        </Button>
      </Group>
    </Alert>
  );
}
