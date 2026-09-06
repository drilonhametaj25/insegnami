'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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
  TextInput,
  NumberInput,
  Select,
  Badge,
  Table,
  ActionIcon,
  Grid,
  Card,
  Alert,
  LoadingOverlay,
  Divider,
  SimpleGrid,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { can } from '@/lib/permissions/matrix';
import {
  IconArrowLeft,
  IconEdit,
  IconTrash,
  IconPlus,
  IconCheck,
  IconCashBanknote,
  IconDownload,
  IconAlertTriangle,
  IconUser,
} from '@tabler/icons-react';
import {
  usePayroll,
  useUpdatePayroll,
  useApprovePayroll,
  useMarkPayrollPaid,
  useDeletePayroll,
  type PayrollStatus,
  type PayrollLineItemType,
  type WithholdingType,
} from '@/lib/hooks/usePayroll';

const MONTH_LABELS = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

const LINE_TYPE_OPTIONS: Array<{ value: PayrollLineItemType; label: string }> = [
  { value: 'BONUS', label: 'Bonus' },
  { value: 'EXPENSE_REIMBURSEMENT', label: 'Rimborso spese' },
  { value: 'ADJUSTMENT', label: 'Correzione' },
  { value: 'OTHER', label: 'Altro' },
];

const WITHHOLDING_TYPE_OPTIONS: Array<{ value: WithholdingType; label: string }> = [
  { value: 'RITENUTA_ACCONTO', label: "Ritenuta d'acconto" },
  { value: 'INPS', label: 'INPS' },
  { value: 'INAIL', label: 'INAIL' },
  { value: 'OTHER', label: 'Altro' },
];

function getLineTypeLabel(type: PayrollLineItemType): string {
  switch (type) {
    case 'HOURS': return 'Ore';
    case 'BONUS': return 'Bonus';
    case 'EXPENSE_REIMBURSEMENT': return 'Rimborso spese';
    case 'ADJUSTMENT': return 'Correzione';
    case 'OTHER': return 'Altro';
    default: return type;
  }
}

function getWithholdingTypeLabel(type: WithholdingType): string {
  switch (type) {
    case 'RITENUTA_ACCONTO': return "Ritenuta d'acconto";
    case 'INPS': return 'INPS';
    case 'INAIL': return 'INAIL';
    case 'OTHER': return 'Altro';
    default: return type;
  }
}

function getStatusColor(status: PayrollStatus): string {
  switch (status) {
    case 'DRAFT': return 'gray';
    case 'APPROVED': return 'blue';
    case 'PAID': return 'green';
    default: return 'gray';
  }
}

function getStatusLabel(status: PayrollStatus): string {
  switch (status) {
    case 'DRAFT': return 'Bozza';
    case 'APPROVED': return 'Approvato';
    case 'PAID': return 'Pagato';
    default: return status;
  }
}

