'use client';

import { useState, useEffect } from 'react';
import { useForm } from '@mantine/form';
import {
  Modal,
  TextInput,
  NumberInput,
  Select,
  Button,
  Group,
  Stack,
  Grid,
  Textarea,
  Switch,
  Text,
  Badge,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useTranslations } from 'next-intl';
import { GradeType } from '@prisma/client';
import { getGradeColor, gradeTypeLabels } from '@/lib/hooks/useGrades';

interface GradeFormData {
  value: number | null;
  type: GradeType;
  weight: number;
  description: string;
  date: Date | null;
  isVisible: boolean;
  notes: string;
}

interface GradeFormProps {
  opened: boolean;
  onClose: () => void;
  grade?: {
    id?: string;
    value: number;
    type: GradeType;
    weight: number;
    description?: string | null;
    date: Date;
    isVisible: boolean;
    notes?: string | null;
  } | null;
  studentName?: string;
  subjectName?: string;
  onSave: (data: any) => Promise<void>;
  loading?: boolean;
}

const GRADE_TYPES = Object.entries(gradeTypeLabels).map(([value, label]) => ({
  value,
  label,
}));

const WEIGHT_OPTIONS = [
  { value: '0.5', label: '0.5 (Peso leggero)' },
  { value: '1', label: '1.0 (Peso normale)' },
  { value: '1.5', label: '1.5 (Peso medio-alto)' },
  { value: '2', label: '2.0 (Peso alto)' },
];

export function GradeForm({
  opened,
  onClose,
  grade,
  studentName,
  subjectName,
  onSave,
  loading = false,
}: GradeFormProps) {
  const t = useTranslations('grades');
  const tCommon = useTranslations('common');
  const [submitLoading, setSubmitLoading] = useState(false);

  const form = useForm<GradeFormData>({
    initialValues: {
      value: null,
      type: 'WRITTEN',
      weight: 1,
      description: '',
      date: new Date(),
      isVisible: true,
      notes: '',
    },
    validate: {
      value: (value) => {
        if (value === null || value === undefined) return 'Voto obbligatorio';
        if (value < 0 || value > 10) return 'Il voto deve essere tra 0 e 10';
        return null;
      },
      date: (value) => (!value ? 'Data obbligatoria' : null),
    },
  });

  useEffect(() => {
    if (grade) {
      form.setValues({
        value: grade.value,
        type: grade.type || 'WRITTEN',
        weight: grade.weight || 1,
        description: grade.description || '',
        date: grade.date ? new Date(grade.date) : new Date(),
        isVisible: grade.isVisible ?? true,
        notes: grade.notes || '',
      });
    } else {
      form.reset();
      form.setFieldValue('date', new Date());
    }
  }, [grade, opened]);

  const handleSubmit = async (values: GradeFormData) => {
    if (values.value === null) return;

    setSubmitLoading(true);
    try {
      await onSave({
        value: values.value,
        type: values.type,
        weight: values.weight,
        description: values.description || null,
        date: values.date?.toISOString(),
        isVisible: values.isVisible,
        notes: values.notes || null,
      });
      notifications.show({
        title: tCommon('success'),
        message: grade ? t('updateSuccess') : t('createSuccess'),
        color: 'green',
      });
      form.reset();
      onClose();
    } catch (error) {
      notifications.show({
        title: tCommon('error'),
        message: error instanceof Error ? error.message : t('saveError'),
        color: 'red',
      });
    } finally {
      setSubmitLoading(false);
    }
  };

  const currentValue = form.values.value;
  const gradeColor = currentValue !== null ? getGradeColor(currentValue) : '#94a3b8';

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={grade ? t('editGrade') : t('addGrade')}
      size="lg"
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
          background: `linear-gradient(135deg, ${gradeColor} 0%, ${gradeColor}cc 100%)`,
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
          {(studentName || subjectName) && (
            <Group gap="xs">
              {studentName && <Badge size="lg" variant="light">{studentName}</Badge>}
              {subjectName && <Badge size="lg" variant="outline">{subjectName}</Badge>}
            </Group>
          )}

          <Grid>
            <Grid.Col span={4}>
              <NumberInput
                label={t('value')}
                placeholder="6.5"
                required
                min={0}
                max={10}
                step={0.5}
                decimalScale={2}
                size="lg"
                styles={{
                  input: {
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    color: gradeColor,
                  },
                }}
                {...form.getInputProps('value')}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                label={t('type')}
                data={GRADE_TYPES}
                required
                {...form.getInputProps('type')}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                label={t('weight')}
                data={WEIGHT_OPTIONS}
                value={form.values.weight.toString()}
                onChange={(val) => form.setFieldValue('weight', parseFloat(val || '1'))}
              />
            </Grid.Col>
          </Grid>

          <Grid>
            <Grid.Col span={6}>
              <DatePickerInput
                label={t('date')}
                required
                maxDate={new Date()}
                {...form.getInputProps('date')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <TextInput
                label={t('description')}
                placeholder={t('descriptionPlaceholder')}
                {...form.getInputProps('description')}
              />
            </Grid.Col>
          </Grid>

          <Textarea
            label={t('notes')}
            placeholder={t('notesPlaceholder')}
            minRows={2}
            {...form.getInputProps('notes')}
          />

          <Switch
            label={t('isVisible')}
            description={t('isVisibleDescription')}
            {...form.getInputProps('isVisible', { type: 'checkbox' })}
          />

          {currentValue !== null && (
            <Group justify="center">
              <Text size="sm" c="dimmed">Anteprima:</Text>
              <Badge
                size="xl"
                variant="filled"
                color={currentValue < 6 ? 'red' : currentValue < 7 ? 'yellow' : 'green'}
                styles={{
                  root: {
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    padding: '12px 24px',
                  },
                }}
              >
                {currentValue.toFixed(currentValue % 1 === 0 ? 0 : 1)}
              </Badge>
            </Group>
          )}

          <Group justify="flex-end" mt="xl">
            <Button variant="light" onClick={onClose} radius="lg">
              {tCommon('cancel')}
            </Button>
            <Button
              type="submit"
              loading={submitLoading || loading}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan', deg: 45 }}
              radius="lg"
            >
              {grade ? t('updateGrade') : t('saveGrade')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
