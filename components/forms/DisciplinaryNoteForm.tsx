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
  Badge,
  Paper,
  Divider,
  Switch,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useTranslations } from 'next-intl';
import { DisciplinaryType, Severity } from '@prisma/client';
import {
  DisciplinaryNote,
  getTypeColor,
  getSeverityColor,
} from '@/lib/hooks/useDisciplinaryNotes';

interface DisciplinaryNoteFormProps {
  opened: boolean;
  onClose: () => void;
  note?: DisciplinaryNote | null;
  studentName?: string;
  className?: string;
  onSave: (data: any) => Promise<void>;
  loading?: boolean;
}

export function DisciplinaryNoteForm({
  opened,
  onClose,
  note,
  studentName,
  className,
  onSave,
  loading,
}: DisciplinaryNoteFormProps) {
  const t = useTranslations('disciplinary');
  const tCommon = useTranslations('common');

  const form = useForm({
    initialValues: {
      type: note?.type || 'NOTE',
      severity: note?.severity || 'MEDIUM',
      title: note?.title || '',
      description: note?.description || '',
      date: note?.date ? new Date(note.date) : new Date(),
      resolved: note?.resolved || false,
      resolution: note?.resolution || '',
    },
    validate: {
      title: (value) =>
        !value || value.length < 1
          ? t('validation.titleRequired')
          : value.length > 200
          ? t('validation.titleTooLong')
          : null,
      description: (value) =>
        !value || value.length < 1 ? t('validation.descriptionRequired') : null,
      date: (value) => (!value ? t('validation.dateRequired') : null),
    },
  });

  const handleSubmit = async (values: typeof form.values) => {
    try {
      await onSave({
        type: values.type,
        severity: values.severity,
        title: values.title,
        description: values.description,
        date: values.date.toISOString(),
        resolved: values.resolved,
        resolution: values.resolved ? values.resolution : null,
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

  const typeOptions = [
    { value: 'NOTE', label: t('types.NOTE') },
    { value: 'WARNING', label: t('types.WARNING') },
    { value: 'SUSPENSION', label: t('types.SUSPENSION') },
    { value: 'POSITIVE', label: t('types.POSITIVE') },
  ];

  const severityOptions = [
    { value: 'LOW', label: t('severities.LOW') },
    { value: 'MEDIUM', label: t('severities.MEDIUM') },
    { value: 'HIGH', label: t('severities.HIGH') },
    { value: 'CRITICAL', label: t('severities.CRITICAL') },
  ];

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={note ? t('editNote') : t('addNote')}
      size="lg"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          {/* Student and Class info */}
          {(studentName || className) && (
            <Paper withBorder p="sm" radius="md" bg="gray.0">
              <Group gap="md">
                {studentName && (
                  <div>
                    <Text size="xs" c="dimmed">
                      {t('student')}
                    </Text>
                    <Text fw={500}>{studentName}</Text>
                  </div>
                )}
                {className && (
                  <div>
                    <Text size="xs" c="dimmed">
                      {t('class')}
                    </Text>
                    <Text fw={500}>{className}</Text>
                  </div>
                )}
              </Group>
            </Paper>
          )}

          {/* Type and Severity */}
          <Group grow>
            <Select
              label={t('type')}
              data={typeOptions}
              {...form.getInputProps('type')}
              renderOption={({ option }) => (
                <Group gap="xs">
                  <Badge color={getTypeColor(option.value as DisciplinaryType)} size="sm">
                    {option.label}
                  </Badge>
                </Group>
              )}
            />
            <Select
              label={t('severity')}
              data={severityOptions}
              {...form.getInputProps('severity')}
              disabled={form.values.type === 'POSITIVE'}
              renderOption={({ option }) => (
                <Group gap="xs">
                  <Badge color={getSeverityColor(option.value as Severity)} size="sm">
                    {option.label}
                  </Badge>
                </Group>
              )}
            />
          </Group>

          {/* Preview badges */}
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              {t('preview')}:
            </Text>
            <Badge color={getTypeColor(form.values.type as DisciplinaryType)}>
              {typeOptions.find((o) => o.value === form.values.type)?.label}
            </Badge>
            {form.values.type !== 'POSITIVE' && (
              <Badge color={getSeverityColor(form.values.severity as Severity)}>
                {severityOptions.find((o) => o.value === form.values.severity)?.label}
              </Badge>
            )}
          </Group>

          <Divider />

          {/* Title and Date */}
          <Group grow>
            <TextInput
              label={t('title')}
              placeholder={t('titlePlaceholder')}
              required
              {...form.getInputProps('title')}
            />
            <DateInput
              label={t('date')}
              required
              valueFormat="DD/MM/YYYY"
              {...form.getInputProps('date')}
            />
          </Group>

          {/* Description */}
          <Textarea
            label={t('description')}
            placeholder={t('descriptionPlaceholder')}
            required
            minRows={4}
            {...form.getInputProps('description')}
          />

          {/* Resolution (only for edit mode) */}
          {note && (
            <>
              <Divider label={t('resolution')} labelPosition="center" />
              <Switch
                label={t('resolved')}
                description={t('resolvedDescription')}
                {...form.getInputProps('resolved', { type: 'checkbox' })}
              />
              {form.values.resolved && (
                <Textarea
                  label={t('resolutionNotes')}
                  placeholder={t('resolutionNotesPlaceholder')}
                  minRows={2}
                  {...form.getInputProps('resolution')}
                />
              )}
            </>
          )}

          {/* Actions */}
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={handleClose}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" loading={loading}>
              {note ? tCommon('update') : tCommon('create')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
