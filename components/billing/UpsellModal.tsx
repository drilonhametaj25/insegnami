'use client';

import { Badge, Button, Group, Modal, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconArrowUpRight, IconLock } from '@tabler/icons-react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import {
  FEATURE_LABELS,
  FEATURE_MIN_PLAN,
  featureBadgeLabel,
  type FeatureKey,
} from '@/lib/billing/feature-catalog';

/**
 * Modale di upsell riusabile: da aprire quando una API risponde 403 con
 * code 'feature-not-in-plan' (o preventivamente da un elemento UI gated).
 * Porta a /dashboard/billing?upsell=<feature> dove il piano che include la
 * feature viene evidenziato.
 */

interface UpsellModalProps {
  feature: FeatureKey | null;
  opened: boolean;
  onClose: () => void;
}

const PLAN_NAMES: Record<'starter' | 'professional' | 'enterprise', string> = {
  starter: 'Starter',
  professional: 'Professional',
  enterprise: 'Enterprise',
};

export function UpsellModal({ feature, opened, onClose }: UpsellModalProps) {
  const locale = useLocale();

  if (!feature) return null;

  const minPlan = FEATURE_MIN_PLAN[feature];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Funzionalità non inclusa nel tuo piano"
      centered
      data-testid="upsell-modal"
    >
      <Stack gap="md">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon size="lg" radius="xl" color="amber" variant="light">
            <IconLock size={20} />
          </ThemeIcon>
          <div>
            <Text fw={600} size="sm">
              {FEATURE_LABELS[feature]}
            </Text>
            <Group gap={6} mt={4}>
              <Text size="xs" c="dimmed">
                Disponibile dal piano
              </Text>
              <Badge size="sm" color={minPlan === 'enterprise' ? 'grape' : 'navy'}>
                {featureBadgeLabel(feature)}
              </Badge>
            </Group>
          </div>
        </Group>
        <Text size="sm" c="dimmed">
          Passa al piano {PLAN_NAMES[minPlan]} per sbloccare questa funzionalità: l&apos;upgrade è
          immediato e mantieni tutti i tuoi dati.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} data-testid="upsell-modal-close">
            Non ora
          </Button>
          <Button
            component={Link}
            href={`/${locale}/dashboard/billing?upsell=${feature}`}
            color="navy"
            rightSection={<IconArrowUpRight size={16} />}
            onClick={onClose}
            data-testid="upsell-modal-upgrade"
          >
            Vedi i piani
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default UpsellModal;
