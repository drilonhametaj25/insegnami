'use client';

import {
  TextInput,
  Select,
  Switch,
  Button,
  Group,
  Stack,
  Grid,
  Divider,
  Text,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import type { InvoiceSettings, SaveInvoiceSettingsData } from '@/lib/hooks/useInvoices';

/**
 * Form identità fiscale del cedente/prestatore (la scuola) — C2.2.
 * Mappa 1:1 sullo zod di PUT /api/invoices/settings: i campi opzionali
 * vuoti vengono inviati come null, provincia/nazione uppercase.
 */

export const REGIME_FISCALE_OPTIONS = [
  { value: 'RF01', label: 'RF01 — Ordinario' },
  { value: 'RF02', label: 'RF02 — Contribuenti minimi' },
  { value: 'RF04', label: 'RF04 — Agricoltura e attività connesse e pesca' },
  { value: 'RF05', label: 'RF05 — Vendita sali e tabacchi' },
  { value: 'RF06', label: 'RF06 — Commercio fiammiferi' },
  { value: 'RF07', label: 'RF07 — Editoria' },
  { value: 'RF08', label: 'RF08 — Gestione servizi telefonia pubblica' },
  { value: 'RF09', label: 'RF09 — Rivendita documenti di trasporto pubblico' },
  { value: 'RF10', label: 'RF10 — Intrattenimenti e giochi (tariffa)' },
  { value: 'RF11', label: 'RF11 — Agenzie viaggi e turismo' },
  { value: 'RF12', label: 'RF12 — Agriturismo' },
  { value: 'RF13', label: 'RF13 — Vendite a domicilio' },
  { value: 'RF14', label: 'RF14 — Rivendita beni usati, oggetti d\'arte' },
  { value: 'RF15', label: 'RF15 — Agenzie vendite all\'asta di oggetti d\'arte' },
  { value: 'RF16', label: 'RF16 — IVA per cassa P.A.' },
  { value: 'RF17', label: 'RF17 — IVA per cassa' },
  { value: 'RF18', label: 'RF18 — Altro' },
  { value: 'RF19', label: 'RF19 — Regime forfettario' },
];

export const SDI_PROVIDER_OPTIONS = [
  { value: 'file-system', label: 'File system (sviluppo/test)' },
  { value: 'acube', label: 'A-Cube' },
  { value: 'aruba', label: 'Aruba' },
  { value: 'fatture-in-cloud', label: 'Fatture in Cloud' },
];

interface InvoiceSettingsFormValues {
  denominazione: string;
  partitaIva: string;
  codiceFiscale: string;
  regimeFiscale: string;
  iscrizioneREA: string;
  indirizzo: string;
  cap: string;
  comune: string;
  provincia: string;
  nazione: string;
  telefono: string;
  email: string;
  sdiProvider: string;
  conservazioneEnabled: boolean;
}

interface InvoiceSettingsFormProps {
  initialValues?: InvoiceSettings | null;
  onSubmit: (data: SaveInvoiceSettingsData) => void;
  isSubmitting?: boolean;
}

export function InvoiceSettingsForm({ initialValues, onSubmit, isSubmitting = false }: InvoiceSettingsFormProps) {
  const form = useForm<InvoiceSettingsFormValues>({
    initialValues: {
      denominazione: initialValues?.denominazione ?? '',
      partitaIva: initialValues?.partitaIva ?? '',
      codiceFiscale: initialValues?.codiceFiscale ?? '',
      regimeFiscale: initialValues?.regimeFiscale ?? 'RF01',
      iscrizioneREA: initialValues?.iscrizioneREA ?? '',
      indirizzo: initialValues?.indirizzo ?? '',
      cap: initialValues?.cap ?? '',
      comune: initialValues?.comune ?? '',
      provincia: initialValues?.provincia ?? '',
      nazione: initialValues?.nazione ?? 'IT',
      telefono: initialValues?.telefono ?? '',
      email: initialValues?.email ?? '',
      sdiProvider: initialValues?.sdiProvider ?? 'file-system',
      conservazioneEnabled: initialValues?.conservazioneEnabled ?? false,
    },
    validate: {
      denominazione: (v) => (!v.trim() ? 'Denominazione richiesta' : null),
      partitaIva: (v) => (!/^\d{11}$/.test(v.trim()) ? 'Partita IVA: 11 cifre' : null),
      codiceFiscale: (v) => (!v.trim() ? 'Codice fiscale richiesto' : null),
      regimeFiscale: (v) => (!v ? 'Regime fiscale richiesto' : null),
      indirizzo: (v) => (!v.trim() ? 'Indirizzo richiesto' : null),
      cap: (v) => (!v.trim() ? 'CAP richiesto' : null),
      comune: (v) => (!v.trim() ? 'Comune richiesto' : null),
      provincia: (v) => (v.trim() && v.trim().length !== 2 ? 'Provincia: 2 lettere (es. MI)' : null),
      nazione: (v) => (v.trim().length !== 2 ? 'Nazione: codice 2 lettere (es. IT)' : null),
      email: (v) => (v.trim() && !/^\S+@\S+\.\S+$/.test(v.trim()) ? 'Email non valida' : null),
    },
  });

  const handleSubmit = (values: InvoiceSettingsFormValues) => {
    onSubmit({
      denominazione: values.denominazione.trim(),
      partitaIva: values.partitaIva.trim(),
      codiceFiscale: values.codiceFiscale.trim().toUpperCase(),
      regimeFiscale: values.regimeFiscale,
      iscrizioneREA: values.iscrizioneREA.trim() || null,
      indirizzo: values.indirizzo.trim(),
      cap: values.cap.trim(),
      comune: values.comune.trim(),
      provincia: values.provincia.trim() ? values.provincia.trim().toUpperCase() : null,
      nazione: values.nazione.trim().toUpperCase(),
      telefono: values.telefono.trim() || null,
      email: values.email.trim() || null,
      sdiProvider: values.sdiProvider,
      conservazioneEnabled: values.conservazioneEnabled,
    });
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        <Text fw={600} size="sm" c="dimmed">Identità fiscale</Text>

        <TextInput
          label="Denominazione"
          placeholder="Ragione sociale della scuola"
          withAsterisk
          {...form.getInputProps('denominazione')}
        />

        <Grid>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput
              label="Partita IVA"
              placeholder="01234567897"
              withAsterisk
              {...form.getInputProps('partitaIva')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput
              label="Codice fiscale"
              placeholder="Codice fiscale"
              withAsterisk
              {...form.getInputProps('codiceFiscale')}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <TextInput
              label="Iscrizione REA"
              placeholder="es. MI-1234567"
              {...form.getInputProps('iscrizioneREA')}
            />
          </Grid.Col>
        </Grid>

        <Select
          label="Regime fiscale"
          placeholder="Seleziona regime"
          data={REGIME_FISCALE_OPTIONS}
          withAsterisk
          searchable
          {...form.getInputProps('regimeFiscale')}
        />

        <Divider />
        <Text fw={600} size="sm" c="dimmed">Sede legale</Text>

        <TextInput
          label="Indirizzo"
          placeholder="Via Roma 1"
          withAsterisk
          {...form.getInputProps('indirizzo')}
        />

        <Grid>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <TextInput label="CAP" placeholder="20100" withAsterisk {...form.getInputProps('cap')} />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 4 }}>
            <TextInput label="Comune" placeholder="Milano" withAsterisk {...form.getInputProps('comune')} />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 2 }}>
            <TextInput label="Provincia" placeholder="MI" maxLength={2} {...form.getInputProps('provincia')} />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <TextInput label="Nazione" placeholder="IT" maxLength={2} withAsterisk {...form.getInputProps('nazione')} />
          </Grid.Col>
        </Grid>

        <Grid>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput label="Telefono" placeholder="+39 02 1234567" {...form.getInputProps('telefono')} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput label="Email" placeholder="amministrazione@scuola.it" {...form.getInputProps('email')} />
          </Grid.Col>
        </Grid>

        <Divider />
        <Text fw={600} size="sm" c="dimmed">Trasmissione SDI</Text>

        <Select
          label="Provider SDI"
          placeholder="Seleziona provider"
          data={SDI_PROVIDER_OPTIONS}
          withAsterisk
          {...form.getInputProps('sdiProvider')}
        />

        <Switch
          label="Conservazione sostitutiva abilitata"
          {...form.getInputProps('conservazioneEnabled', { type: 'checkbox' })}
        />

        <Group justify="flex-end" mt="md">
          <Button type="submit" loading={isSubmitting}>
            Salva impostazioni
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
