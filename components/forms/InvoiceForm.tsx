'use client';

import { useState } from 'react';
import {
  TextInput,
  NumberInput,
  Select,
  Textarea,
  Button,
  Group,
  Stack,
  Grid,
  Paper,
  Text,
  ActionIcon,
  Modal,
  Alert,
  Divider,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { IconPlus, IconTrash, IconUserPlus, IconAlertCircle } from '@tabler/icons-react';
import { computeInvoiceTotals } from '@/lib/billing/invoice-totals';
import { CustomerProfileForm } from '@/components/forms/CustomerProfileForm';
import type {
  CreateInvoiceData,
  CreateCustomerProfileData,
  InvoiceCustomerProfile,
  InvoiceSeries,
} from '@/lib/hooks/useInvoices';

/**
 * Form di creazione fattura (bozza) — C2.4.
 *
 * L'anteprima dei totali usa computeInvoiceTotals (lib/billing/invoice-totals),
 * la STESSA funzione pura usata dal POST /api/invoices: ciò che l'utente vede
 * coincide al centesimo con quanto verrà salvato.
 */

/** Natura esenzione IVA — valori ammessi dallo zod del server: ^N[1-7](\.[0-9])?$ */
export const VAT_NATURE_OPTIONS = [
  { value: 'N1', label: 'N1 — Escluse ex art. 15' },
  { value: 'N2.1', label: 'N2.1 — Non soggette (artt. 7-7septies)' },
  { value: 'N2.2', label: 'N2.2 — Non soggette (altri casi)' },
  { value: 'N3.1', label: 'N3.1 — Non imponibili (esportazioni)' },
  { value: 'N3.2', label: 'N3.2 — Non imponibili (cessioni intra-UE)' },
  { value: 'N3.3', label: 'N3.3 — Non imponibili (San Marino)' },
  { value: 'N3.4', label: 'N3.4 — Non imponibili (assimilate)' },
  { value: 'N3.5', label: 'N3.5 — Non imponibili (lettere d\'intento)' },
  { value: 'N3.6', label: 'N3.6 — Non imponibili (altre operazioni)' },
  { value: 'N4', label: 'N4 — Esenti' },
  { value: 'N5', label: 'N5 — Regime del margine' },
  { value: 'N6.1', label: 'N6.1 — Inversione contabile (rottami)' },
  { value: 'N6.2', label: 'N6.2 — Inversione contabile (oro/argento)' },
  { value: 'N7', label: 'N7 — IVA assolta in altro stato UE' },
];

export const PAYMENT_METHOD_OPTIONS = [
  { value: 'MP01', label: 'MP01 — Contanti' },
  { value: 'MP02', label: 'MP02 — Assegno' },
  { value: 'MP05', label: 'MP05 — Bonifico' },
  { value: 'MP08', label: 'MP08 — Carta di pagamento' },
  { value: 'MP16', label: 'MP16 — Domiciliazione bancaria' },
  { value: 'MP19', label: 'MP19 — SEPA Direct Debit' },
];

interface InvoiceLineFormValues {
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  vatRate: number | string;
  vatNature: string | null;
  discountPercent: number | string;
}

interface InvoiceFormValues {
  seriesId: string;
  customerProfileId: string;
  paymentMethod: string | null;
  notes: string;
  lines: InvoiceLineFormValues[];
}

interface InvoiceFormProps {
  series: InvoiceSeries[];
  profiles: InvoiceCustomerProfile[];
  onSubmit: (data: CreateInvoiceData) => void;
  /** Creazione inline dell'anagrafica cliente: deve risolvere col profilo creato. */
  onCreateProfile: (data: CreateCustomerProfileData) => Promise<InvoiceCustomerProfile>;
  isSubmitting?: boolean;
  isCreatingProfile?: boolean;
}

const emptyLine = (): InvoiceLineFormValues => ({
  description: '',
  quantity: 1,
  unitPrice: 0,
  vatRate: 22,
  vatNature: null,
  discountPercent: '',
});

export function customerProfileLabel(p: InvoiceCustomerProfile): string {
  const name = p.denominazione || [p.nome, p.cognome].filter(Boolean).join(' ');
  const fiscal = p.partitaIva || p.codiceFiscale;
  return fiscal ? `${name} (${fiscal})` : name;
}

/** Formatta un importo come valuta €. */
function euro(value: number): string {
  return `€${value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function InvoiceForm({
  series,
  profiles,
  onSubmit,
  onCreateProfile,
  isSubmitting = false,
  isCreatingProfile = false,
}: InvoiceFormProps) {
  const activeSeries = series.filter((s) => s.isActive);
  const defaultSeries = activeSeries.find((s) => s.isDefault) ?? activeSeries[0];

  const [profileModalOpened, { open: openProfileModal, close: closeProfileModal }] = useDisclosure(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const form = useForm<InvoiceFormValues>({
    initialValues: {
      seriesId: defaultSeries?.id ?? '',
      customerProfileId: '',
      paymentMethod: null,
      notes: '',
      lines: [emptyLine()],
    },
    validate: {
      seriesId: (v) => (!v ? 'Seleziona un sezionale' : null),
      customerProfileId: (v) => (!v ? 'Seleziona un cliente' : null),
      lines: {
        description: (v) => (!String(v).trim() ? 'Descrizione richiesta' : null),
        quantity: (v) => (Number(v) > 0 ? null : 'Quantità maggiore di 0'),
        unitPrice: (v) => (Number(v) > 0 ? null : 'Prezzo maggiore di 0'),
        vatRate: (v) => {
          const n = Number(v);
          return n >= 0 && n <= 100 ? null : 'IVA tra 0 e 100';
        },
        vatNature: (value, values, path) => {
          const idx = Number(String(path).split('.')[1]);
          const line = (values as InvoiceFormValues).lines[idx];
          if (line && Number(line.vatRate) === 0 && !value) {
            return 'Natura esenzione obbligatoria con IVA 0%';
          }
          return null;
        },
        discountPercent: (v) => {
          if (v === '' || v === undefined || v === null) return null;
          const n = Number(v);
          return n >= 0 && n <= 100 ? null : 'Sconto tra 0 e 100';
        },
      },
    },
  });

  // Anteprima totali: stessa funzione pura usata dal server.
  const totals = computeInvoiceTotals(
    form.values.lines.map((l) => ({
      quantity: Number(l.quantity) || 0,
      unitPrice: Number(l.unitPrice) || 0,
      vatRate: Number(l.vatRate) || 0,
      discountPercent: l.discountPercent === '' ? undefined : Number(l.discountPercent) || 0,
    })),
  );

  const handleSubmit = (values: InvoiceFormValues) => {
    onSubmit({
      seriesId: values.seriesId,
      customerProfileId: values.customerProfileId,
      paymentMethod: values.paymentMethod || undefined,
      notes: values.notes.trim() || undefined,
      lines: values.lines.map((l) => ({
        description: l.description.trim(),
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        vatRate: Number(l.vatRate),
        vatNature: l.vatNature || undefined,
        discountPercent:
          l.discountPercent !== '' && Number(l.discountPercent) > 0
            ? Number(l.discountPercent)
            : undefined,
      })),
    });
  };

  const handleCreateProfile = async (data: CreateCustomerProfileData) => {
    setProfileError(null);
    try {
      const profile = await onCreateProfile(data);
      form.setFieldValue('customerProfileId', profile.id);
      closeProfileModal();
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Errore nella creazione del cliente');
    }
  };

  return (
    <>
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Grid align="flex-end">
            <Grid.Col span={{ base: 12, sm: 4 }}>
              <Select
                label="Sezionale"
                placeholder="Seleziona sezionale"
                data={activeSeries.map((s) => ({
                  value: s.id,
                  label: s.prefix ? `${s.code} (${s.prefix})` : s.code,
                }))}
                withAsterisk
                {...form.getInputProps('seriesId')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 5 }}>
              <Select
                label="Cliente"
                placeholder="Seleziona cliente"
                data={profiles.map((p) => ({ value: p.id, label: customerProfileLabel(p) }))}
                searchable
                withAsterisk
                {...form.getInputProps('customerProfileId')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 3 }}>
              <Button
                variant="light"
                fullWidth
                leftSection={<IconUserPlus size={16} />}
                onClick={() => {
                  setProfileError(null);
                  openProfileModal();
                }}
              >
                Nuovo cliente
              </Button>
            </Grid.Col>
          </Grid>

          <Divider label="Righe fattura" labelPosition="left" />

          {form.values.lines.map((_, index) => (
            <Paper key={index} p="sm" radius="md" withBorder>
              <Grid align="flex-end">
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <TextInput
                    label="Descrizione"
                    placeholder="Es. Quota corso inglese B1"
                    withAsterisk
                    {...form.getInputProps(`lines.${index}.description`)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 4, md: 1.5 }}>
                  <NumberInput
                    label="Quantità"
                    min={0}
                    step={1}
                    decimalScale={2}
                    {...form.getInputProps(`lines.${index}.quantity`)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 4, md: 2 }}>
                  <NumberInput
                    label="Prezzo unitario"
                    min={0}
                    step={0.01}
                    decimalScale={4}
                    prefix="€ "
                    {...form.getInputProps(`lines.${index}.unitPrice`)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 4, md: 1.5 }}>
                  <NumberInput
                    label="Sconto %"
                    min={0}
                    max={100}
                    step={1}
                    decimalScale={2}
                    {...form.getInputProps(`lines.${index}.discountPercent`)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 4, md: 1.5 }}>
                  <NumberInput
                    label="IVA %"
                    min={0}
                    max={100}
                    step={1}
                    decimalScale={2}
                    {...form.getInputProps(`lines.${index}.vatRate`)}
                  />
                </Grid.Col>
                <Grid.Col span={{ base: 6, md: 1 }}>
                  <Group justify="flex-end">
                    <ActionIcon
                      variant="light"
                      color="red"
                      size="lg"
                      title="Rimuovi riga"
                      disabled={form.values.lines.length <= 1}
                      onClick={() => form.removeListItem('lines', index)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Grid.Col>
                {Number(form.values.lines[index]?.vatRate) === 0 && (
                  <Grid.Col span={{ base: 12, md: 5 }}>
                    <Select
                      label="Natura esenzione"
                      placeholder="Obbligatoria con IVA 0%"
                      data={VAT_NATURE_OPTIONS}
                      clearable
                      {...form.getInputProps(`lines.${index}.vatNature`)}
                    />
                  </Grid.Col>
                )}
              </Grid>
            </Paper>
          ))}

          <Group>
            <Button
              variant="light"
              leftSection={<IconPlus size={16} />}
              onClick={() => form.insertListItem('lines', emptyLine())}
            >
              Aggiungi riga
            </Button>
          </Group>

          <Paper p="md" radius="md" withBorder data-testid="invoice-totals">
            <Stack gap={4}>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">Imponibile</Text>
                <Text size="sm" fw={500} data-testid="totals-subtotal">{euro(totals.subtotal)}</Text>
              </Group>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">IVA</Text>
                <Text size="sm" fw={500} data-testid="totals-vat">{euro(totals.vatTotal)}</Text>
              </Group>
              <Divider my={4} />
              <Group justify="space-between">
                <Text fw={700}>Totale</Text>
                <Text fw={700} data-testid="totals-total">{euro(totals.total)}</Text>
              </Group>
            </Stack>
          </Paper>

          <Grid>
            <Grid.Col span={{ base: 12, sm: 5 }}>
              <Select
                label="Metodo di pagamento"
                placeholder="Opzionale"
                data={PAYMENT_METHOD_OPTIONS}
                clearable
                {...form.getInputProps('paymentMethod')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 7 }}>
              <Textarea label="Note" placeholder="Note in fattura (opzionali)" minRows={1} {...form.getInputProps('notes')} />
            </Grid.Col>
          </Grid>

          <Group justify="flex-end" mt="md">
            <Button type="submit" loading={isSubmitting}>
              Crea fattura
            </Button>
          </Group>
        </Stack>
      </form>

      <Modal opened={profileModalOpened} onClose={closeProfileModal} title="Nuova anagrafica cliente" size="lg">
        <Stack gap="md">
          {profileError && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
              {profileError}
            </Alert>
          )}
          <CustomerProfileForm
            onSubmit={handleCreateProfile}
            onCancel={closeProfileModal}
            isSubmitting={isCreatingProfile}
          />
        </Stack>
      </Modal>
    </>
  );
}
