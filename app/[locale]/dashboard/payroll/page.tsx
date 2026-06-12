'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useSession } from 'next-auth/react';
import {
  Container,
  Title,
  Text,
  Paper,
  Button,
  Group,
  Stack,
  Modal,
  NumberInput,
  Select,
  Textarea,
  Badge,
  Table,
  ActionIcon,
  Grid,
  Alert,
  LoadingOverlay,
  Skeleton,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconLock,
  IconChevronDown,
  IconChevronRight,
  IconCashBanknote,
  IconCalendar,
  IconFileEuro,
  IconAlertTriangle,
  IconPlayerPlay,
  IconEye,
} from '@tabler/icons-react';
import {
  usePayrollPeriods,
  useCreatePayrollPeriod,
  useGeneratePayrolls,
  useLockPeriod,
  type PayrollPeriod,
  type PayrollStatus,
  type PayrollPeriodStatus,
} from '@/lib/hooks/usePayroll';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';

/** Cedolino "leggero" incluso nella GET /api/payroll/periods */
interface PeriodPayrollRow {
  id: string;
  status: PayrollStatus;
  netAmount: string | number;
  grossBase: string | number;
  extrasTotal: string | number;
  teacher: { id: string; firstName: string; lastName: string };
}

type PeriodWithPayrolls = PayrollPeriod & { payrolls?: PeriodPayrollRow[] };

interface PeriodFormData {
  year: number;
  month: string;
  notes: string;
}

const MONTH_LABELS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

