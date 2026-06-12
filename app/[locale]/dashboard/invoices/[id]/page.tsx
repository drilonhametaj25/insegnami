'use client';

import { useParams, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  Container,
  Title,
  Paper,
  Button,
  Group,
  Stack,
  Modal,
  Select,
  NumberInput,
  Textarea,
  TextInput,
  Badge,
  Table,
  ActionIcon,
  Text,
  Grid,
  Card,
  Alert,
  Skeleton,
  Timeline,
  Anchor,
  Divider,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconEdit,
  IconTrash,
  IconSend,
  IconFileTypePdf,
  IconFileTypeXml,
  IconFileMinus,
  IconAlertTriangle,
  IconCircleCheck,
  IconMailExclamation,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import {
  useInvoice,
  useInvoiceSeries,
  useIssueInvoice,
  useDeleteInvoice,
  useTransmitInvoice,
  useCreateCreditNote,
  useUpdateInvoice,
  type Invoice,
  type InvoiceCustomerProfile,
} from '@/lib/hooks/useInvoices';

/**
 * Campi presenti nella risposta del GET /api/invoices/[id] ma non (ancora)
 * tipizzati nell'interfaccia Invoice del hook (fuori perimetro C2).
 * sdiStatus è allargato a string: l'unione del hook non include i valori
 * reali dell'enum prisma SdiTransmissionStatus (es. PENDING).
 */
type InvoiceDetail = Omit<Invoice, 'sdiStatus'> & {
  sdiStatus: string;
  xmlContent?: string | null;
  sdiRejectedReason?: string | null;
};

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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Bozza', color: 'gray' },
  ISSUED: { label: 'Emessa', color: 'blue' },
  SENT: { label: 'Inviata a SDI', color: 'indigo' },
  ACCEPTED: { label: 'Accettata', color: 'green' },
  REJECTED: { label: 'Scartata', color: 'red' },
  PAID: { label: 'Pagata', color: 'teal' },
  CANCELLED: { label: 'Annullata', color: 'gray' },
};

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

const SDI_EVENT_LABELS: Record<string, string> = {
  NS: 'Notifica di scarto',
  RC: 'Ricevuta di consegna',
  MC: 'Mancata consegna',
  NE: 'Notifica esito',
  MT: 'Metadati file fattura',
  EC: 'Esito cessionario',
  DT: 'Decorrenza termini',
  AT: 'Avvenuta trasmissione',
};

const PAYMENT_METHOD_OPTIONS = [
  { value: 'MP01', label: 'MP01 — Contanti' },
  { value: 'MP02', label: 'MP02 — Assegno' },
  { value: 'MP05', label: 'MP05 — Bonifico' },
  { value: 'MP08', label: 'MP08 — Carta di pagamento' },
  { value: 'MP16', label: 'MP16 — Domiciliazione bancaria' },
  { value: 'MP19', label: 'MP19 — SEPA Direct Debit' },
];

interface SdiEventRow {
  id: string;
  eventType?: string;
  type?: string;
  receivedAt: string;
  errorCode?: string | null;
  errorMessage?: string | null;
}

