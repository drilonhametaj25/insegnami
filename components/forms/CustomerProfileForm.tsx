'use client';

import { TextInput, Textarea, Button, Group, Stack, Grid, Text, Divider } from '@mantine/core';
import { useForm } from '@mantine/form';
import type { CreateCustomerProfileData } from '@/lib/hooks/useInvoices';

/**
 * Form anagrafica fiscale cliente (cessionario/committente) — C2.4.
 * Le regole rispecchiano la validateFiscal del server
 * (POST /api/invoices/customer-profiles):
 *   - almeno uno tra P.IVA e codice fiscale
 *   - denominazione OPPURE nome + cognome
 *   - codiceDestinatario 7 char; con "0000000" serve PEC o codice fiscale
 */

interface CustomerProfileFormValues {
  denominazione: string;
  nome: string;
  cognome: string;
  codiceFiscale: string;
  partitaIva: string;
  pec: string;
  codiceDestinatario: string;
  indirizzo: string;
  cap: string;
  comune: string;
  provincia: string;
  nazione: string;
  email: string;
  telefono: string;
  notes: string;
}

interface CustomerProfileFormProps {
  onSubmit: (data: CreateCustomerProfileData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function CustomerProfileForm({ onSubmit, onCancel, isSubmitting = false }: CustomerProfileFormProps) {
  const form = useForm<CustomerProfileFormValues>({
    initialValues: {
      denominazione: '',
      nome: '',
      cognome: '',
      codiceFiscale: '',
      partitaIva: '',
      pec: '',
      codiceDestinatario: '0000000',
      indirizzo: '',
      cap: '',
      comune: '',
      provincia: '',
      nazione: 'IT',
      email: '',
      telefono: '',
      notes: '',
    },
    validate: {
      denominazione: (v, values) =>
        !v.trim() && !(values.nome.trim() && values.cognome.trim())
          ? 'Inserisci la ragione sociale, oppure nome + cognome'
          : null,
      codiceFiscale: (v, values) =>
        !v.trim() && !values.partitaIva.trim()
          ? 'Almeno uno tra codice fiscale e partita IVA'
          : null,
      partitaIva: (v) => (v.trim() && !/^\d{11}$/.test(v.trim()) ? 'Partita IVA: 11 cifre' : null),
      pec: (v, values) => {
        const pec = v.trim();
        if (pec && !/^\S+@\S+\.\S+$/.test(pec)) return 'PEC non valida';
        if (values.codiceDestinatario.trim() === '0000000' && !pec && !values.codiceFiscale.trim()) {
          return 'Con codice destinatario 0000000 serve la PEC oppure il codice fiscale';
        }
        return null;
      },
      codiceDestinatario: (v) =>
        !/^[A-Z0-9]{7}$/i.test(v.trim()) ? 'Codice destinatario: 7 caratteri alfanumerici' : null,
      indirizzo: (v) => (!v.trim() ? 'Indirizzo richiesto' : null),
      cap: (v) => (!v.trim() ? 'CAP richiesto' : null),
      comune: (v) => (!v.trim() ? 'Comune richiesto' : null),
      provincia: (v) => (v.trim() && v.trim().length !== 2 ? 'Provincia: 2 lettere' : null),
      nazione: (v) => (v.trim().length !== 2 ? 'Nazione: codice 2 lettere' : null),
      email: (v) => (v.trim() && !/^\S+@\S+\.\S+$/.test(v.trim()) ? 'Email non valida' : null),
    },
  });

  const handleSubmit = (values: CustomerProfileFormValues) => {
    onSubmit({
      denominazione: values.denominazione.trim() || undefined,
      nome: values.nome.trim() || undefined,
      cognome: values.cognome.trim() || undefined,
      codiceFiscale: values.codiceFiscale.trim().toUpperCase() || undefined,
      partitaIva: values.partitaIva.trim() || undefined,
      pec: values.pec.trim() || undefined,
      codiceDestinatario: values.codiceDestinatario.trim().toUpperCase(),
      indirizzo: values.indirizzo.trim(),
      cap: values.cap.trim(),
      comune: values.comune.trim(),
      provincia: values.provincia.trim() ? values.provincia.trim().toUpperCase() : undefined,
      nazione: values.nazione.trim().toUpperCase(),
      email: values.email.trim() || undefined,
      telefono: values.telefono.trim() || undefined,
      notes: values.notes.trim() || undefined,
    });
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        <Text fw={600} size="sm" c="dimmed">Identificazione fiscale</Text>

        <TextInput
          label="Denominazione / Ragione sociale"
          placeholder="ACME SRL (per soggetti giuridici)"
          {...form.getInputProps('denominazione')}
        />

        <Grid>
          <Grid.Col span={6}>
            <TextInput label="Nome" placeholder="Mario (per persone fisiche)" {...form.getInputProps('nome')} />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput label="Cognome" placeholder="Rossi" {...form.getInputProps('cognome')} />
          </Grid.Col>
        </Grid>

        <Grid>
          <Grid.Col span={6}>
            <TextInput label="Codice fiscale" placeholder="RSSMRA80A01H501U" {...form.getInputProps('codiceFiscale')} />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput label="Partita IVA" placeholder="01234567897" {...form.getInputProps('partitaIva')} />
          </Grid.Col>
        </Grid>

        <Divider />
        <Text fw={600} size="sm" c="dimmed">Recapito SDI</Text>

        <Grid>
          <Grid.Col span={6}>
            <TextInput
              label="Codice destinatario"
              placeholder="0000000"
              description="7 caratteri; 0000000 = recapito via PEC"
              maxLength={7}
              {...form.getInputProps('codiceDestinatario')}
            />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput label="PEC" placeholder="cliente@pec.it" {...form.getInputProps('pec')} />
          </Grid.Col>
        </Grid>

        <Divider />
        <Text fw={600} size="sm" c="dimmed">Indirizzo</Text>

        <TextInput label="Indirizzo" placeholder="Via Verdi 10" withAsterisk {...form.getInputProps('indirizzo')} />

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
          <Grid.Col span={6}>
            <TextInput label="Email" placeholder="cliente@esempio.it" {...form.getInputProps('email')} />
          </Grid.Col>
          <Grid.Col span={6}>
            <TextInput label="Telefono" placeholder="+39 333 1234567" {...form.getInputProps('telefono')} />
          </Grid.Col>
        </Grid>

        <Textarea label="Note" placeholder="Note interne sull'anagrafica" minRows={2} {...form.getInputProps('notes')} />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onCancel} disabled={isSubmitting}>
            Annulla
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Salva cliente
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
