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

interface Teacher {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  teacherCode?: string;
  hireDate: Date;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  qualifications?: string;
  specializations?: string;
  biography?: string;
  hourlyRate?: number;
  contractType?: string;
}

interface TeacherFormProps {
  opened: boolean;
  onClose: () => void;
  teacher?: Teacher;
  onSave: (teacher: Teacher) => Promise<void>;
  loading?: boolean;
}

export function TeacherForm({
  opened,
  onClose,
  teacher,
  onSave,
  loading = false,
}: TeacherFormProps) {
  const [submitLoading, setSubmitLoading] = useState(false);

  const form = useForm<Teacher>({
    initialValues: {
      firstName: teacher?.firstName || '',
      lastName: teacher?.lastName || '',
      email: teacher?.email || '',
      phone: teacher?.phone || '',
      address: teacher?.address || '',
      hireDate: teacher?.hireDate || new Date(),
      status: teacher?.status || 'ACTIVE',
      qualifications: teacher?.qualifications || '',
      specializations: teacher?.specializations || '',
      biography: teacher?.biography || '',
      hourlyRate: teacher?.hourlyRate || 0,
      contractType: teacher?.contractType || 'Full-time',
    },
    validate: {
      firstName: (value) => (value.length < 2 ? 'Nome troppo corto' : null),
      lastName: (value) => (value.length < 2 ? 'Cognome troppo corto' : null),
      email: (value) => {
        if (!value) return 'Email richiesta';
        if (!/^\S+@\S+$/.test(value)) return 'Email non valida';
        return null;
      },
      hourlyRate: (value) => {
        if (value !== undefined && value < 0) return 'Tariffa non può essere negativa';
        return null;
      },
    },
  });

  const handleSubmit = async (values: Teacher) => {
    setSubmitLoading(true);
    try {
      await onSave(values);
      notifications.show({
        title: 'Successo',
        message: `Docente ${teacher ? 'aggiornato' : 'creato'} con successo`,
        color: 'green',
      });
      form.reset();
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: `Errore durante ${teacher ? 'l\'aggiornamento' : 'la creazione'} del docente`,
        color: 'red',
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={teacher ? 'Modifica Docente' : 'Nuovo Docente'}
      size="xl"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {/* Informazioni Personali */}
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Nome"
                placeholder="Nome del docente"
                required
                {...form.getInputProps('firstName')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Cognome"
                placeholder="Cognome del docente"
                required
                {...form.getInputProps('lastName')}
              />
            </Grid.Col>
          </Grid>

          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Email"
                placeholder="email@esempio.com"
                required
                {...form.getInputProps('email')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Telefono"
                placeholder="Numero di telefono"
                {...form.getInputProps('phone')}
              />
            </Grid.Col>
          </Grid>

          <Textarea
            label="Indirizzo"
            placeholder="Indirizzo completo"
            minRows={2}
            {...form.getInputProps('address')}
          />

          {/* Informazioni Professionali */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Informazioni Professionali
            </h4>
            <Grid>
              <Grid.Col span={6}>
                <DatePickerInput
                  label="Data di Assunzione"
                  placeholder="Seleziona data"
                  required
                  maxDate={new Date()}
                  {...form.getInputProps('hireDate')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="Status"
                  placeholder="Seleziona status"
                  data={[
                    { value: 'ACTIVE', label: 'Attivo' },
                    { value: 'INACTIVE', label: 'Inattivo' },
                    { value: 'SUSPENDED', label: 'Sospeso' },
                  ]}
                  {...form.getInputProps('status')}
                />
              </Grid.Col>
            </Grid>

            <Grid mt="md">
              <Grid.Col span={6}>
                <Select
                  label="Tipo di Contratto"
                  placeholder="Seleziona tipo contratto"
                  data={[
                    { value: 'Full-time', label: 'Tempo Pieno' },
                    { value: 'Part-time', label: 'Tempo Parziale' },
                    { value: 'Contract', label: 'Contratto' },
                    { value: 'Freelance', label: 'Libero Professionista' },
                  ]}
                  {...form.getInputProps('contractType')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <NumberInput
                  label="Tariffa Oraria (€)"
                  placeholder="0.00"
                  min={0}
                  decimalScale={2}
                  fixedDecimalScale
                  {...form.getInputProps('hourlyRate')}
                />
              </Grid.Col>
            </Grid>
          </div>

          {/* Qualifiche e Competenze */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Qualifiche e Competenze
            </h4>
            <Textarea
              label="Qualifiche"
              placeholder="Lauree, certificazioni, corsi di formazione..."
              minRows={2}
              {...form.getInputProps('qualifications')}
            />

            <Textarea
              label="Specializzazioni"
              placeholder="Materie di specializzazione, aree di competenza..."
              minRows={2}
              mt="md"
              {...form.getInputProps('specializations')}
            />

            <Textarea
              label="Biografia"
              placeholder="Breve biografia professionale..."
              minRows={3}
              mt="md"
              {...form.getInputProps('biography')}
            />
          </div>

          <Group justify="flex-end" mt="xl">
            <Button variant="light" onClick={onClose}>
              Annulla
            </Button>
            <Button
              type="submit"
              loading={submitLoading || loading}
              disabled={!form.isValid()}
            >
              {teacher ? 'Aggiorna' : 'Crea'} Docente
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
