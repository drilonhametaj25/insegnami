'use client';

import { useState, useEffect } from 'react';
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
  NumberInput,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';

interface Lesson {
  id?: string;
  title: string;
  classId: string;
  teacherId: string;
  courseId: string;
  startTime: string;
  endTime: string;
  room?: string;
  description?: string;
  status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  isRecurring?: boolean;
  recurringPattern?: {
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    interval: number;
    endDate?: string;
  };
}

interface LessonFormProps {
  opened: boolean;
  onClose: () => void;
  lessonData?: Lesson;
  onSave: (lessonData: any) => Promise<void>;
  loading?: boolean;
  teachers?: Array<{ id: string; firstName: string; lastName: string }>;
  classes?: Array<{ 
    id: string; 
    name: string; 
    teacher: { id: string; firstName: string; lastName: string };
    course: { id: string; name: string; level: string };
  }>;
  courses?: Array<{ id: string; name: string; level: string }>;
  prefilledClassId?: string; // Per creazione da dettaglio classe
}

export function LessonForm({
  opened,
  onClose,
  lessonData,
  onSave,
  loading = false,
  teachers = [],
  classes = [],
  courses = [],
  prefilledClassId,
}: LessonFormProps) {
  const [submitLoading, setSubmitLoading] = useState(false);

  const form = useForm<any>({
    initialValues: {
      title: lessonData?.title || '',
      classId: lessonData?.classId || prefilledClassId || '',
      teacherId: lessonData?.teacherId || '',
      courseId: lessonData?.courseId || '',
      startTime: lessonData?.startTime ? new Date(lessonData.startTime) : new Date(),
      endTime: lessonData?.endTime 
        ? new Date(lessonData.endTime) 
        : new Date(Date.now() + 90 * 60 * 1000),
      room: lessonData?.room || '',
      description: lessonData?.description || '',
      status: lessonData?.status || 'SCHEDULED',
      isRecurring: lessonData?.isRecurring || false,
      recurringFrequency: lessonData?.recurringPattern?.frequency || 'WEEKLY',
      recurringInterval: lessonData?.recurringPattern?.interval || 1,
      recurringEndDate: lessonData?.recurringPattern?.endDate 
        ? new Date(lessonData.recurringPattern.endDate) 
        : undefined,
    },
    validate: {
      title: (value) => (value.length < 2 ? 'Titolo troppo corto' : null),
      classId: (value) => (!value ? 'Seleziona una classe' : null),
      teacherId: (value) => (!value ? 'Seleziona un docente' : null),
      courseId: (value) => (!value ? 'Seleziona un corso' : null),
      startTime: (value) => (!value ? 'Seleziona data e ora di inizio' : null),
      endTime: (value, values) => {
        if (!value) return 'Seleziona data e ora di fine';
        if (value <= values.startTime) return 'L\'ora di fine deve essere successiva a quella di inizio';
        return null;
      },
    },
  });

  // Auto-popolare docente e corso quando si seleziona una classe
  useEffect(() => {
    const selectedClass = classes.find((c) => c.id === form.values.classId);
    if (selectedClass) {
      // Auto-popola teacherId se non è già impostato
      if (!form.values.teacherId && selectedClass.teacher) {
        form.setFieldValue('teacherId', selectedClass.teacher.id);
      }
      // Auto-popola courseId se non è già impostato
      if (!form.values.courseId && selectedClass.course) {
        form.setFieldValue('courseId', selectedClass.course.id);
      }
    }
  }, [form.values.classId, classes]);

  const handleSubmit = async (values: any) => {
    setSubmitLoading(true);
    try {
      const lessonData = {
        title: values.title,
        classId: values.classId,
        teacherId: values.teacherId,
        courseId: values.courseId,
        startTime: values.startTime.toISOString(),
        endTime: values.endTime.toISOString(),
        room: values.room || undefined,
        description: values.description || undefined,
        status: values.status,
        isRecurring: values.isRecurring,
        recurringPattern: values.isRecurring
          ? {
              frequency: values.recurringFrequency,
              interval: values.recurringInterval,
              endDate: values.recurringEndDate?.toISOString(),
            }
          : undefined,
      };

      await onSave(lessonData);
      form.reset();
      onClose();
    } catch (error) {
      console.error('Error saving lesson:', error);
    } finally {
      setSubmitLoading(false);
    }
  };

  const classOptions = Array.isArray(classes)
    ? classes.map((c) => ({
        value: c.id || '',
        label: c.name || 'Senza nome',
      }))
    : [];

  const teacherOptions = Array.isArray(teachers)
    ? teachers.map((t) => ({
        value: t.id || '',
        label: `${t.firstName || ''} ${t.lastName || ''}`.trim() || 'Senza nome',
      }))
    : [];

  const courseOptions = Array.isArray(courses)
    ? courses.map((c) => ({
        value: c.id || '',
        label: c.name || 'Senza nome',
      }))
    : [];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={lessonData ? 'Modifica Lezione' : 'Nuova Lezione'}
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
            label="Titolo Lezione"
            placeholder="Es. Introduzione al Present Simple"
            required
            {...form.getInputProps('title')}
          />

          <Grid>
            <Grid.Col span={6}>
              <Select
                label="Classe"
                placeholder="Seleziona classe"
                required
                searchable
                data={classOptions}
                {...form.getInputProps('classId')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Docente"
                placeholder="Seleziona docente"
                required
                searchable
                data={teacherOptions}
                {...form.getInputProps('teacherId')}
              />
            </Grid.Col>
          </Grid>

          <Select
            label="Corso"
            placeholder="Seleziona corso"
            required
            searchable
            data={courseOptions}
            {...form.getInputProps('courseId')}
          />

          <Textarea
            label="Descrizione"
            placeholder="Descrizione della lezione e argomenti da trattare"
            minRows={2}
            {...form.getInputProps('description')}
          />

          {/* Data e Ora */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Data e Ora</h4>
            <Grid>
              <Grid.Col span={6}>
                <DateTimePicker
                  label="Data e Ora Inizio"
                  placeholder="Seleziona data e ora"
                  required
                  {...form.getInputProps('startTime')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <DateTimePicker
                  label="Data e Ora Fine"
                  placeholder="Seleziona data e ora"
                  required
                  {...form.getInputProps('endTime')}
                />
              </Grid.Col>
            </Grid>
          </div>

          {/* Logistica */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Logistica</h4>
            <Grid>
              <Grid.Col span={6}>
                <TextInput
                  label="Aula"
                  placeholder="Es. Aula 101"
                  {...form.getInputProps('room')}
                />
              </Grid.Col>
              <Grid.Col span={6}>
                <Select
                  label="Stato"
                  placeholder="Seleziona stato"
                  data={[
                    { value: 'SCHEDULED', label: 'Programmata' },
                    { value: 'COMPLETED', label: 'Completata' },
                    { value: 'CANCELLED', label: 'Annullata' },
                  ]}
                  {...form.getInputProps('status')}
                />
              </Grid.Col>
            </Grid>
          </div>

          {/* Ricorrenza */}
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Ricorrenza</h4>
            <Switch
              label="Lezione Ricorrente"
              description="Crea automaticamente lezioni ricorrenti"
              {...form.getInputProps('isRecurring', { type: 'checkbox' })}
            />

            {form.values.isRecurring && (
              <Stack gap="md" mt="md">
                <Grid>
                  <Grid.Col span={6}>
                    <Select
                      label="Frequenza"
                      placeholder="Seleziona frequenza"
                      data={[
                        { value: 'DAILY', label: 'Giornaliera' },
                        { value: 'WEEKLY', label: 'Settimanale' },
                        { value: 'MONTHLY', label: 'Mensile' },
                      ]}
                      {...form.getInputProps('recurringFrequency')}
                    />
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <NumberInput
                      label="Intervallo"
                      placeholder="1"
                      min={1}
                      max={12}
                      {...form.getInputProps('recurringInterval')}
                    />
                  </Grid.Col>
                </Grid>

                <DateTimePicker
                  label="Data Fine Ricorrenza (Opzionale)"
                  placeholder="Seleziona data"
                  minDate={form.values.startTime}
                  {...form.getInputProps('recurringEndDate')}
                />
              </Stack>
            )}
          </div>

          <Group justify="flex-end" mt="xl">
            <Button variant="light" onClick={onClose} radius="lg">
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
              {lessonData ? 'Aggiorna' : 'Crea'} Lezione
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
