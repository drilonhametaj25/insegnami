'use client';

import { useForm } from '@mantine/form';
import {
  Modal,
  Stack,
  TextInput,
  Textarea,
  Select,
  Group,
  Button,
  Text,
  Paper,
  Switch,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useTranslations } from 'next-intl';
import { Homework } from '@/lib/hooks/useHomework';

interface HomeworkFormProps {
  opened: boolean;
  onClose: () => void;
  homework?: Homework | null;
  classes: Array<{ value: string; label: string }>;
  subjects: Array<{ value: string; label: string }>;
  onSave: (data: any) => Promise<void>;
  loading?: boolean;
}

export function HomeworkForm({
  opened,
  onClose,
  homework,
  classes,
  subjects,
  onSave,
  loading,
}: HomeworkFormProps) {
  const t = useTranslations('homework');
  const tCommon = useTranslations('common');

  const form = useForm({
    initialValues: {
      classId: homework?.classId || '',
      subjectId: homework?.subjectId || '',
      title: homework?.title || '',
      description: homework?.description || '',
      assignedDate: homework?.assignedDate ? new Date(homework.assignedDate) : new Date(),
      dueDate: homework?.dueDate ? new Date(homework.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      isPublished: homework?.isPublished ?? true,
    },
    validate: {
      classId: (value) => (!value ? t('validation.classRequired') : null),
      subjectId: (value) => (!value ? t('validation.subjectRequired') : null),
      title: (value) =>
        !value || value.length < 1
          ? t('validation.titleRequired')
          : value.length > 200
          ? t('validation.titleTooLong')
          : null,
      description: (value) =>
        !value || value.length < 1 ? t('validation.descriptionRequired') : null,
      dueDate: (value, values) => {
        if (!value) return t('validation.dueDateRequired');
        if (value < values.assignedDate) return t('validation.dueDateAfterAssigned');
        return null;
      },
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    try {
      await onSave({
        classId: values.classId,
        subjectId: values.subjectId,
        title: values.title,
        description: values.description,
        assignedDate: values.assignedDate.toISOString(),
        dueDate: values.dueDate.toISOString(),
        isPublished: values.isPublished,
      });
      form.reset();
      onClose();
    } catch {
      // Error handled by parent
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={homework ? t('editHomework') : t('addHomework')}
      size="lg"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {/* Class and Subject selection - only for new homework */}
          {!homework && (
            <Group grow>
              <Select
                label={t('class')}
                placeholder={t('selectClass')}
                data={classes}
                required
                {...form.getInputProps('classId')}
              />
              <Select
                label={t('subject')}
                placeholder={t('selectSubject')}
                data={subjects}
                required
                {...form.getInputProps('subjectId')}
              />
            </Group>
          )}

          {/* Title */}
          <TextInput
            label={t('title')}
            placeholder={t('titlePlaceholder')}
            required
            {...form.getInputProps('title')}
          />

          {/* Description */}
          <Textarea
            label={t('description')}
            placeholder={t('descriptionPlaceholder')}
            required
            minRows={4}
            {...form.getInputProps('description')}
          />

          {/* Dates */}
          <Group grow>
            <DateInput
              label={t('assignedDate')}
              required
              valueFormat="DD/MM/YYYY"
              {...form.getInputProps('assignedDate')}
            />
            <DateInput
              label={t('dueDate')}
              required
              valueFormat="DD/MM/YYYY"
              minDate={form.values.assignedDate}
              {...form.getInputProps('dueDate')}
            />
          </Group>

          {/* Publish toggle */}
          <Switch
            label={t('isPublished')}
            description={t('isPublishedDescription')}
            {...form.getInputProps('isPublished', { type: 'checkbox' })}
          />

          {/* Actions */}
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={handleClose}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" loading={loading}>
              {homework ? tCommon('update') : tCommon('create')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
