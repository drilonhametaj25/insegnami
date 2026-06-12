'use client';

import { TextInput, Switch, Button, Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import type { CreateInvoiceSeriesData } from '@/lib/hooks/useInvoices';

/**
 * Form di creazione sezionale di numerazione (C2.2).
 * Mappa sullo zod di POST /api/invoices/series: code obbligatorio
 * (maiuscole/numeri/_/-), prefix e description opzionali, isDefault.
 */

interface InvoiceSeriesFormValues {
  code: string;
  prefix: string;
  description: string;
  isDefault: boolean;
}

interface InvoiceSeriesFormProps {
  onSubmit: (data: CreateInvoiceSeriesData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function InvoiceSeriesForm({ onSubmit, onCancel, isSubmitting = false }: InvoiceSeriesFormProps) {
  const form = useForm<InvoiceSeriesFormValues>({
    initialValues: {
      code: '',
      prefix: '',
      description: '',
      isDefault: false,
    },
    validate: {
      code: (v) => {
        const value = v.trim().toUpperCase();
        if (!value) return 'Codice richiesto';
        if (!/^[A-Z0-9_-]+$/.test(value)) return 'Solo lettere maiuscole, numeri, _ e -';
        if (value.length > 20) return 'Massimo 20 caratteri';
        return null;
      },
      prefix: (v) => (v.trim().length > 10 ? 'Massimo 10 caratteri' : null),
      description: (v) => (v.trim().length > 200 ? 'Massimo 200 caratteri' : null),
    },
  });

  const handleSubmit = (values: InvoiceSeriesFormValues) => {
    onSubmit({
      code: values.code.trim().toUpperCase(),
      prefix: values.prefix.trim() || undefined,
      description: values.description.trim() || undefined,
      isDefault: values.isDefault,
    });
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        <TextInput
          label="Codice"
          placeholder="VEN"
          description="Identificativo del sezionale (es. VEN, NC, PARC)"
          withAsterisk
          {...form.getInputProps('code')}
          onChange={(e) => form.setFieldValue('code', e.currentTarget.value.toUpperCase())}
        />

        <TextInput
          label="Prefisso"
          placeholder="F"
          description="Prefisso nel numero fattura (es. F → F/2026/0001)"
          {...form.getInputProps('prefix')}
        />

        <TextInput
          label="Descrizione"
          placeholder="Fatture di vendita"
          {...form.getInputProps('description')}
        />

        <Switch
          label="Sezionale di default"
          description="Usato come preselezione per le nuove fatture"
          {...form.getInputProps('isDefault', { type: 'checkbox' })}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onCancel} disabled={isSubmitting}>
            Annulla
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Crea sezionale
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
