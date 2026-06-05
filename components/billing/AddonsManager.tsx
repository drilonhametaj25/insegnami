'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Button,
  Badge,
  SimpleGrid,
  Card,
  ThemeIcon,
  Progress,
  Box,
  ActionIcon,
  Loader,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconUsers,
  IconSchool,
  IconBook,
  IconDatabase,
  IconPlus,
  IconMinus,
} from '@tabler/icons-react';

interface AddonDef {
  type: 'EXTRA_STUDENTS' | 'EXTRA_TEACHERS' | 'EXTRA_CLASSES' | 'EXTRA_STORAGE';
  name: string;
  description: string;
  unitSize: number;
  unitLabel: string;
  unitPrice: number;
}

interface ActiveAddon {
  type: AddonDef['type'];
  quantity: number;
  unitPrice: number;
  monthlyTotal: number;
}

interface AddonsResponse {
  catalog: AddonDef[];
  active: ActiveAddon[];
  storage: { usedBytes: number; limitBytes: number | null };
}

const ICONS: Record<AddonDef['type'], React.ReactNode> = {
  EXTRA_STUDENTS: <IconUsers size={20} />,
  EXTRA_TEACHERS: <IconSchool size={20} />,
  EXTRA_CLASSES: <IconBook size={20} />,
  EXTRA_STORAGE: <IconDatabase size={20} />,
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 GB';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

export function AddonsManager({ onChange }: { onChange?: () => void }) {
  const [data, setData] = useState<AddonsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/subscriptions/addons');
      if (!res.ok) throw new Error('load failed');
      setData(await res.json());
    } catch {
      notifications.show({ title: 'Errore', message: 'Impossibile caricare gli add-on', color: 'red' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mutate = async (type: AddonDef['type'], method: 'POST' | 'DELETE') => {
    setMutating(`${type}-${method}`);
    try {
      const res = await fetch('/api/subscriptions/addons', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, quantity: 1 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Operazione non riuscita');
      }
      await load();
      onChange?.();
      notifications.show({
        title: method === 'POST' ? 'Add-on aggiunto' : 'Add-on rimosso',
        message: 'Limiti aggiornati con successo',
        color: 'green',
      });
    } catch (e) {
      notifications.show({
        title: 'Errore',
        message: e instanceof Error ? e.message : 'Errore imprevisto',
        color: 'red',
      });
    } finally {
      setMutating(null);
    }
  };

  if (loading) {
    return (
      <Paper p="xl" radius="md" withBorder>
        <Group justify="center"><Loader size="sm" /></Group>
      </Paper>
    );
  }

  if (!data) return null;

  const qtyOf = (type: AddonDef['type']) =>
    data.active.find((a) => a.type === type)?.quantity ?? 0;

  const storagePct = data.storage.limitBytes
    ? Math.min((data.storage.usedBytes / data.storage.limitBytes) * 100, 100)
    : 0;

  const totalMonthly = data.active.reduce((s, a) => s + a.monthlyTotal, 0);

  return (
    <Paper p="xl" radius="md" withBorder data-testid="addons-section">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={3}>Espansioni & Add-on</Title>
          <Text c="dimmed" size="sm">
            Aumenta i limiti del tuo piano con posti e spazio extra
          </Text>
        </div>
        {totalMonthly > 0 && (
          <Badge size="lg" color="violet" data-testid="addons-total">
            +€{totalMonthly}/mese
          </Badge>
        )}
      </Group>

      {/* Storage meter */}
      <Box mb="lg">
        <Group justify="space-between" mb={4}>
          <Group gap="xs">
            <IconDatabase size={16} />
            <Text size="sm">Spazio archiviazione</Text>
          </Group>
          <Text size="sm" c="dimmed" data-testid="storage-usage">
            {formatBytes(data.storage.usedBytes)} /{' '}
            {data.storage.limitBytes ? formatBytes(data.storage.limitBytes) : '∞'}
          </Text>
        </Group>
        <Progress value={storagePct} color={storagePct > 80 ? 'orange' : 'teal'} size="sm" radius="xl" />
      </Box>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {data.catalog.map((addon) => {
          const qty = qtyOf(addon.type);
          return (
            <Card key={addon.type} withBorder radius="md" p="md" data-testid={`addon-card-${addon.type}`}>
              <Group justify="space-between" mb="xs">
                <Group gap="sm">
                  <ThemeIcon size="lg" radius="md" variant="light" color="violet">
                    {ICONS[addon.type]}
                  </ThemeIcon>
                  <div>
                    <Text fw={600} size="sm">{addon.name}</Text>
                    <Text size="xs" c="dimmed">{addon.description}</Text>
                  </div>
                </Group>
              </Group>
              <Group justify="space-between" mt="md">
                <Text size="sm" fw={500} c="violet">€{addon.unitPrice}/mese</Text>
                <Group gap="xs">
                  <ActionIcon
                    variant="default"
                    disabled={qty === 0 || mutating !== null}
                    loading={mutating === `${addon.type}-DELETE`}
                    onClick={() => mutate(addon.type, 'DELETE')}
                    data-testid={`addon-${addon.type}-remove`}
                    aria-label={`Rimuovi ${addon.name}`}
                  >
                    <IconMinus size={16} />
                  </ActionIcon>
                  <Text fw={700} w={24} ta="center" data-testid={`addon-${addon.type}-qty`}>
                    {qty}
                  </Text>
                  <ActionIcon
                    variant="filled"
                    color="violet"
                    disabled={mutating !== null}
                    loading={mutating === `${addon.type}-POST`}
                    onClick={() => mutate(addon.type, 'POST')}
                    data-testid={`addon-${addon.type}-add`}
                    aria-label={`Aggiungi ${addon.name}`}
                  >
                    <IconPlus size={16} />
                  </ActionIcon>
                </Group>
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>
    </Paper>
  );
}
