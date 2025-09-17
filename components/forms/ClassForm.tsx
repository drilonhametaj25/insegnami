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
  MultiSelect,
} from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';

interface Class {
  id?: string;
  name: string;
  description?: string;
  level: 'BEGINNER' | 'ELEMENTARY' | 'INTERMEDIATE' | 'UPPER_INTERMEDIATE' | 'ADVANCED' | 'PROFICIENCY';
  maxStudents: number;
  room?: string;
  schedule?: string[];
  startTime?: string;
  endTime?: string;
  duration: number; // in minutes
  price?: number;
  isActive: boolean;
  teacherIds?: string[];
}

interface ClassFormProps {
  opened: boolean;
  onClose: () => void;
  classData?: Class;
  onSave: (classData: Class) => Promise<void>;
  loading?: boolean;
  teachers?: Array<{ id: string; name: string }>;
}

export function ClassForm({
  opened,
  onClose,
  classData,
  onSave,
  loading = false,
  teachers = [],
}: ClassFormProps) {
  const [submitLoading, setSubmitLoading] = useState(false);

  const form = useForm<Class>({
    initialValues: {
      name: classData?.name || '',
      description: classData?.description || '',
      level: classData?.level || 'BEGINNER',
      maxStudents: classData?.maxStudents || 15,
      room: classData?.room || '',
      schedule: classData?.schedule || [],
      startTime: classData?.startTime || '09:00',
      endTime: classData?.endTime || '10:30',
      duration: classData?.duration || 90,
      price: classData?.price || 0,
      isActive: classData?.isActive ?? true,
      teacherIds: classData?.teacherIds || [],
    },
    validate: {
      name: (value) => (value.length < 2 ? 'Nome classe troppo corto' : null),
      maxStudents: (value) => {
        if (value < 1) return 'Numero minimo di studenti: 1';
        if (value > 50) return 'Numero massimo di studenti: 50';
        return null;
      },
      duration: (value) => {
        if (value < 30) return 'Durata minima: 30 minuti';
        if (value > 240) return 'Durata massima: 4 ore';
        return null;
      },
      price: (value) => {
        if (value !== undefined && value < 0) return 'Il prezzo non può essere negativo';
        return null;
      },
    },
  });

  const handleSubmit = async (values: Class) => {
    setSubmitLoading(true);
    try {
      await onSave(values);
      notifications.show({
        title: 'Successo',
        message: `Classe ${classData ? 'aggiornata' : 'creata'} con successo`,
        color: 'green',
      });
      form.reset();
      onClose();
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: `Errore durante ${classData ? 'l\'aggiornamento' : 'la creazione'} della classe`,
        color: 'red',
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  const levelLabels = {
    BEGINNER: 'Principiante',
    ELEMENTARY: 'Elementare',
    INTERMEDIATE: 'Intermedio',
    UPPER_INTERMEDIATE: 'Intermedio Superiore',
    ADVANCED: 'Avanzato',
    PROFICIENCY: 'Competenza',
  };

  const scheduleOptions = [
    { value: 'monday', label: 'Lunedì' },
    { value: 'tuesday', label: 'Martedì' },
    { value: 'wednesday', label: 'Mercoledì' },
    { value: 'thursday', label: 'Giovedì' },
    { value: 'friday', label: 'Venerdì' },
    { value: 'saturday', label: 'Sabato' },
    { value: 'sunday', label: 'Domenica' },
  ];

  const teacherOptions = teachers.map((teacher) => ({
    value: teacher.id,
    label: teacher.name,
  }));

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={classData ? 'Modifica Classe' : 'Nuova Classe'}
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
          {/* Informazioni Base */}
          <TextInput
            label="Nome Classe"
            placeholder="Es. Inglese Principianti A1"
            required
            {...form.getInputProps('name')}
          />

          <Textarea
            label="Descrizione"
            placeholder="Descrizione del corso e obiettivi"
            minRows={2}
            {...form.getInputProps('description')}
          />

          <Grid>
            <Grid.Col span={6}>
              <Select
                label="Livello"
                placeholder="Seleziona livello"
                required
                data={Object.entries(levelLabels).map(([value, label]) => ({
                  value,
                  label,
                }))}
                {...form.getInputProps('level')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <NumberInput
                label="Numero Massimo Studenti"
                placeholder="15"
                required
                min={1}
                max={50}
                {...form.getInputProps('maxStudents')}
              />
            </Grid.Col>
          </Grid>

          {/* Orari e Logistica */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Orari e Logistica
            </h4>
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Aula"
                  placeholder="Es. Aula 101"
                  {...form.getInputProps('room')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <NumberInput
                  label="Durata (minuti)"
                  placeholder="90"
                  required
                  min={30}
                  max={240}
                  step={15}
                  {...form.getInputProps('duration')}
                />
              </Grid.Col>
            </Grid>

            <MultiSelect
              label="Giorni della Settimana"
              placeholder="Seleziona giorni"
              data={scheduleOptions}
              mt="md"
              {...form.getInputProps('schedule')}
            />

            <Grid mt="md">
              <Grid.Col span={6}>
                <TimeInput
                  label="Ora Inizio"
                  {...form.getInputProps('startTime')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <TimeInput
                  label="Ora Fine"
                  {...form.getInputProps('endTime')}
                />
              </Grid.Col>
            </Grid>
          </div>

          {/* Docenti e Prezzo */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Docenti e Tariffe
            </h4>
            <MultiSelect
              label="Docenti Assegnati"
              placeholder="Seleziona docenti"
              data={teacherOptions}
              {...form.getInputProps('teacherIds')}
            />

            <NumberInput
              label="Prezzo Mensile (€)"
              placeholder="0.00"
              min={0}
              decimalScale={2}
              fixedDecimalScale
              mt="md"
              {...form.getInputProps('price')}
            />
          </div>

          {/* Status */}
          <Select
            label="Status"
            placeholder="Seleziona status"
            data={[
              { value: 'true', label: 'Attiva' },
              { value: 'false', label: 'Inattiva' },
            ]}
            value={form.values.isActive ? 'true' : 'false'}
            onChange={(value) => form.setFieldValue('isActive', value === 'true')}
          />

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
              {classData ? 'Aggiorna' : 'Crea'} Classe
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
