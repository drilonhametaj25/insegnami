'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  Container,
  Title,
  Paper,
  Button,
  Group,
  Stack,
  Select,
  Badge,
  Table,
  ActionIcon,
  Text,
  Grid,
  Alert,
  LoadingOverlay,
  Pagination,
  Skeleton,
} from '@mantine/core';
import {
  IconPlus,
  IconSettings,
  IconEye,
  IconFileInvoice,
  IconFileOff,
  IconSend,
  IconAlertTriangle,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import {
  useInvoices,
  useInvoiceSettings,
  useInvoiceSeries,
  useCustomerProfiles,
  type Invoice,
  type InvoiceCustomerProfile,
} from '@/lib/hooks/useInvoices';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';

/** Formatta un importo (number | string Decimal serializzato) come valuta €. */
function euro(value: unknown): string {
  const n = Number(value ?? 0);
  return `€${(isNaN(n) ? 0 : n).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Numero fattura formattato come lib/billing/invoice-numbering.formatInvoiceNumber. */
function formatNumber(prefix: string | null | undefined, year: number, number: number): string {
  const padded = String(number).padStart(4, '0');
  return prefix && prefix.trim() ? `${prefix}/${year}/${padded}` : `${year}/${padded}`;
}

function customerName(p?: InvoiceCustomerProfile | null): string {
  if (!p) return '—';
  return p.denominazione || [p.nome, p.cognome].filter(Boolean).join(' ') || '—';
}

// Stato applicativo (InvoiceStatus prisma)
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Bozza', color: 'gray' },
  ISSUED: { label: 'Emessa', color: 'blue' },
  SENT: { label: 'Inviata a SDI', color: 'indigo' },
  ACCEPTED: { label: 'Accettata', color: 'green' },
  REJECTED: { label: 'Scartata', color: 'red' },
  PAID: { label: 'Pagata', color: 'teal' },
  CANCELLED: { label: 'Annullata', color: 'gray' },
};

// Stato trasmissione SDI (SdiTransmissionStatus prisma) — badge SEPARATO
const SDI_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Non trasmessa', color: 'gray' },
  TRANSMITTED: { label: 'Trasmessa', color: 'blue' },
  ACCEPTED: { label: 'Accettata SDI', color: 'green' },
  REJECTED: { label: 'Scartata SDI', color: 'red' },
  NOT_DELIVERED: { label: 'Mancata consegna', color: 'orange' },
  EXPIRED: { label: 'Decorrenza termini', color: 'orange' },
};

const DOC_TYPE_LABELS: Record<string, string> = {
  TD01: 'Fattura',
  TD04: 'Nota di credito',
  TD06: 'Parcella',
};

export default function InvoicesPage() {
  const router = useRouter();
  const locale = useLocale();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [yearFilter, setYearFilter] = useState<string | null>(null);
  const [customerFilter, setCustomerFilter] = useState<string | null>(null);

  const { data: invoicesData, isLoading: invoicesLoading, error: invoicesError } = useInvoices(page, 20, {
    status: statusFilter ?? undefined,
    year: yearFilter ? parseInt(yearFilter, 10) : undefined,
    customerProfileId: customerFilter ?? undefined,
  });
  const { data: settingsData, isLoading: settingsLoading } = useInvoiceSettings();
  const { data: seriesData, isLoading: seriesLoading } = useInvoiceSeries();
  const { data: profilesData } = useCustomerProfiles();

  const invoices: Invoice[] = invoicesData?.invoices ?? [];
  const pagination = invoicesData?.pagination;
  const profiles = profilesData?.profiles ?? [];

  // Vuoto-stato di configurazione: senza settings o senza sezionali non si fattura.
  const setupMissing =
    !settingsLoading &&
    !seriesLoading &&
    (!settingsData?.settings || (seriesData?.series ?? []).length === 0);

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => String(currentYear - i));

  // Stats sulla pagina corrente + totale dal pagination
  const draftCount = invoices.filter((i) => i.status === 'DRAFT').length;
  const toTransmitCount = invoices.filter((i) => i.status === 'ISSUED').length;
  const rejectedCount = invoices.filter((i) => i.sdiStatus === 'REJECTED').length;

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={2}>Fatture</Title>
          <Group>
            <Button
              variant="light"
              leftSection={<IconSettings size={16} />}
              onClick={() => router.push(`/${locale}/dashboard/invoices/settings`)}
            >
              Impostazioni
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => router.push(`/${locale}/dashboard/invoices/new`)}
            >
              Nuova fattura
            </Button>
          </Group>
        </Group>

        {setupMissing && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="yellow"
            variant="light"
            title="Configura la fatturazione"
          >
            <Stack gap="sm">
              <Text size="sm">
                Per emettere fatture elettroniche servono i dati fiscali della scuola e almeno un
                sezionale di numerazione.
              </Text>
              <Group>
                <Button
                  size="xs"
                  color="yellow"
                  onClick={() => router.push(`/${locale}/dashboard/invoices/settings`)}
                >
                  Vai alle impostazioni
                </Button>
              </Group>
            </Stack>
          </Alert>
        )}

        {invoicesLoading ? (
          <Grid>
            {[1, 2, 3, 4].map((i) => (
              <Grid.Col key={i} span={{ base: 12, sm: 6, md: 3 }}>
                <Skeleton height={140} radius="xl" />
              </Grid.Col>
            ))}
          </Grid>
        ) : (
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <ModernStatsCard
                title="Totale fatture"
                value={pagination?.total ?? 0}
                icon={<IconFileInvoice size={28} />}
                gradient="linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <ModernStatsCard
                title="Bozze"
                value={draftCount}
                icon={<IconFileOff size={28} />}
                gradient="linear-gradient(135deg, #6b7280 0%, #4b5563 100%)"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <ModernStatsCard
                title="Da trasmettere"
                value={toTransmitCount}
                icon={<IconSend size={28} />}
                gradient="linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <ModernStatsCard
                title="Scartate SDI"
                value={rejectedCount}
                icon={<IconAlertTriangle size={28} />}
                gradient="linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
              />
            </Grid.Col>
          </Grid>
        )}

        <Paper p="lg" radius="md" withBorder>
          <Stack gap="md">
            <Group>
              <Select
                placeholder="Tutti gli stati"
                data={Object.entries(STATUS_LABELS).map(([value, { label }]) => ({ value, label }))}
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
                clearable
                w={180}
              />
              <Select
                placeholder="Anno"
                data={yearOptions}
                value={yearFilter}
                onChange={(v) => {
                  setYearFilter(v);
                  setPage(1);
                }}
                clearable
                w={120}
              />
              <Select
                placeholder="Cliente"
                data={profiles.map((p) => ({ value: p.id, label: customerName(p) }))}
                value={customerFilter}
                onChange={(v) => {
                  setCustomerFilter(v);
                  setPage(1);
                }}
                clearable
                searchable
                w={240}
              />
            </Group>

            <div style={{ position: 'relative' }}>
              <LoadingOverlay visible={invoicesLoading} />

              {invoicesError ? (
                <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
                  Errore nel caricamento delle fatture
                </Alert>
              ) : invoices.length === 0 && !invoicesLoading ? (
                <Text c="dimmed" ta="center" py="xl">
                  Nessuna fattura trovata
                </Text>
              ) : (
                <div
                  style={{
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid var(--mantine-color-gray-2)',
                  }}
                >
                  <Table striped highlightOnHover>
                    <Table.Thead style={{ background: 'var(--mantine-color-gray-0)' }}>
                      <Table.Tr>
                        <Table.Th style={{ fontWeight: 600 }}>Numero</Table.Th>
                        <Table.Th style={{ fontWeight: 600 }}>Tipo</Table.Th>
                        <Table.Th style={{ fontWeight: 600 }}>Cliente</Table.Th>
                        <Table.Th style={{ fontWeight: 600 }}>Data</Table.Th>
                        <Table.Th style={{ fontWeight: 600 }}>Importo</Table.Th>
                        <Table.Th style={{ fontWeight: 600 }}>Stato</Table.Th>
                        <Table.Th style={{ fontWeight: 600 }}>SDI</Table.Th>
                        <Table.Th style={{ fontWeight: 600 }}>Azioni</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {invoices.map((invoice) => {
                        const status = STATUS_LABELS[invoice.status] ?? { label: invoice.status, color: 'gray' };
                        const sdi = SDI_STATUS_LABELS[invoice.sdiStatus] ?? { label: invoice.sdiStatus, color: 'gray' };
                        const seriesPrefix = (invoice.series as { prefix?: string | null } | undefined)?.prefix;
                        return (
                          <Table.Tr key={invoice.id}>
                            <Table.Td>
                              {invoice.number > 0 ? (
                                <Text size="sm" fw={500}>
                                  {formatNumber(seriesPrefix, invoice.year, invoice.number)}
                                </Text>
                              ) : (
                                <Text size="sm" c="dimmed">—</Text>
                              )}
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{DOC_TYPE_LABELS[invoice.documentType] ?? invoice.documentType}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" fw={500}>{customerName(invoice.customerProfile)}</Text>
                              <Text size="xs" c="dimmed">
                                {invoice.customerProfile?.partitaIva || invoice.customerProfile?.codiceFiscale || ''}
                              </Text>
                            </Table.Td>
                            <Table.Td>{dayjs(invoice.issueDate).format('DD/MM/YYYY')}</Table.Td>
                            <Table.Td style={{ fontWeight: 500 }}>{euro(invoice.total)}</Table.Td>
                            <Table.Td>
                              <Badge color={status.color} variant="light">
                                {status.label}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Badge color={sdi.color} variant="outline">
                                {sdi.label}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <ActionIcon
                                variant="light"
                                color="blue"
                                size="sm"
                                title="Dettaglio"
                                onClick={() => router.push(`/${locale}/dashboard/invoices/${invoice.id}`)}
                              >
                                <IconEye size={14} />
                              </ActionIcon>
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                </div>
              )}
            </div>

            {(pagination?.totalPages ?? 0) > 1 && (
              <Group justify="center">
                <Pagination value={page} onChange={setPage} total={pagination!.totalPages} />
              </Group>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}
