'use client';

import { useForm } from '@mantine/form';
import {
  Modal,
  TextInput,
  Textarea,
  Select,
  Autocomplete,
  Button,
  Group,
  Stack,
  Grid,
  NumberInput,
  Divider,
  Text,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { IconCurrencyEuro } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useCreateMovement, type MovementType, type CreateMovementData } from '@/lib/hooks/useAccounting';
import { useClasses } from '@/lib/hooks/useClasses';
import { useCourses } from '@/lib/hooks/useCourses';
import { useStudents } from '@/lib/hooks/useStudents';

/** Suggerimenti per la categoria: campo libero con autocompletamento */
const CATEGORY_SUGGESTIONS = ['rette', 'stipendi', 'affitto', 'utenze', 'materiali', 'marketing', 'altro'];

interface MovementFormValues {
  date: Date;
  type: MovementType;
  category: string;
  amount: number;
  description: string;
  classId: string;
  courseId: string;
  studentId: string;
}

interface AccountingMovementFormProps {
  opened: boolean;
  onClose: () => void;
}

/**
 * Modal per la registrazione di un movimento contabile manuale
 * (source=MANUAL forzato lato server). Default COST, REVENUE permesso.
 */
export function AccountingMovementForm({ opened, onClose }: AccountingMovementFormProps) {
  const createMovement = useCreateMovement();

  const { data: classesData } = useClasses(1, 100);
  const { data: coursesData } = useCourses(1, 100);
  const { data: studentsData } = useStudents(1, 100);

  const classes = classesData?.classes || [];
  const courses = coursesData?.courses || [];
  const students = studentsData?.students || [];

  const form = useForm<MovementFormValues>({
    initialValues: {
      date: new Date(),
      type: 'COST',
      category: '',
      amount: 0,
      description: '',
      classId: '',
      courseId: '',
      studentId: '',
    },
    validate: {
      date: (value) => (!value ? 'Data richiesta' : null),
      category: (value) => (!value?.trim() ? 'Categoria richiesta' : null),
      amount: (value) => (!value || value <= 0 ? 'Importo deve essere maggiore di 0' : null),
    },
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  const handleSubmit = (values: MovementFormValues) => {
    const data: CreateMovementData = {
      date: dayjs(values.date).format('YYYY-MM-DD'),
      type: values.type,
      category: values.category.trim(),
      amount: values.amount,
      description: values.description?.trim() || undefined,
      classId: values.classId || undefined,
      courseId: values.courseId || undefined,
      studentId: values.studentId || undefined,
    };

    createMovement.mutate(data, {
      onSuccess: () => {
        notifications.show({
          title: 'Successo',
          message: 'Movimento creato con successo',
          color: 'green',
        });
        handleClose();
      },
      onError: (error) => {
        notifications.show({
          title: 'Errore',
          message: error.message || 'Errore nella creazione del movimento',
          color: 'red',
        });
      },
    });
  };

  return (
    <Modal opened={opened} onClose={handleClose} title="Nuovo Movimento" size="lg">
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Grid>
            <Grid.Col span={6}>
              <DatePickerInput
                label="Data"
                placeholder="Seleziona data"
                valueFormat="DD/MM/YYYY"
                {...form.getInputProps('date')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label="Tipo"
                data={[
                  { value: 'COST', label: 'Costo' },
                  { value: 'REVENUE', label: 'Ricavo' },
                ]}
                allowDeselect={false}
                {...form.getInputProps('type')}
              />
            </Grid.Col>
          </Grid>

          <Grid>
            <Grid.Col span={6}>
              <Autocomplete
                label="Categoria"
                placeholder="Es: affitto, utenze..."
                data={CATEGORY_SUGGESTIONS}
                {...form.getInputProps('category')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <NumberInput
                label="Importo"
                placeholder="0.00"
                min={0}
                step={0.01}
                decimalScale={2}
                leftSection={<IconCurrencyEuro size={16} />}
                {...form.getInputProps('amount')}
              />
            </Grid.Col>
          </Grid>

          <Textarea
            label="Descrizione"
            placeholder="Es: Affitto sede mese di giugno"
            autosize
            minRows={2}
            {...form.getInputProps('description')}
          />

          <Divider
            label={
              <Text size="xs" c="dimmed">
                Allocazione opzionale
              </Text>
            }
          />

          <Grid>
            <Grid.Col span={4}>
              <Select
                label="Classe"
                placeholder="Nessuna"
                data={classes.map((c) => ({ value: c.id, label: c.name }))}
                searchable
                clearable
                {...form.getInputProps('classId')}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                label="Corso"
                placeholder="Nessuno"
                data={courses.map((c) => ({ value: c.id, label: c.name }))}
                searchable
                clearable
                {...form.getInputProps('courseId')}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                label="Studente"
                placeholder="Nessuno"
                data={students.map((s) => ({ value: s.id, label: `${s.firstName} ${s.lastName}` }))}
                searchable
                clearable
                {...form.getInputProps('studentId')}
              />
            </Grid.Col>
          </Grid>

          <Group justify="flex-end" mt="md">
            <Button variant="light" color="gray" onClick={handleClose}>
              Annulla
            </Button>
            <Button type="submit" loading={createMovement.isPending}>
              Crea
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