export default function InvoiceDetailPage() {
  const router = useRouter();
  const locale = useLocale();
  const params = useParams();
  const id = (params?.id as string) ?? '';

  const { data, isLoading, error } = useInvoice(id);
  const { data: seriesData } = useInvoiceSeries();

  const issueInvoice = useIssueInvoice();
  const deleteInvoice = useDeleteInvoice();
  const transmitInvoice = useTransmitInvoice();
  const createCreditNote = useCreateCreditNote();
  const updateInvoice = useUpdateInvoice();

  const [editOpened, { open: openEdit, close: closeEdit }] = useDisclosure(false);
  const [ncOpened, { open: openNc, close: closeNc }] = useDisclosure(false);

  const invoice = data?.invoice as InvoiceDetail | undefined;
  const series = (seriesData?.series ?? []).filter((s) => s.isActive);

  const editForm = useForm<{ paymentMethod: string | null; notes: string }>({
    initialValues: { paymentMethod: null, notes: '' },
  });

  const ncForm = useForm<{ reason: string; seriesId: string; partialAmount: number | string; notes: string }>({
    initialValues: { reason: '', seriesId: '', partialAmount: '', notes: '' },
    validate: {
      reason: (v) => (v.trim().length < 3 ? 'Motivazione richiesta (min 3 caratteri)' : null),
      seriesId: (v) => (!v ? 'Seleziona un sezionale' : null),
      partialAmount: (v) => {
        if (v === '' || v === undefined || v === null) return null;
        return Number(v) > 0 ? null : 'Importo maggiore di 0';
      },
    },
  });

  if (isLoading) {
    return (
      <Container size="xl" py="md">
        <Stack gap="md">
          <Skeleton height={40} w={400} />
          <Skeleton height={160} />
          <Skeleton height={240} />
        </Stack>
      </Container>
    );
  }

  if (error || !invoice) {
    return (
      <Container size="xl" py="md">
        <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light" title="Fattura non trovata">
          <Group mt="sm">
            <Button size="xs" variant="light" onClick={() => router.push(`/${locale}/dashboard/invoices`)}>
              Torna alle fatture
            </Button>
          </Group>
        </Alert>
      </Container>
    );
  }

  const status = STATUS_LABELS[invoice.status] ?? { label: invoice.status, color: 'gray' };
  const sdi = SDI_STATUS_LABELS[invoice.sdiStatus] ?? { label: invoice.sdiStatus, color: 'gray' };
  const seriesPrefix = (invoice.series as { prefix?: string | null } | undefined)?.prefix;
  const seriesCode = (invoice.series as { code?: string } | undefined)?.code;
  const customer = invoice.customerProfile;
  const lines = invoice.lines ?? [];
  const sdiEvents = (invoice.sdiEvents ?? []) as SdiEventRow[];
  const isDraft = invoice.status === 'DRAFT';
  const isCreditNote = invoice.documentType === 'TD04';

  // Avviso recapito: codice destinatario "0000000" senza PEC né email cliente
  const recapitoIncompleto =
    !!customer &&
    customer.codiceDestinatario === '0000000' &&
    !customer.pec &&
    !customer.email;

  const canTransmit =
    !isDraft &&
    invoice.status !== 'CANCELLED' &&
    invoice.sdiStatus !== 'TRANSMITTED' &&
    invoice.sdiStatus !== 'ACCEPTED';

  const handleIssue = () => {
    issueInvoice.mutate(invoice.id, {
      onSuccess: (res) => {
        notifications.show({
          title: 'Fattura emessa',
          message: `Numero assegnato: ${formatNumber(
            (res.invoice.series as { prefix?: string | null } | undefined)?.prefix,
            res.invoice.year,
            res.invoice.number,
          )}`,
          color: 'green',
        });
      },
      onError: (err) => {
        notifications.show({ title: 'Errore', message: err.message, color: 'red' });
      },
    });
  };

  const handleDelete = () => {
    if (!confirm('Eliminare definitivamente questa bozza?')) return;
    deleteInvoice.mutate(invoice.id, {
      onSuccess: () => {
        notifications.show({ title: 'Bozza eliminata', message: 'La bozza è stata eliminata', color: 'green' });
        router.push(`/${locale}/dashboard/invoices`);
      },
      onError: (err) => {
        notifications.show({ title: 'Errore', message: err.message, color: 'red' });
      },
    });
  };

  const handleTransmit = () => {
    transmitInvoice.mutate(invoice.id, {
      onSuccess: () => {
        notifications.show({
          title: 'Trasmessa',
          message: 'Fattura inviata al provider SDI',
          color: 'green',
        });
      },
      onError: (err) => {
        notifications.show({ title: 'Errore trasmissione', message: err.message, color: 'red' });
      },
    });
  };

  const handleOpenEdit = () => {
    editForm.setValues({
      paymentMethod: invoice.paymentMethod ?? null,
      notes: invoice.notes ?? '',
    });
    openEdit();
  };

  const handleEditSubmit = (values: { paymentMethod: string | null; notes: string }) => {
    updateInvoice.mutate(
      {
        id: invoice.id,
        data: {
          paymentMethod: values.paymentMethod || undefined,
          notes: values.notes.trim() || null,
        },
      },
      {
        onSuccess: () => {
          notifications.show({ title: 'Successo', message: 'Bozza aggiornata', color: 'green' });
          closeEdit();
        },
        onError: (err) => {
          notifications.show({ title: 'Errore', message: err.message, color: 'red' });
        },
      },
    );
  };

  const handleOpenNc = () => {
    ncForm.setValues({
      reason: '',
      seriesId: invoice.seriesId,
      partialAmount: '',
      notes: '',
    });
    openNc();
  };

  const handleNcSubmit = (values: { reason: string; seriesId: string; partialAmount: number | string; notes: string }) => {
    createCreditNote.mutate(
      {
        id: invoice.id,
        data: {
          reason: values.reason.trim(),
          seriesId: values.seriesId,
          partialAmount: values.partialAmount !== '' ? Number(values.partialAmount) : undefined,
          notes: values.notes.trim() || undefined,
        },
      },
      {
        onSuccess: (res) => {
          notifications.show({
            title: 'Nota di credito creata',
            message: 'Bozza TD04 collegata alla fattura originale',
            color: 'green',
          });
          closeNc();
          router.push(`/${locale}/dashboard/invoices/${res.creditNote.id}`);
        },
        onError: (err) => {
          notifications.show({ title: 'Errore', message: err.message, color: 'red' });
        },
      },
    );
  };

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Group justify="space-between">
          <Group>
            <ActionIcon
              variant="light"
              size="lg"
              title="Torna alle fatture"
              onClick={() => router.push(`/${locale}/dashboard/invoices`)}
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
            <Title order={2}>
              {invoice.number > 0
                ? `${DOC_TYPE_LABELS[invoice.documentType] ?? invoice.documentType} ${formatNumber(seriesPrefix, invoice.year, invoice.number)}`
                : `Bozza ${(DOC_TYPE_LABELS[invoice.documentType] ?? 'fattura').toLowerCase()}`}
            </Title>
            <Badge color={status.color} variant="light" size="lg">
              {status.label}
            </Badge>
            <Badge color={sdi.color} variant="outline" size="lg">
              {sdi.label}
            </Badge>
          </Group>

          <Group>
            {isDraft && (
              <>
                <Button
                  leftSection={<IconCircleCheck size={16} />}
                  color="green"
                  onClick={handleIssue}
                  loading={issueInvoice.isPending}
                >
                  Emetti
                </Button>
                <Button variant="light" leftSection={<IconEdit size={16} />} onClick={handleOpenEdit}>
                  Modifica
                </Button>
                <Button
                  variant="light"
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  onClick={handleDelete}
                  loading={deleteInvoice.isPending}
                >
                  Elimina
                </Button>
              </>
            )}

            {!isDraft && (
              <>
                {canTransmit && (
                  <Button
                    leftSection={<IconSend size={16} />}
                    onClick={handleTransmit}
                    loading={transmitInvoice.isPending}
                  >
                    Trasmetti a SDI
                  </Button>
                )}
                <Button
                  variant="light"
                  leftSection={<IconFileTypePdf size={16} />}
                  component="a"
                  href={`/api/invoices/${invoice.id}/pdf`}
                  target="_blank"
                >
                  PDF
                </Button>
                <Button
                  variant="light"
                  leftSection={<IconFileTypeXml size={16} />}
                  component="a"
                  href={`/api/invoices/${invoice.id}/xml`}
                  target="_blank"
                  disabled={!invoice.xmlContent && invoice.sdiStatus === 'PENDING'}
                >
                  XML
                </Button>
                {!isCreditNote && invoice.status !== 'CANCELLED' && (
                  <Button
                    variant="light"
                    color="orange"
                    leftSection={<IconFileMinus size={16} />}
                    onClick={handleOpenNc}
                  >
                    Nota di credito
                  </Button>
                )}
              </>
            )}
          </Group>
        </Group>

        {invoice.sdiStatus === 'REJECTED' && (
          <Alert
            icon={<IconAlertTriangle size={16} />}
            color="red"
            variant="filled"
            title="Fattura scartata dal SDI"
          >
            {invoice.sdiRejectedReason || 'Motivo non disponibile — controlla gli eventi SDI qui sotto.'}
          </Alert>
        )}

        {recapitoIncompleto && (
          <Alert
            icon={<IconMailExclamation size={16} />}
            color="yellow"
            variant="light"
            title="Recapito cliente incompleto"
          >
            Il cliente ha codice destinatario 0000000 ma nessuna PEC né email: la copia di
            cortesia non potrà essere recapitata. Aggiorna l&apos;anagrafica cliente.
          </Alert>
        )}

        <Grid>
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card padding="lg" radius="md" withBorder h="100%">
              <Stack gap={6}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Cliente</Text>
                <Text fw={600}>{customerName(customer)}</Text>
                {(customer?.partitaIva || customer?.codiceFiscale) && (
                  <Text size="sm" c="dimmed">
                    {customer?.partitaIva ? `P.IVA ${customer.partitaIva}` : `CF ${customer?.codiceFiscale}`}
                  </Text>
                )}
                {customer?.email && <Text size="sm">{customer.email}</Text>}
                {customer?.pec && <Text size="sm">PEC: {customer.pec}</Text>}
                {customer && (
                  <Text size="sm" c="dimmed">
                    {[customer.indirizzo, customer.cap, customer.comune, customer.provincia]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                )}
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card padding="lg" radius="md" withBorder h="100%">
              <Stack gap={6}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Documento</Text>
                <Text size="sm">Tipo: {DOC_TYPE_LABELS[invoice.documentType] ?? invoice.documentType} ({invoice.documentType})</Text>
                <Text size="sm">Sezionale: {seriesCode ?? '—'}</Text>
                <Text size="sm">Anno: {invoice.year}</Text>
                <Text size="sm">Data emissione: {dayjs(invoice.issueDate).format('DD/MM/YYYY')}</Text>
                {invoice.relatedInvoice && (
                  <Text size="sm">
                    Storno di:{' '}
                    <Anchor
                      size="sm"
                      onClick={() => router.push(`/${locale}/dashboard/invoices/${invoice.relatedInvoice!.id}`)}
                    >
                      {invoice.relatedInvoice.year}/{String(invoice.relatedInvoice.number).padStart(4, '0')}
                    </Anchor>
                  </Text>
                )}
              </Stack>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card padding="lg" radius="md" withBorder h="100%">
              <Stack gap={6}>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Totali</Text>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Imponibile</Text>
                  <Text size="sm" fw={500}>{euro(invoice.subtotal)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">IVA</Text>
                  <Text size="sm" fw={500}>{euro(invoice.vatTotal)}</Text>
                </Group>
                <Divider my={4} />
                <Group justify="space-between">
                  <Text fw={700}>Totale</Text>
                  <Text fw={700} size="lg">{euro(invoice.total)}</Text>
                </Group>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>

        <Paper p="lg" radius="md" withBorder>
          <Title order={4} mb="md">Righe</Title>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>#</Table.Th>
                <Table.Th>Descrizione</Table.Th>
                <Table.Th>Qtà</Table.Th>
                <Table.Th>Prezzo</Table.Th>
                <Table.Th>Sconto %</Table.Th>
                <Table.Th>IVA</Table.Th>
                <Table.Th>Totale</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lines.map((line) => (
                <Table.Tr key={line.id}>
                  <Table.Td>{line.lineNumber}</Table.Td>
                  <Table.Td>{line.description}</Table.Td>
                  <Table.Td>{Number(line.quantity)}</Table.Td>
                  <Table.Td>{euro(line.unitPrice)}</Table.Td>
                  <Table.Td>{line.discountPercent ? `${Number(line.discountPercent)}%` : '—'}</Table.Td>
                  <Table.Td>
                    {Number(line.vatRate)}%
                    {line.vatNature ? ` (${line.vatNature})` : ''}
                  </Table.Td>
                  <Table.Td style={{ fontWeight: 500 }}>{euro(line.total)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>

        {(invoice.creditNotes?.length ?? 0) > 0 && (
          <Paper p="lg" radius="md" withBorder>
            <Title order={4} mb="md">Note di credito collegate</Title>
            <Stack gap="xs">
              {invoice.creditNotes!.map((nc) => (
                <Group key={nc.id} gap="xs">
                  <Anchor size="sm" onClick={() => router.push(`/${locale}/dashboard/invoices/${nc.id}`)}>
                    {nc.number > 0 ? `${nc.year}/${String(nc.number).padStart(4, '0')}` : 'Bozza'}
                  </Anchor>
                  <Badge size="sm" variant="light" color={STATUS_LABELS[nc.status]?.color ?? 'gray'}>
                    {STATUS_LABELS[nc.status]?.label ?? nc.status}
                  </Badge>
                </Group>
              ))}
            </Stack>
          </Paper>
        )}

        {invoice.notes && (
          <Paper p="lg" radius="md" withBorder>
            <Title order={4} mb="sm">Note</Title>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{invoice.notes}</Text>
          </Paper>
        )}

        <Paper p="lg" radius="md" withBorder>
          <Title order={4} mb="md">Eventi SDI</Title>
          {sdiEvents.length === 0 ? (
            <Text c="dimmed" size="sm">Nessun evento SDI ricevuto</Text>
          ) : (
            <Timeline active={sdiEvents.length} bulletSize={20} lineWidth={2}>
              {sdiEvents.map((event) => {
                const type = event.eventType ?? event.type ?? '?';
                return (
                  <Timeline.Item
                    key={event.id}
                    title={`${SDI_EVENT_LABELS[type] ?? type} (${type})`}
                    color={type === 'NS' || type === 'MC' ? 'red' : 'blue'}
                  >
                    <Text size="xs" c="dimmed">
                      {dayjs(event.receivedAt).format('DD/MM/YYYY HH:mm')}
                    </Text>
                    {event.errorMessage && (
                      <Text size="sm" c="red">
                        {event.errorCode ? `[${event.errorCode}] ` : ''}{event.errorMessage}
                      </Text>
                    )}
                  </Timeline.Item>
                );
              })}
            </Timeline>
          )}
        </Paper>
      </Stack>

      {/* Modifica bozza (solo campi consentiti dal PATCH) */}
      <Modal opened={editOpened} onClose={closeEdit} title="Modifica bozza">
        <form onSubmit={editForm.onSubmit(handleEditSubmit)}>
          <Stack gap="md">
            <Select
              label="Metodo di pagamento"
              placeholder="Opzionale"
              data={PAYMENT_METHOD_OPTIONS}
              clearable
              {...editForm.getInputProps('paymentMethod')}
            />
            <Textarea label="Note" minRows={3} {...editForm.getInputProps('notes')} />
            <Group justify="flex-end">
              <Button variant="default" onClick={closeEdit}>
                Annulla
              </Button>
              <Button type="submit" loading={updateInvoice.isPending}>
                Salva
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Nota di credito */}
      <Modal opened={ncOpened} onClose={closeNc} title="Nuova nota di credito (TD04)">
        <form onSubmit={ncForm.onSubmit(handleNcSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Motivazione"
              placeholder="Es. storno per annullamento iscrizione"
              withAsterisk
              {...ncForm.getInputProps('reason')}
            />
            <Select
              label="Sezionale"
              placeholder="Seleziona sezionale"
              data={series.map((s) => ({ value: s.id, label: s.prefix ? `${s.code} (${s.prefix})` : s.code }))}
              withAsterisk
              {...ncForm.getInputProps('seriesId')}
            />
            <NumberInput
              label="Importo parziale"
              description={`Lascia vuoto per stornare l'intera fattura (${euro(invoice.total)})`}
              min={0.01}
              max={Number(invoice.total)}
              step={0.01}
              decimalScale={2}
              prefix="€ "
              {...ncForm.getInputProps('partialAmount')}
            />
            <Textarea label="Note" minRows={2} {...ncForm.getInputProps('notes')} />
            <Group justify="flex-end">
              <Button variant="default" onClick={closeNc}>
                Annulla
              </Button>
              <Button type="submit" color="orange" loading={createCreditNote.isPending}>
                Crea nota di credito
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
}