/** Formatta un importo (number | string | Prisma.Decimal) come valuta €. */
function euro(value: unknown): string {
  const n = Number(value ?? 0);
  return `€${(isNaN(n) ? 0 : n).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface ExtraFormRow {
  type: PayrollLineItemType;
  description: string;
  quantity: number | '';
  unitAmount: number | '';
}

interface WithholdingFormRow {
  type: WithholdingType;
  label: string;
  rate: number | '';
  base: number | '';
}

interface EditFormData {
  extras: ExtraFormRow[];
  withholdings: WithholdingFormRow[];
}

export default function PayrollDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const payrollId = params.id as string;
  const { data: session } = useSession();
  const role = session?.user?.role as string | undefined;
  // Matrice: solo chi ha update su payroll (ADMIN/SUPERADMIN); DIRECTOR è
  // read-only e TEACHER vede solo i propri cedolini
  const canManage = can(role, 'update', 'payroll');

  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [paidOpened, { open: openPaid, close: closePaid }] = useDisclosure(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const { data, isLoading, error } = usePayroll(payrollId);
  const updatePayroll = useUpdatePayroll();
  const approvePayroll = useApprovePayroll();
  const markPaid = useMarkPayrollPaid();
  const deletePayroll = useDeletePayroll();

  const payroll = data?.payroll;
  const lineItems = payroll?.lineItems || [];
  const withholdings = payroll?.withholdings || [];

  // Totali: il server espone grossBase/extrasTotal/withholdingsTotal come
  // aggregati Prisma; li ricalcoliamo dalle righe (stessa semantica del
  // generatore) così la UI resta coerente anche con shape parziali.
  const hoursItems = lineItems.filter((li) => li.type === 'HOURS');
  const extraItems = lineItems.filter((li) => li.type !== 'HOURS');
  const grossBase = hoursItems.reduce((sum, li) => sum + Number(li.total ?? 0), 0);
  const extrasTotal = extraItems.reduce((sum, li) => sum + Number(li.total ?? 0), 0);
  const grossTotal = grossBase + extrasTotal;
  const withholdingsTotal = withholdings.reduce((sum, w) => sum + Number(w.amount ?? 0), 0);
  const netAmount = Number(payroll?.netAmount ?? 0);

  const editForm = useForm<EditFormData>({
    initialValues: { extras: [], withholdings: [] },
    validate: {
      extras: {
        description: (value) => (!value ? 'Descrizione richiesta' : null),
        unitAmount: (value) => (value === '' ? 'Importo richiesto' : null),
      },
      withholdings: {
        label: (value) => (!value ? 'Etichetta richiesta' : null),
        rate: (value) => (value === '' || Number(value) < 0 || Number(value) > 100 ? 'Aliquota 0-100' : null),
        base: (value) => (value === '' ? 'Base richiesta' : null),
      },
    },
  });

  const handleOpenEdit = () => {
    editForm.setValues({
      extras: extraItems.map((li) => ({
        type: li.type,
        description: li.description,
        quantity: li.quantity != null ? Number(li.quantity) : '',
        unitAmount: Number(li.unitAmount ?? 0),
      })),
      withholdings: withholdings.map((w) => ({
        type: w.type,
        label: w.label,
        rate: Number(w.rate ?? 0),
        base: Number(w.base ?? 0),
      })),
    });
    openEdit();
  };

  const handleSaveEdit = (values: EditFormData) => {
    updatePayroll.mutate(
      {
        id: payrollId,
        data: {
          extras: values.extras.map((e) => {
            const quantity = e.quantity === '' ? undefined : Number(e.quantity);
            const unitAmount = Number(e.unitAmount || 0);
            return {
              type: e.type,
              description: e.description,
              quantity,
              unitAmount,
              total: (quantity ?? 1) * unitAmount,
            };
          }),
          withholdings: values.withholdings.map((w) => {
            const rate = Number(w.rate || 0);
            const base = Number(w.base || 0);
            return {
              type: w.type,
              label: w.label,
              rate,
              base,
              amount: Math.round(base * rate) / 100,
            };
          }),
        },
      },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Successo',
            message: 'Cedolino aggiornato: totali ricalcolati',
            color: 'green',
          });
          closeEdit();
        },
        onError: (err: Error) => {
          notifications.show({
            title: 'Errore',
            message: err.message || "Errore nell'aggiornamento del cedolino",
            color: 'red',
          });
        },
      },
    );
  };

  const handleApprove = () => {
    if (!confirm('Approvare il cedolino? Non sarà più modificabile.')) return;
    approvePayroll.mutate(payrollId, {
      onSuccess: () => {
        notifications.show({
          title: 'Successo',
          message: 'Cedolino approvato',
          color: 'green',
        });
      },
      onError: (err: Error) => {
        notifications.show({
          title: 'Errore',
          message: err.message || "Errore nell'approvazione del cedolino",
          color: 'red',
        });
      },
    });
  };

  const handleMarkPaid = () => {
    markPaid.mutate(
      { id: payrollId, data: { paymentReference: paymentReference || undefined } },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Successo',
            message: 'Cedolino segnato come pagato',
            color: 'green',
          });
          closePaid();
          setPaymentReference('');
        },
        onError: (err: Error) => {
          notifications.show({
            title: 'Errore',
            message: err.message || 'Errore nel segnare il cedolino come pagato',
            color: 'red',
          });
        },
      },
    );
  };

  const handleDelete = () => {
    if (!confirm('Eliminare la bozza del cedolino? Potrai rigenerarla dal periodo.')) return;
    deletePayroll.mutate(payrollId, {
      onSuccess: () => {
        notifications.show({
          title: 'Successo',
          message: 'Bozza eliminata',
          color: 'green',
        });
        router.push(`/${locale}/dashboard/payroll`);
      },
      onError: (err: Error) => {
        notifications.show({
          title: 'Errore',
          message: err.message || "Errore nell'eliminazione del cedolino",
          color: 'red',
        });
      },
    });
  };

  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true);
      setPdfError(null);
      const response = await fetch(`/api/payroll/${payrollId}/payslip-pdf`);
      if (response.status === 412) {
        setPdfError('Configura le impostazioni di fatturazione');
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Errore nel download del cedolino PDF');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cedolino-${payroll?.period?.year}-${payroll?.period?.month}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      notifications.show({
        title: 'Errore',
        message: err.message || 'Errore nel download del cedolino PDF',
        color: 'red',
      });
    } finally {
      setDownloadingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <Container size="xl" py="md">
        <LoadingOverlay visible />
        <div style={{ height: 400 }} />
      </Container>
    );
  }

  if (error || !payroll) {
    return (
      <Container size="xl" py="md">
        <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
          Cedolino non trovato
        </Alert>
      </Container>
    );
  }

  const isDraft = payroll.status === 'DRAFT';
  const periodTitle = payroll.period
    ? `${MONTH_LABELS[payroll.period.month - 1]} ${payroll.period.year}`
    : '';

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <ActionIcon
              variant="subtle"
              size="lg"
              component={Link}
              href={`/${locale}/dashboard/payroll`}
              aria-label="Torna alle paghe"
            >
              <IconArrowLeft size={20} />
            </ActionIcon>
            <div>
              <Group gap="sm">
                <Title order={2}>Cedolino {periodTitle}</Title>
                <Badge color={getStatusColor(payroll.status)} variant="light" size="lg">
                  {getStatusLabel(payroll.status)}
                </Badge>
              </Group>
              <Group gap="xs" mt={4}>
                <IconUser size={16} color="#868e96" />
                <Text c="dimmed">
                  {payroll.teacher
                    ? `${payroll.teacher.firstName} ${payroll.teacher.lastName}`
                    : 'Docente'}
                  {payroll.teacher?.teacherCode ? ` — ${payroll.teacher.teacherCode}` : ''}
                </Text>
              </Group>
            </div>
          </Group>

          <Group>
            <Button
              variant="light"
              leftSection={<IconDownload size={16} />}
              loading={downloadingPdf}
              onClick={handleDownloadPdf}
            >
              Scarica cedolino PDF
            </Button>
            {canManage && isDraft && (
              <>
                <Button leftSection={<IconEdit size={16} />} variant="light" onClick={handleOpenEdit}>
                  Modifica voci
                </Button>
                <Button
                  leftSection={<IconCheck size={16} />}
                  color="blue"
                  loading={approvePayroll.isPending}
                  onClick={handleApprove}
                >
                  Approva
                </Button>
                <Button
                  leftSection={<IconTrash size={16} />}
                  color="red"
                  variant="light"
                  loading={deletePayroll.isPending}
                  onClick={handleDelete}
                >
                  Elimina bozza
                </Button>
              </>
            )}
            {canManage && payroll.status === 'APPROVED' && (
              <Button
                leftSection={<IconCashBanknote size={16} />}
                color="green"
                onClick={openPaid}
              >
                Segna pagato
              </Button>
            )}
          </Group>
        </Group>

        {pdfError && (
          <Alert icon={<IconAlertTriangle size={16} />} color="yellow" variant="light" withCloseButton onClose={() => setPdfError(null)}>
            <Group gap="xs">
              <Text size="sm">{pdfError}</Text>
              <Button
                component={Link}
                href={`/${locale}/dashboard/invoices/settings`}
                size="compact-xs"
                variant="light"
              >
                Vai alle impostazioni di fatturazione
              </Button>
            </Group>
          </Alert>
        )}

        {/* Totali */}
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
          <Card withBorder radius="md" p="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Compenso base (ore)
            </Text>
            <Text size="xl" fw={700}>
              {euro(grossBase)}
            </Text>
          </Card>
          <Card withBorder radius="md" p="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Extra
            </Text>
            <Text size="xl" fw={700}>
              {euro(extrasTotal)}
            </Text>
          </Card>
          <Card withBorder radius="md" p="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Ritenute
            </Text>
            <Text size="xl" fw={700} c="red">
              -{euro(withholdingsTotal)}
            </Text>
          </Card>
          <Card withBorder radius="md" p="md">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
              Netto
            </Text>
            <Text size="xl" fw={700} c="green">
              {euro(netAmount)}
            </Text>
          </Card>
        </SimpleGrid>

        {/* Voci */}
        <Paper p="lg" radius="md" withBorder>
          <Title order={4} mb="md">
            Voci del cedolino
          </Title>
          {lineItems.length === 0 ? (
            <Text c="dimmed">Nessuna voce presente</Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Descrizione</Table.Th>
                  <Table.Th>Quantità</Table.Th>
                  <Table.Th>Importo unitario</Table.Th>
                  <Table.Th>Totale</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {lineItems.map((item) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>
                      <Badge variant="light" color={item.type === 'HOURS' ? 'blue' : 'grape'}>
                        {getLineTypeLabel(item.type)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{item.description}</Text>
                    </Table.Td>
                    <Table.Td>
                      {item.quantity != null
                        ? `${Number(item.quantity).toLocaleString('it-IT')}${item.type === 'HOURS' ? ' h' : ''}`
                        : '-'}
                    </Table.Td>
                    <Table.Td>{euro(item.unitAmount)}</Table.Td>
                    <Table.Td style={{ fontWeight: 500 }}>{euro(item.total)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>

        {/* Ritenute */}
        <Paper p="lg" radius="md" withBorder>
          <Title order={4} mb="md">
            Ritenute
          </Title>
          {withholdings.length === 0 ? (
            <Text c="dimmed">Nessuna ritenuta applicata</Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Etichetta</Table.Th>
                  <Table.Th>Aliquota</Table.Th>
                  <Table.Th>Base</Table.Th>
                  <Table.Th>Importo</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {withholdings.map((w) => (
                  <Table.Tr key={w.id}>
                    <Table.Td>
                      <Badge variant="light" color="orange">
                        {getWithholdingTypeLabel(w.type)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{w.label}</Text>
                    </Table.Td>
                    <Table.Td>{Number(w.rate).toLocaleString('it-IT')}%</Table.Td>
                    <Table.Td>{euro(w.base)}</Table.Td>
                    <Table.Td style={{ fontWeight: 500 }} c="red">
                      -{euro(w.amount)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>

        {/* Riepilogo + dati pagamento */}
        <Paper p="lg" radius="md" withBorder>
          <Title order={4} mb="md">
            Riepilogo
          </Title>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm">Lordo (base + extra)</Text>
                  <Text size="sm" fw={500}>
                    {euro(grossTotal)}
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Totale ritenute</Text>
                  <Text size="sm" fw={500} c="red">
                    -{euro(withholdingsTotal)}
                  </Text>
                </Group>
                <Divider />
                <Group justify="space-between">
                  <Text fw={600}>Netto da corrispondere</Text>
                  <Text fw={700} c="green">
                    {euro(netAmount)}
                  </Text>
                </Group>
              </Stack>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Stack gap="xs">
                {payroll.hourlyRateSnapshot != null && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Tariffa oraria (snapshot)
                    </Text>
                    <Text size="sm">{euro(payroll.hourlyRateSnapshot)}/h</Text>
                  </Group>
                )}
                {payroll.paidAt && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Pagato il
                    </Text>
                    <Text size="sm">{new Date(payroll.paidAt).toLocaleDateString('it-IT')}</Text>
                  </Group>
                )}
                {payroll.paymentReference && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Riferimento pagamento
                    </Text>
                    <Text size="sm">{payroll.paymentReference}</Text>
                  </Group>
                )}
                {payroll.notes && (
                  <Group justify="space-between" align="flex-start">
                    <Text size="sm" c="dimmed">
                      Note
                    </Text>
                    <Text size="sm">{payroll.notes}</Text>
                  </Group>
                )}
              </Stack>
            </Grid.Col>
          </Grid>
        </Paper>
      </Stack>

      {/* Modal modifica extra/ritenute (solo DRAFT) */}
      <Modal opened={editOpened} onClose={closeEdit} title="Modifica voci cedolino" size="xl">
        <form onSubmit={editForm.onSubmit(handleSaveEdit)}>
          <Stack gap="md">
            <Alert color="blue" variant="light">
              Le righe ore sono gestite dal generatore: qui modifichi solo extra e ritenute. Il
              server ricalcola i totali al salvataggio.
            </Alert>

            <Group justify="space-between">
              <Title order={5}>Extra</Title>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                onClick={() =>
                  editForm.insertListItem('extras', {
                    type: 'BONUS',
                    description: '',
                    quantity: '',
                    unitAmount: '',
                  } satisfies ExtraFormRow)
                }
              >
                Aggiungi extra
              </Button>
            </Group>
            {editForm.values.extras.length === 0 && (
              <Text size="sm" c="dimmed">
                Nessun extra
              </Text>
            )}
            {editForm.values.extras.map((_, index) => (
              <Group key={index} align="flex-end" gap="xs" wrap="nowrap">
                <Select
                  label="Tipo"
                  data={LINE_TYPE_OPTIONS}
                  w={170}
                  {...editForm.getInputProps(`extras.${index}.type`)}
                />
                <TextInput
                  label="Descrizione"
                  placeholder="Es: Bonus presenza"
                  style={{ flex: 1 }}
                  {...editForm.getInputProps(`extras.${index}.description`)}
                />
                <NumberInput
                  label="Quantità"
                  w={100}
                  min={0}
                  {...editForm.getInputProps(`extras.${index}.quantity`)}
                />
                <NumberInput
                  label="Importo €"
                  w={120}
                  step={0.01}
                  {...editForm.getInputProps(`extras.${index}.unitAmount`)}
                />
                <ActionIcon
                  color="red"
                  variant="light"
                  mb={4}
                  aria-label="Rimuovi extra"
                  onClick={() => editForm.removeListItem('extras', index)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ))}

            <Divider />

            <Group justify="space-between">
              <Title order={5}>Ritenute</Title>
              <Button
                size="xs"
                variant="light"
                leftSection={<IconPlus size={14} />}
                onClick={() =>
                  editForm.insertListItem('withholdings', {
                    type: 'RITENUTA_ACCONTO',
                    label: "Ritenuta d'acconto",
                    rate: 20,
                    base: grossTotal,
                  } satisfies WithholdingFormRow)
                }
              >
                Aggiungi ritenuta
              </Button>
            </Group>
            {editForm.values.withholdings.length === 0 && (
              <Text size="sm" c="dimmed">
                Nessuna ritenuta
              </Text>
            )}
            {editForm.values.withholdings.map((_, index) => (
              <Group key={index} align="flex-end" gap="xs" wrap="nowrap">
                <Select
                  label="Tipo"
                  data={WITHHOLDING_TYPE_OPTIONS}
                  w={170}
                  {...editForm.getInputProps(`withholdings.${index}.type`)}
                />
                <TextInput
                  label="Etichetta"
                  placeholder="Es: Ritenuta d'acconto 20%"
                  style={{ flex: 1 }}
                  {...editForm.getInputProps(`withholdings.${index}.label`)}
                />
                <NumberInput
                  label="Aliquota %"
                  w={110}
                  min={0}
                  max={100}
                  step={0.5}
                  {...editForm.getInputProps(`withholdings.${index}.rate`)}
                />
                <NumberInput
                  label="Base €"
                  w={120}
                  step={0.01}
                  {...editForm.getInputProps(`withholdings.${index}.base`)}
                />
                <ActionIcon
                  color="red"
                  variant="light"
                  mb={4}
                  aria-label="Rimuovi ritenuta"
                  onClick={() => editForm.removeListItem('withholdings', index)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ))}

            <Group justify="flex-end" mt="md">
              <Button variant="light" color="gray" onClick={closeEdit}>
                Annulla
              </Button>
              <Button type="submit" loading={updatePayroll.isPending}>
                Salva
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Modal segna pagato */}
      <Modal opened={paidOpened} onClose={closePaid} title="Segna cedolino come pagato" size="md">
        <Stack gap="md">
          <Text size="sm">
            Il cedolino verrà segnato come pagato per {euro(netAmount)} e verrà registrato il
            movimento contabile di costo.
          </Text>
          <TextInput
            label="Riferimento pagamento"
            placeholder="Es: bonifico CRO 12345"
            value={paymentReference}
            onChange={(event) => setPaymentReference(event.currentTarget.value)}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="light" color="gray" onClick={closePaid}>
              Annulla
            </Button>
            <Button color="green" loading={markPaid.isPending} onClick={handleMarkPaid}>
              Conferma pagamento
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
