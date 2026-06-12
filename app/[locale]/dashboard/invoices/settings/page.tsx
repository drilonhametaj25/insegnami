'use client';

import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  Container,
  Title,
  Paper,
  Button,
  Group,
  Stack,
  Modal,
  Badge,
  Table,
  Text,
  Skeleton,
  ActionIcon,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconPlus, IconArrowLeft } from '@tabler/icons-react';
import {
  useInvoiceSettings,
  useSaveInvoiceSettings,
  useInvoiceSeries,
  useCreateInvoiceSeries,
  type SaveInvoiceSettingsData,
  type CreateInvoiceSeriesData,
} from '@/lib/hooks/useInvoices';
import { InvoiceSettingsForm } from '@/components/forms/InvoiceSettingsForm';
import { InvoiceSeriesForm } from '@/components/forms/InvoiceSeriesForm';

/**
 * Impostazioni fatturazione (C2.2): identità fiscale del cedente/prestatore
 * + gestione dei sezionali di numerazione.
 */
export default function InvoiceSettingsPage() {
  const router = useRouter();
  const locale = useLocale();

  const { data: settingsData, isLoading: settingsLoading } = useInvoiceSettings();
  const saveSettings = useSaveInvoiceSettings();
  const { data: seriesData, isLoading: seriesLoading } = useInvoiceSeries();
  const createSeries = useCreateInvoiceSeries();

  const [seriesModalOpened, { open: openSeriesModal, close: closeSeriesModal }] = useDisclosure(false);

  const series = seriesData?.series ?? [];

  const handleSaveSettings = (data: SaveInvoiceSettingsData) => {
    saveSettings.mutate(data, {
      onSuccess: () => {
        notifications.show({
          title: 'Successo',
          message: 'Impostazioni di fatturazione salvate',
          color: 'green',
        });
      },
      onError: (error) => {
        notifications.show({
          title: 'Errore',
          message: error.message || 'Errore nel salvataggio delle impostazioni',
          color: 'red',
        });
      },
    });
  };

  const handleCreateSeries = (data: CreateInvoiceSeriesData) => {
    createSeries.mutate(data, {
      onSuccess: () => {
        notifications.show({
          title: 'Successo',
          message: 'Sezionale creato',
          color: 'green',
        });
        closeSeriesModal();
      },
      onError: (error) => {
        notifications.show({
          title: 'Errore',
          message: error.message || 'Errore nella creazione del sezionale',
          color: 'red',
        });
      },
    });
  };

  return (
    <Container size="lg" py="md">
      <Stack gap="lg">
        <Group>
          <ActionIcon
            variant="light"
            size="lg"
            title="Torna alle fatture"
            onClick={() => router.push(`/${locale}/dashboard/invoices`)}
          >
            <IconArrowLeft size={18} />
          </ActionIcon>
          <Title order={2}>Impostazioni fatturazione</Title>
        </Group>

        <Paper p="lg" radius="md" withBorder>
          <Stack gap="md">
            <Title order={4}>Identità fiscale (cedente/prestatore)</Title>
            {settingsLoading ? (
              <Stack gap="sm">
                <Skeleton height={36} />
                <Skeleton height={36} />
                <Skeleton height={36} />
              </Stack>
            ) : (
              <InvoiceSettingsForm
                // Remount al cambio dei dati caricati così il form parte dai valori salvati
                key={settingsData?.settings ? 'loaded' : 'empty'}
                initialValues={settingsData?.settings ?? null}
                onSubmit={handleSaveSettings}
                isSubmitting={saveSettings.isPending}
              />
            )}
          </Stack>
        </Paper>

        <Paper p="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={4}>Sezionali di numerazione</Title>
              <Button size="xs" leftSection={<IconPlus size={14} />} onClick={openSeriesModal}>
                Nuovo sezionale
              </Button>
            </Group>

            {seriesLoading ? (
              <Skeleton height={80} />
            ) : series.length === 0 ? (
              <Text c="dimmed" size="sm">
                Nessun sezionale configurato. Creane uno (es. codice VEN, prefisso F) per poter
                emettere fatture.
              </Text>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Codice</Table.Th>
                    <Table.Th>Prefisso</Table.Th>
                    <Table.Th>Descrizione</Table.Th>
                    <Table.Th>Default</Table.Th>
                    <Table.Th>Stato</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {series.map((s) => (
                    <Table.Tr key={s.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>{s.code}</Text>
                      </Table.Td>
                      <Table.Td>{s.prefix || '—'}</Table.Td>
                      <Table.Td>{s.description || '—'}</Table.Td>
                      <Table.Td>
                        {s.isDefault && (
                          <Badge color="blue" variant="light">Default</Badge>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge color={s.isActive ? 'green' : 'gray'} variant="light">
                          {s.isActive ? 'Attivo' : 'Disattivato'}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Stack>
        </Paper>
      </Stack>

      <Modal opened={seriesModalOpened} onClose={closeSeriesModal} title="Nuovo sezionale">
        <InvoiceSeriesForm
          onSubmit={handleCreateSeries}
          onCancel={closeSeriesModal}
          isSubmitting={createSeries.isPending}
        />
      </Modal>
    </Container>
  );
}
