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
  Switch,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';

interface Student {
  id?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: Date;
  email?: string;
  phone?: string;
  address?: string;
  studentCode?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  emergencyContact?: string;
  medicalNotes?: string;
  specialNeeds?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

interface StudentFormProps {
  opened: boolean;
  onClose: () => void;
  student?: Student;
  onSave: (student: Student) => Promise<void>;
  loading?: boolean;
}

export function StudentForm({
  opened,
  onClose,
  student,
  onSave,
  loading = false,
}: StudentFormProps) {
  const [submitLoading, setSubmitLoading] = useState(false);

  const form = useForm<Student>({
    initialValues: {
      firstName: student?.firstName || '',
      lastName: student?.lastName || '',
      dateOfBirth: student?.dateOfBirth || new Date(),
      email: student?.email || '',
      phone: student?.phone || '',
      address: student?.address || '',
      parentName: student?.parentName || '',
      parentEmail: student?.parentEmail || '',
      parentPhone: student?.parentPhone || '',
      emergencyContact: student?.emergencyContact || '',
      medicalNotes: student?.medicalNotes || '',
      specialNeeds: student?.specialNeeds || '',
      status: student?.status || 'ACTIVE',
    },
    validate: {
      firstName: (value) => (value.length < 2 ? 'Nome troppo corto' : null),
      lastName: (value) => (value.length < 2 ? 'Cognome troppo corto' : null),
      email: (value) => {
        if (value && !/^\S+@\S+$/.test(value)) {
          return 'Email non valida';
        }
        return null;
      },
      parentEmail: (value) => {
        if (value && !/^\S+@\S+$/.test(value)) {
          return 'Email genitore non valida';
        }
        return null;
      },
    },
  });

  const handleSubmit = async (values: Student) => {
    setSubmitLoading(true);
    try {
      await onSave(values);
      notifications.show({
        title: 'Successo',
        message: `Studente ${student ? 'aggiornato' : 'creato'} con successo`,
        color: 'green',
      });
      form.reset();
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: `Errore durante ${student ? 'l\'aggiornamento' : 'la creazione'} dello studente`,
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
      title={student ? 'Modifica Studente' : 'Nuovo Studente'}
      size="xl"
      overlayProps={{
        backgroundOpacity: 0.55,
        blur: 3,
      }}
      styles={{
        content: {
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          borderRadius: '20px',
        },
        header: {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '20px 20px 0 0',
          color: 'white',
          borderBottom: 'none',
        },
        title: {
          color: 'white',
          fontWeight: 600,
        },
        close: {
          color: 'white',
        },
      }}
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {/* Informazioni Personali */}
          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Nome"
                placeholder="Nome dello studente"
                required
                {...form.getInputProps('firstName')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label="Cognome"
                placeholder="Cognome dello studente"
                required
                {...form.getInputProps('lastName')}
              />
            </Grid.Col>
          </Grid>

          <Grid>
            <Grid.Col span={6}>
              <DatePickerInput
                label="Data di Nascita"
                placeholder="Seleziona data"
                required
                maxDate={new Date()}
                {...form.getInputProps('dateOfBirth')}
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

          <Grid>
            <Grid.Col span={6}>
              <TextInput
                label="Email"
                placeholder="email@esempio.com"
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

          {/* Informazioni Genitore/Tutore */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Informazioni Genitore/Tutore
            </h4>
            <Grid>
              <Grid.Col span={4}>
                <TextInput
                  label="Nome Genitore"
                  placeholder="Nome del genitore"
                  {...form.getInputProps('parentName')}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Email Genitore"
                  placeholder="email@genitore.com"
                  {...form.getInputProps('parentEmail')}
                />
              </Grid.Col>
              <Grid.Col span={4}>
                <TextInput
                  label="Telefono Genitore"
                  placeholder="Numero genitore"
                  {...form.getInputProps('parentPhone')}
                />
              </Grid.Col>
            </Grid>

            <TextInput
              label="Contatto di Emergenza"
              placeholder="Nome e numero per emergenze"
              mt="md"
              {...form.getInputProps('emergencyContact')}
            />
          </div>

          {/* Note Mediche e Speciali */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Note Aggiuntive
            </h4>
            <Textarea
              label="Note Mediche"
              placeholder="Allergie, condizioni mediche, farmaci..."
              minRows={2}
              {...form.getInputProps('medicalNotes')}
            />

            <Textarea
              label="Bisogni Speciali"
              placeholder="Esigenze particolari, supporto necessario..."
              minRows={2}
              mt="md"
              {...form.getInputProps('specialNeeds')}
            />
          </div>

          <Group justify="flex-end" mt="xl">
            <Button 
              variant="light" 
              onClick={onClose}
              radius="lg"
            >
              Annulla
            </Button>
            <Button
              type="submit"
              loading={submitLoading || loading}
              disabled={!form.isValid()}
              variant="gradient"
              gradient={{ from: 'indigo', to: 'purple', deg: 45 }}
              radius="lg"
            >
              {student ? 'Aggiorna' : 'Crea'} Studente
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
