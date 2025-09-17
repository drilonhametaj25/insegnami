'use client';

import { useState } from 'react';
import { useForm } from '@mantine/form';
import {
  Modal,
  TextInput,
  Textarea,
  Select,
  Button,
  Group,
  Stack,
  Grid,
  NumberInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';

interface Payment {
  id?: string;
  studentId: string;
  amount: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'CHECK' | 'OTHER';
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';
  dueDate: Date;
  paidDate?: Date;
  description?: string;
  notes?: string;
  invoiceNumber?: string;
  reference?: string;
  period: string; // es. "Gennaio 2024", "Corso di Inglese Q1 2024"
}

interface PaymentFormProps {
  opened: boolean;
  onClose: () => void;
  payment?: Payment;
  onSave: (payment: Payment) => Promise<void>;
  loading?: boolean;
  students?: Array<{ id: string; name: string }>;
}

export function PaymentForm({
  opened,
  onClose,
  payment,
  onSave,
  loading = false,
  students = [],
}: PaymentFormProps) {
  const [submitLoading, setSubmitLoading] = useState(false);

  const form = useForm<Payment>({
    initialValues: {
      studentId: payment?.studentId || '',
      amount: payment?.amount || 0,
      paymentMethod: payment?.paymentMethod || 'CASH',
      status: payment?.status || 'PENDING',
      dueDate: payment?.dueDate || new Date(),
      paidDate: payment?.paidDate || undefined,
      description: payment?.description || '',
      notes: payment?.notes || '',
      invoiceNumber: payment?.invoiceNumber || '',
      reference: payment?.reference || '',
      period: payment?.period || '',
    },
    validate: {
      studentId: (value) => (!value ? 'Studente richiesto' : null),
      amount: (value) => {
        if (!value || value <= 0) return 'Importo deve essere maggiore di 0';
        return null;
      },
      period: (value) => (value.length < 3 ? 'Periodo troppo corto' : null),
      dueDate: (value) => (!value ? 'Data di scadenza richiesta' : null),
      paidDate: (value, values) => {
        if (values.status === 'PAID' && !value) {
          return 'Data di pagamento richiesta per pagamenti completati';
        }
        if (value && values.dueDate && value < values.dueDate) {
          return 'Data di pagamento non può essere precedente alla scadenza';
        }
        return null;
      },
    },
  });

  const handleSubmit = async (values: Payment) => {
    setSubmitLoading(true);
    try {
      await onSave(values);
      notifications.show({
        title: 'Successo',
        message: `Pagamento ${payment ? 'aggiornato' : 'creato'} con successo`,
        color: 'green',
      });
      form.reset();
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: `Errore durante ${payment ? 'l\'aggiornamento' : 'la creazione'} del pagamento`,
        color: 'red',
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  const studentOptions = students.map((student) => ({
    value: student.id,
    label: student.name,
  }));

  const paymentMethodLabels = {
    CASH: 'Contanti',
    BANK_TRANSFER: 'Bonifico Bancario',
    CREDIT_CARD: 'Carta di Credito',
    CHECK: 'Assegno',
    OTHER: 'Altro',
  };

  const statusLabels = {
    PENDING: 'In Attesa',
    PAID: 'Pagato',
    OVERDUE: 'Scaduto',
    CANCELLED: 'Annullato',
    REFUNDED: 'Rimborsato',
  };

  // Auto-generate invoice number if creating new payment
  if (!payment && !form.values.invoiceNumber) {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    form.setFieldValue('invoiceNumber', `INV-${year}${month}${day}-${random}`);
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={payment ? 'Modifica Pagamento' : 'Nuovo Pagamento'}
      size="lg"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {/* Informazioni Base */}
          <Select
            label="Studente"
            placeholder="Seleziona studente"
            required
            searchable
            data={studentOptions}
            {...form.getInputProps('studentId')}
          />

          <Grid>
            <Grid.Col span={6}>
              <NumberInput
                label="Importo (€)"
                placeholder="0.00"
                required
                min={0}
                decimalScale={2}
                fixedDecimalScale
                {...form.getInputProps('amount')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Periodo"
                placeholder="Es. Gennaio 2024"
                required
                {...form.getInputProps('period')}
              />
            </Grid.Col>
          </Grid>

          <Textarea
            label="Descrizione"
            placeholder="Descrizione del pagamento (es. Retta mensile corso di inglese)"
            minRows={2}
            {...form.getInputProps('description')}
          />

          {/* Date */}
          <Grid>
            <Grid.Col span={6}>
              <DatePickerInput
                label="Data di Scadenza"
                placeholder="Seleziona data"
                required
                {...form.getInputProps('dueDate')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <DatePickerInput
                label="Data di Pagamento"
                placeholder="Seleziona data (se pagato)"
                {...form.getInputProps('paidDate')}
              />
            </Grid.Col>
          </Grid>

          {/* Payment Details */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Dettagli Pagamento
            </h4>
            <Grid>
              <Grid.Col span={6}>
                <Select
                  label="Metodo di Pagamento"
                  placeholder="Seleziona metodo"
                  data={Object.entries(paymentMethodLabels).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  {...form.getInputProps('paymentMethod')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="Status"
                  placeholder="Seleziona status"
                  data={Object.entries(statusLabels).map(([value, label]) => ({
                    value,
                    label,
                  }))}
                  {...form.getInputProps('status')}
                />
              </Grid.Col>
            </Grid>

            <Grid mt="md">
              <Grid.Col span={6}>
                <TextInput
                  label="Numero Fattura"
                  placeholder="INV-20240101-001"
                  {...form.getInputProps('invoiceNumber')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TextInput
                  label="Riferimento"
                  placeholder="Numero transazione, assegno, etc."
                  {...form.getInputProps('reference')}
                />
              </Grid.Col>
            </Grid>
          </div>

          <Textarea
            label="Note"
            placeholder="Note aggiuntive sul pagamento..."
            minRows={2}
            {...form.getInputProps('notes')}
          />

          <Group justify="flex-end" mt="xl">
            <Button variant="light" onClick={onClose}>
              Annulla
            </Button>
            <Button
              type="submit"
              loading={submitLoading || loading}
              disabled={!form.isValid()}
            >
              {payment ? 'Aggiorna' : 'Crea'} Pagamento
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
