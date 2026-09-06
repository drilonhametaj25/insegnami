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
import { DateInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';

// La verità dell'orario vive su Schedule/Lesson: il form gestisce solo i
// dettagli operativi della classe (description/level/room/monthlyPrice).
interface Class {
  id?: string;
  name: string;
  description?: string;
  level?: 'BEGINNER' | 'ELEMENTARY' | 'INTERMEDIATE' | 'UPPER_INTERMEDIATE' | 'ADVANCED' | 'PROFICIENCY';
  maxStudents: number;
  room?: string;
  monthlyPrice?: number;
  isActive: boolean;
  teacherIds?: string[];
  courseId?: string;
  startDate?: string;
  endDate?: string;
}

interface ClassFormProps {
  opened: boolean;
  onClose: () => void;
  classData?: Class;
  onSave: (classData: Class) => Promise<void>;
  loading?: boolean;
  teachers?: Array<{ id: string; name: string }>;
  courses?: Array<{ id: string; name: string; level?: string }>;
  /** Per creazione da dettaglio corso (?action=create&courseId=...) */
  prefilledCourseId?: string;
}

export function ClassForm({
  opened,
  onClose,
  classData,
  onSave,
  loading = false,
  teachers = [],
  courses = [],
  prefilledCourseId,
}: ClassFormProps) {
  const [submitLoading, setSubmitLoading] = useState(false);

  const form = useForm<Class>({
    initialValues: {
      name: classData?.name || '',
      description: classData?.description || '',
      level: classData?.level || 'BEGINNER',
      maxStudents: classData?.maxStudents || 15,
      room: classData?.room || '',
      monthlyPrice: classData?.monthlyPrice ?? 0,
      isActive: classData?.isActive ?? true,
      teacherIds: classData?.teacherIds || [],
      courseId: classData?.courseId || prefilledCourseId || '',
      startDate: classData?.startDate || new Date().toISOString().split('T')[0],
      endDate: classData?.endDate || '',
    },
    validate: {
      name: (value) => (value.length < 2 ? 'Nome classe troppo corto' : null),
      courseId: (value) => (!value ? 'Seleziona un corso' : null),
      teacherIds: (value) => (!value || value.length === 0 ? 'Seleziona almeno un docente' : null),
      startDate: (value) => (!value ? 'Seleziona la data di inizio' : null),
      maxStudents: (value) => {
        if (value < 1) return 'Numero minimo di studenti: 1';
        if (value > 50) return 'Numero massimo di studenti: 50';
        return null;
      },
      monthlyPrice: (value) => {
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

  const teacherOptions = Array.isArray(teachers)
    ? teachers.map((teacher) => ({
        value: teacher.id || '',
        label: teacher.name || 'Senza nome',
      }))
    : [];

  const courseOptions = Array.isArray(courses)
    ? courses.map((course) => ({
        value: course.id || '',
        label: course.name || 'Senza nome',
      }))
    : [];

  const levelOptions = Object.entries(levelLabels).map(([value, label]) => ({
    value,
    label,
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
          background: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)',
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
            data-testid="classe-form-nome"
            {...form.getInputProps('name')}
          />

          <Textarea
            label="Descrizione"
            placeholder="Descrizione del corso e obiettivi"
            minRows={2}
            data-testid="classe-form-descrizione"
            {...form.getInputProps('description')}
          />

          <Grid>
            <Grid.Col span={6}>
              <Select
                label="Corso"
                placeholder="Seleziona corso"
                required
                searchable
                data={courseOptions}
                {...form.getInputProps('courseId')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Livello"
                placeholder="Seleziona livello"
                data={levelOptions}
                data-testid="classe-form-livello"
                {...form.getInputProps('level')}
              />
            </Grid.Col>
          </Grid>

          <Grid>
            <Grid.Col span={6}>
              <DateInput
                label="Data Inizio"
                placeholder="Seleziona data"
                required
                value={form.values.startDate ? new Date(form.values.startDate) : null}
                onChange={(date) => form.setFieldValue('startDate', date ? date.toISOString().split('T')[0] : '')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <DateInput
                label="Data Fine (Opzionale)"
                placeholder="Seleziona data"
                value={form.values.endDate ? new Date(form.values.endDate) : null}
                onChange={(date) => form.setFieldValue('endDate', date ? date.toISOString().split('T')[0] : '')}
                minDate={form.values.startDate ? new Date(form.values.startDate) : new Date()}
              />
            </Grid.Col>
          </Grid>

          <Grid>
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
            <Grid.Col span={6}>
              <TextInput
                label="Aula"
                placeholder="Es. Aula 101"
                data-testid="classe-form-aula"
                {...form.getInputProps('room')}
              />
            </Grid.Col>
          </Grid>

          {/* Docenti e Prezzo */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Docenti e Tariffe
            </h4>
            <Select
              label="Docente Assegnato"
              placeholder="Seleziona docente"
              required
              searchable
              data={teacherOptions}
              value={form.values.teacherIds?.[0] || ''}
              onChange={(value) => form.setFieldValue('teacherIds', value ? [value] : [])}
              error={form.errors.teacherIds}
            />

            <NumberInput
              label="Prezzo Mensile (€)"
              placeholder="0.00"
              min={0}
              decimalScale={2}
              fixedDecimalScale
              mt="md"
              data-testid="classe-form-prezzo"
              {...form.getInputProps('monthlyPrice')}
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
