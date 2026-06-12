'use client';

import { useState } from 'react';
import {
  Container,
  Title,
  Paper,
  Button,
  Group,
  Stack,
  Select,
  TextInput,
  Badge,
  Table,
  Text,
  Tabs,
  Grid,
  Card,
  LoadingOverlay,
  Pagination,
  Skeleton,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import {
  IconPlus,
  IconCurrencyEuro,
  IconTrendingUp,
  IconTrendingDown,
  IconScale,
  IconListDetails,
  IconReportMoney,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import {
  useAccountingMovements,
  usePnL,
  type MovementFilters,
  type AccountingMovement,
} from '@/lib/hooks/useAccounting';
import { AccountingMovementForm } from '@/components/forms/AccountingMovementForm';
import { PnLChart } from '@/components/charts/PnLChart';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';

/** Formatta un importo (number | string | Prisma.Decimal) come valuta €. */
function euro(value: unknown): string {
  const n = Number(value ?? 0);
  return `€${(isNaN(n) ? 0 : n).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getTypeBadge(type: AccountingMovement['type']) {
  return type === 'REVENUE'
    ? { color: 'green', label: 'Ricavo' }
    : { color: 'red', label: 'Costo' };
}

function getSourceLabel(source: AccountingMovement['source']): string {
  switch (source) {
    case 'PAYMENT':
      return 'Pagamento';
    case 'PAYROLL':
      return 'Cedolino';
    case 'MANUAL':
      return 'Manuale';
    default:
      return source;
  }
}

function getSourceColor(source: AccountingMovement['source']): string {
  switch (source) {
    case 'PAYMENT':
      return 'blue';
    case 'PAYROLL':
      return 'violet';
    case 'MANUAL':
      return 'gray';
    default:
      return 'gray';
  }
}

type PnLPeriod = 'month' | 'year' | 'custom';

export default function AccountingPage() {
  const [activeTab, setActiveTab] = useState('movements');
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);

  // --- Filtri movimenti ---
  const [currentPage, setCurrentPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateRange, setDateRange] = useState<[Date | null, Date | null]>([null, null]);

  const filters: MovementFilters = {
    type: typeFilter || undefined,
    source: sourceFilter || undefined,
    category: categoryFilter.trim() || undefined,
    from: dateRange[0] ? dayjs(dateRange[0]).format('YYYY-MM-DD') : undefined,
    to: dateRange[1] ? dayjs(dateRange[1]).format('YYYY-MM-DD') : undefined,
  };

  const {
    data: movementsData,
    isLoading: movementsLoading,
    error: movementsError,
  } = useAccountingMovements(currentPage, 20, filters);

  const movements = movementsData?.movements || [];
  const totalPages = movementsData?.pagination?.totalPages || 1;

  // --- Periodo P&L ---
  const [pnlPeriod, setPnlPeriod] = useState<PnLPeriod>('month');
  const [pnlRange, setPnlRange] = useState<[Date | null, Date | null]>([null, null]);

  const pnlDates = (() => {
    if (pnlPeriod === 'year') {
      return {
        from: dayjs().startOf('year').format('YYYY-MM-DD'),
        to: dayjs().endOf('year').format('YYYY-MM-DD'),
      };
    }
    if (pnlPeriod === 'custom' && pnlRange[0] && pnlRange[1]) {
      return {
        from: dayjs(pnlRange[0]).format('YYYY-MM-DD'),
        to: dayjs(pnlRange[1]).format('YYYY-MM-DD'),
      };
    }
    // Default: mese corrente
    return {
      from: dayjs().startOf('month').format('YYYY-MM-DD'),
      to: dayjs().endOf('month').format('YYYY-MM-DD'),
    };
  })();

  const { data: pnlData, isLoading: pnlLoading } = usePnL({ ...pnlDates, trend: 12 });

  const report = pnlData?.report;
  const trend = pnlData?.trend || [];

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={2}>Contabilità</Title>
          <Button leftSection={<IconPlus size={16} />} onClick={openModal}>
            Nuovo Movimento
          </Button>
        </Group>

        <Tabs value={activeTab} onChange={(value) => value && setActiveTab(value)}>
          <Tabs.List>
            <Tabs.Tab value="movements" leftSection={<IconListDetails size={16} />}>
              Movimenti
            </Tabs.Tab>
            <Tabs.Tab value="pnl" leftSection={<IconReportMoney size={16} />}>
              P&L
            </Tabs.Tab>
          </Tabs.List>

          {/* ------------------------- TAB MOVIMENTI ------------------------- */}
          <Tabs.Panel value="movements" pt="lg">
            <Stack gap="md">
              <Paper p="md" radius="md" withBorder>
                <Group grow align="flex-end">
                  <Select
                    label="Tipo"
                    placeholder="Tutti"
                    data={[
                      { value: 'REVENUE', label: 'Ricavo' },
                      { value: 'COST', label: 'Costo' },
                    ]}
                    value={typeFilter}
                    onChange={(value) => {
                      setTypeFilter(value);
                      setCurrentPage(1);
                    }}
                    clearable
                  />
                  <Select
                    label="Origine"
                    placeholder="Tutte"
                    data={[
                      { value: 'PAYMENT', label: 'Pagamento' },
                      { value: 'PAYROLL', label: 'Cedolino' },
                      { value: 'MANUAL', label: 'Manuale' },
                    ]}
                    value={sourceFilter}
                    onChange={(value) => {
                      setSourceFilter(value);
                      setCurrentPage(1);
                    }}
                    clearable
                  />
                  <TextInput
                    label="Categoria"
                    placeholder="Es: affitto"
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.currentTarget.value);
                      setCurrentPage(1);
                    }}
                  />
                  <DatePickerInput
                    type="range"
                    label="Periodo"
                    placeholder="Da - a"
                    valueFormat="DD/MM/YYYY"
                    value={dateRange}
                    onChange={(value) => {
                      setDateRange(value);
                      setCurrentPage(1);
                    }}
                    clearable
                  />
                </Group>
              </Paper>

              <Paper p="lg" radius="md" withBorder pos="relative">
                <LoadingOverlay visible={movementsLoading} />

                {movementsError ? (
                  <Text c="red" py="md">
                    Errore nel caricamento dei movimenti
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
                          <Table.Th style={{ fontWeight: 600 }}>Data</Table.Th>
                          <Table.Th style={{ fontWeight: 600 }}>Tipo</Table.Th>
                          <Table.Th style={{ fontWeight: 600 }}>Origine</Table.Th>
                          <Table.Th style={{ fontWeight: 600 }}>Categoria</Table.Th>
                          <Table.Th style={{ fontWeight: 600 }}>Descrizione</Table.Th>
                          <Table.Th style={{ fontWeight: 600, textAlign: 'right' }}>Importo</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {movements.length === 0 && !movementsLoading ? (
                          <Table.Tr>
                            <Table.Td colSpan={6}>
                              <Text c="dimmed" ta="center" py="md">
                                Nessun movimento trovato
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        ) : (
                          movements.map((movement) => {
                            const typeBadge = getTypeBadge(movement.type);
                            return (
                              <Table.Tr key={movement.id}>
                                <Table.Td>{dayjs(movement.date).format('DD/MM/YYYY')}</Table.Td>
                                <Table.Td>
                                  <Badge color={typeBadge.color} variant="light">
                                    {typeBadge.label}
                                  </Badge>
                                </Table.Td>
                                <Table.Td>
                                  <Badge color={getSourceColor(movement.source)} variant="outline">
                                    {getSourceLabel(movement.source)}
                                  </Badge>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="sm">{movement.category}</Text>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="sm" c={movement.description ? undefined : 'dimmed'}>
                                    {movement.description || '-'}
                                  </Text>
                                </Table.Td>
                                <Table.Td style={{ textAlign: 'right', fontWeight: 500 }}>
                                  <Text
                                    size="sm"
                                    fw={600}
                                    c={movement.type === 'REVENUE' ? 'green' : 'red'}
                                  >
                                    {movement.type === 'REVENUE' ? '+' : '-'}
                                    {euro(movement.amount)}
                                  </Text>
                                </Table.Td>
                              </Table.Tr>
                            );
                          })
                        )}
                      </Table.Tbody>
                    </Table>
                  </div>
                )}

                {totalPages > 1 && (
                  <Group justify="center" mt="md">
                    <Pagination value={currentPage} onChange={setCurrentPage} total={totalPages} />
                  </Group>
                )}
              </Paper>
            </Stack>
          </Tabs.Panel>

          {/* --------------------------- TAB P&L ----------------------------- */}
          <Tabs.Panel value="pnl" pt="lg">
            <Stack gap="md">
              <Paper p="md" radius="md" withBorder>
                <Group align="flex-end">
                  <Select
                    label="Periodo"
                    data={[
                      { value: 'month', label: 'Mese corrente' },
                      { value: 'year', label: 'Anno corrente' },
                      { value: 'custom', label: 'Personalizzato' },
                    ]}
                    value={pnlPeriod}
                    onChange={(value) => value && setPnlPeriod(value as PnLPeriod)}
                    allowDeselect={false}
                    w={200}
                  />
                  {pnlPeriod === 'custom' && (
                    <DatePickerInput
                      type="range"
                      label="Intervallo"
                      placeholder="Da - a"
                      valueFormat="DD/MM/YYYY"
                      value={pnlRange}
                      onChange={setPnlRange}
                      w={280}
                    />
                  )}
                  {report && (
                    <Text size="sm" c="dimmed">
                      Dal {dayjs(report.period.start).format('DD/MM/YYYY')} al{' '}
                      {dayjs(report.period.end).format('DD/MM/YYYY')} — {report.movementCount}{' '}
                      movimenti
                    </Text>
                  )}
                </Group>
              </Paper>

              {pnlLoading ? (
                <Grid>
                  {[1, 2, 3].map((i) => (
                    <Grid.Col key={i} span={{ base: 12, sm: 4 }}>
                      <Skeleton height={140} radius="xl" />
                    </Grid.Col>
                  ))}
                </Grid>
              ) : (
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <ModernStatsCard
                      title="Ricavi"
                      value={euro(report?.revenueTotal)}
                      icon={<IconTrendingUp size={28} />}
                      gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <ModernStatsCard
                      title="Costi"
                      value={euro(report?.costTotal)}
                      icon={<IconTrendingDown size={28} />}
                      gradient="linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <ModernStatsCard
                      title="Risultato Netto"
                      value={euro(report?.netMargin)}
                      icon={<IconScale size={28} />}
                      gradient="linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
                      badge={
                        report
                          ? {
                              text: `${report.marginPct.toFixed(1)}% margine`,
                              color: report.netMargin >= 0 ? 'blue' : 'red',
                            }
                          : undefined
                      }
                    />
                  </Grid.Col>
                </Grid>
              )}

              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Card withBorder p="lg" radius="md">
                    <Title order={4} mb="md">
                      Ricavi per categoria
                    </Title>
                    {report && report.revenues.length > 0 ? (
                      <Table>
                        <Table.Tbody>
                          {report.revenues.map((line) => (
                            <Table.Tr key={line.category}>
                              <Table.Td>
                                <Text size="sm">{line.category}</Text>
                                <Text size="xs" c="dimmed">
                                  {line.count} movimenti
                                </Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text size="sm" fw={600} c="green">
                                  {euro(line.total)}
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    ) : (
                      <Text c="dimmed" size="sm">
                        Nessun ricavo nel periodo
                      </Text>
                    )}
                  </Card>
                </Grid.Col>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Card withBorder p="lg" radius="md">
                    <Title order={4} mb="md">
                      Costi per categoria
                    </Title>
                    {report && report.costs.length > 0 ? (
                      <Table>
                        <Table.Tbody>
                          {report.costs.map((line) => (
                            <Table.Tr key={line.category}>
                              <Table.Td>
                                <Text size="sm">{line.category}</Text>
                                <Text size="xs" c="dimmed">
                                  {line.count} movimenti
                                </Text>
                              </Table.Td>
                              <Table.Td style={{ textAlign: 'right' }}>
                                <Text size="sm" fw={600} c="red">
                                  {euro(line.total)}
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    ) : (
                      <Text c="dimmed" size="sm">
                        Nessun costo nel periodo
                      </Text>
                    )}
                  </Card>
                </Grid.Col>
              </Grid>

              <Card withBorder p="lg" radius="md">
                <Group justify="space-between" mb="md">
                  <Title order={4}>Trend ultimi 12 mesi</Title>
                  <IconCurrencyEuro size={20} color="gray" />
                </Group>
                <PnLChart trend={trend} />
              </Card>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>

      <AccountingMovementForm opened={modalOpened} onClose={closeModal} />
    </Container>
  );
}