/** Formatta un importo (number | string | Prisma.Decimal) come valuta €. */
function euro(value: unknown): string {
  const n = Number(value ?? 0);
  return `€${(isNaN(n) ? 0 : n).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function periodLabel(period: PayrollPeriod): string {
  return `${MONTH_LABELS[period.month - 1] || period.month} ${period.year}`;
}

function getPeriodStatusColor(status: PayrollPeriodStatus): string {
  switch (status) {
    case 'OPEN': return 'blue';
    case 'LOCKED': return 'orange';
    case 'PAID': return 'green';
    default: return 'gray';
  }
}

function getPeriodStatusLabel(status: PayrollPeriodStatus): string {
  switch (status) {
    case 'OPEN': return 'Aperto';
    case 'LOCKED': return 'Bloccato';
    case 'PAID': return 'Pagato';
    default: return status;
  }
}

function getPayrollStatusColor(status: PayrollStatus): string {
  switch (status) {
    case 'DRAFT': return 'gray';
    case 'APPROVED': return 'blue';
    case 'PAID': return 'green';
    default: return 'gray';
  }
}

function getPayrollStatusLabel(status: PayrollStatus): string {
  switch (status) {
    case 'DRAFT': return 'Bozza';
    case 'APPROVED': return 'Approvato';
    case 'PAID': return 'Pagato';
    default: return status;
  }
}

export default function PayrollPage() {
  const locale = useLocale();
  const { data: session } = useSession();
  const role = session?.user?.role as string | undefined;
  const isTeacher = role === 'TEACHER';
  const canManage = !isTeacher;

  const [expandedPeriodId, setExpandedPeriodId] = useState<string | null>(null);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);

  const { data: periodsData, isLoading, error } = usePayrollPeriods();
  const createPeriod = useCreatePayrollPeriod();
  const generatePayrolls = useGeneratePayrolls();
  const lockPeriod = useLockPeriod();

  const periods = (periodsData?.periods || []) as PeriodWithPayrolls[];

  const now = new Date();
  const form = useForm<PeriodFormData>({
    initialValues: {
      year: now.getFullYear(),
      month: String(now.getMonth() + 1),
      notes: '',
    },
    validate: {
      year: (value) => (value < 2000 || value > 2100 ? 'Anno non valido' : null),
      month: (value) => (!value ? 'Seleziona un mese' : null),
    },
  });

  // Stats
  const totalPeriods = periods.length;
  const openPeriods = periods.filter((p) => p.status === 'OPEN').length;
  const totalPayrolls = periods.reduce((sum, p) => sum + (p._count?.payrolls ?? p.payrolls?.length ?? 0), 0);

  const handleCreatePeriod = (values: PeriodFormData) => {
    createPeriod.mutate(
      { year: values.year, month: parseInt(values.month, 10), notes: values.notes || undefined },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Successo',
            message: 'Periodo creato con successo',
            color: 'green',
          });
          closeModal();
          form.reset();
        },
        onError: (err: Error) => {
          notifications.show({
            title: 'Errore',
            message: err.message || 'Errore nella creazione del periodo',
            color: 'red',
          });
        },
      },
    );
  };

  const handleGenerate = (period: PeriodWithPayrolls) => {
    generatePayrolls.mutate(period.id, {
      onSuccess: (result) => {
        notifications.show({
          title: 'Cedolini generati',
          message: `Creati: ${result.generated}, saltati: ${result.skipped}${
            result.errors.length > 0 ? `, errori: ${result.errors.length}` : ''
          }`,
          color: result.errors.length > 0 ? 'yellow' : 'green',
        });
        setExpandedPeriodId(period.id);
      },
      onError: (err: Error) => {
        notifications.show({
          title: 'Errore',
          message: err.message || 'Errore nella generazione dei cedolini',
          color: 'red',
        });
      },
    });
  };

  const handleLock = (period: PeriodWithPayrolls) => {
    if (!confirm(`Bloccare il periodo ${periodLabel(period)}? I cedolini non saranno più rigenerabili.`)) return;
    lockPeriod.mutate(period.id, {
      onSuccess: () => {
        notifications.show({
          title: 'Successo',
          message: 'Periodo bloccato',
          color: 'green',
        });
      },
      onError: (err: Error) => {
        notifications.show({
          title: 'Errore',
          message: err.message || 'Errore nel blocco del periodo',
          color: 'red',
        });
      },
    });
  };

  const toggleExpand = (periodId: string) => {
    setExpandedPeriodId((current) => (current === periodId ? null : periodId));
  };

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>{isTeacher ? 'I miei cedolini' : 'Paghe Docenti'}</Title>
            <Text c="dimmed" size="sm">
              {isTeacher
                ? 'I tuoi cedolini per periodo'
                : 'Periodi paghe, generazione e gestione cedolini'}
            </Text>
          </div>
          {canManage && (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                form.reset();
                openModal();
              }}
            >
              Nuovo Periodo
            </Button>
          )}
        </Group>

        <Text size="xs" c="dimmed">
          Strumento di costing, non sostitutivo di consulente del lavoro / busta paga ufficiale.
        </Text>

        {isLoading ? (
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
                title="Periodi Totali"
                value={totalPeriods.toString()}
                icon={<IconCalendar size={28} />}
                gradient="linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <ModernStatsCard
                title="Periodi Aperti"
                value={openPeriods.toString()}
                icon={<IconCashBanknote size={28} />}
                gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <ModernStatsCard
                title="Cedolini"
                value={totalPayrolls.toString()}
                icon={<IconFileEuro size={28} />}
                gradient="linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)"
              />
            </Grid.Col>
          </Grid>
        )}

        {error && (
          <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
            Errore nel caricamento dei periodi paghe
          </Alert>
        )}

        <Paper p="lg" radius="md" withBorder pos="relative">
          <LoadingOverlay visible={isLoading} />
          <Title order={4} mb="md">
            Periodi
          </Title>

          {!isLoading && periods.length === 0 ? (
            <Text c="dimmed">Nessun periodo paghe. Crea il primo periodo per iniziare.</Text>
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
                    <Table.Th style={{ width: 40 }} />
                    <Table.Th style={{ fontWeight: 600 }}>Periodo</Table.Th>
                    <Table.Th style={{ fontWeight: 600 }}>Stato</Table.Th>
                    <Table.Th style={{ fontWeight: 600 }}>Cedolini</Table.Th>
                    {canManage && <Table.Th style={{ fontWeight: 600 }}>Azioni</Table.Th>}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {periods.map((period) => {
                    const expanded = expandedPeriodId === period.id;
                    const payrolls = period.payrolls || [];
                    const count = period._count?.payrolls ?? payrolls.length;
                    return (
                      <Fragment key={period.id}>
                        <Table.Tr>
                          <Table.Td>
                            <ActionIcon
                              variant="subtle"
                              size="sm"
                              aria-label={`Espandi periodo ${periodLabel(period)}`}
                              onClick={() => toggleExpand(period.id)}
                            >
                              {expanded ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                            </ActionIcon>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm" fw={500}>
                              {periodLabel(period)}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge color={getPeriodStatusColor(period.status)} variant="light">
                              {getPeriodStatusLabel(period.status)}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{isTeacher ? payrolls.length : count}</Text>
                          </Table.Td>
                          {canManage && (
                            <Table.Td>
                              <Group gap="xs">
                                <Tooltip label="Genera cedolini">
                                  <ActionIcon
                                    variant="light"
                                    color="green"
                                    size="sm"
                                    disabled={period.status !== 'OPEN'}
                                    loading={generatePayrolls.isPending && generatePayrolls.variables === period.id}
                                    onClick={() => handleGenerate(period)}
                                    aria-label={`Genera cedolini ${periodLabel(period)}`}
                                  >
                                    <IconPlayerPlay size={14} />
                                  </ActionIcon>
                                </Tooltip>
                                <Tooltip label="Blocca periodo">
                                  <ActionIcon
                                    variant="light"
                                    color="orange"
                                    size="sm"
                                    disabled={period.status !== 'OPEN'}
                                    loading={lockPeriod.isPending && lockPeriod.variables === period.id}
                                    onClick={() => handleLock(period)}
                                    aria-label={`Blocca periodo ${periodLabel(period)}`}
                                  >
                                    <IconLock size={14} />
                                  </ActionIcon>
                                </Tooltip>
                              </Group>
                            </Table.Td>
                          )}
                        </Table.Tr>
                        {expanded && (
                          <Table.Tr>
                            <Table.Td colSpan={canManage ? 5 : 4} style={{ background: 'var(--mantine-color-gray-0)' }}>
                              {payrolls.length === 0 ? (
                                <Text size="sm" c="dimmed" py="xs">
                                  Nessun cedolino per questo periodo.
                                  {canManage && period.status === 'OPEN' && ' Usa "Genera cedolini" per crearli.'}
                                </Text>
                              ) : (
                                <Table>
                                  <Table.Thead>
                                    <Table.Tr>
                                      <Table.Th>Docente</Table.Th>
                                      <Table.Th>Lordo</Table.Th>
                                      <Table.Th>Netto</Table.Th>
                                      <Table.Th>Stato</Table.Th>
                                      <Table.Th />
                                    </Table.Tr>
                                  </Table.Thead>
                                  <Table.Tbody>
                                    {payrolls.map((payroll) => (
                                      <Table.Tr key={payroll.id}>
                                        <Table.Td>
                                          <Text size="sm" fw={500}>
                                            {payroll.teacher.firstName} {payroll.teacher.lastName}
                                          </Text>
                                        </Table.Td>
                                        <Table.Td>{euro(Number(payroll.grossBase ?? 0) + Number(payroll.extrasTotal ?? 0))}</Table.Td>
                                        <Table.Td style={{ fontWeight: 500 }}>{euro(payroll.netAmount)}</Table.Td>
                                        <Table.Td>
                                          <Badge color={getPayrollStatusColor(payroll.status)} variant="light">
                                            {getPayrollStatusLabel(payroll.status)}
                                          </Badge>
                                        </Table.Td>
                                        <Table.Td>
                                          <Button
                                            component={Link}
                                            href={`/${locale}/dashboard/payroll/${payroll.id}`}
                                            variant="light"
                                            size="xs"
                                            leftSection={<IconEye size={14} />}
                                          >
                                            Dettaglio
                                          </Button>
                                        </Table.Td>
                                      </Table.Tr>
                                    ))}
                                  </Table.Tbody>
                                </Table>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Fragment>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </div>
          )}
        </Paper>
      </Stack>

      {/* Modal nuovo periodo */}
      <Modal opened={modalOpened} onClose={closeModal} title="Nuovo Periodo Paghe" size="md">
        <form onSubmit={form.onSubmit(handleCreatePeriod)}>
          <Stack gap="md">
            <Grid>
              <Grid.Col span={6}>
                <NumberInput
                  label="Anno"
                  placeholder="2026"
                  min={2000}
                  max={2100}
                  {...form.getInputProps('year')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="Mese"
                  placeholder="Seleziona mese"
                  data={MONTH_LABELS.map((label, index) => ({
                    value: String(index + 1),
                    label,
                  }))}
                  allowDeselect={false}
                  {...form.getInputProps('month')}
                />
              </Grid.Col>
            </Grid>

            <Textarea
              label="Note"
              placeholder="Note opzionali sul periodo"
              autosize
              minRows={2}
              {...form.getInputProps('notes')}
            />

            <Group justify="flex-end" mt="md">
              <Button variant="light" color="gray" onClick={closeModal}>
                Annulla
              </Button>
              <Button type="submit" loading={createPeriod.isPending}>
                Crea
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
}
