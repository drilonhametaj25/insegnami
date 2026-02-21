'use client';

import { useState, useEffect } from 'react';
import { useForm } from '@mantine/form';
import {
  Modal,
  TextInput,
  NumberInput,
  Button,
  Group,
  Stack,
  Grid,
  Switch,
  ColorInput,
  Select,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useTranslations } from 'next-intl';

interface Subject {
  id?: string;
  name: string;
  code: string;
  color: string | null;
  icon: string | null;
  weeklyHours: number | null;
  isActive: boolean;
}

interface CreateSubjectData {
  name: string;
  code: string;
  color?: string;
  icon?: string | null;
  weeklyHours?: number | null;
  isActive?: boolean;
}

interface SubjectFormProps {
  opened: boolean;
  onClose: () => void;
  subject?: Subject | null;
  onSave: (subject: CreateSubjectData) => Promise<void>;
  loading?: boolean;
}

const SUBJECT_ICONS = [
  { value: 'book', label: 'Libro' },
  { value: 'math', label: 'Matematica' },
  { value: 'flask', label: 'Scienze' },
  { value: 'globe', label: 'Geografia' },
  { value: 'history', label: 'Storia' },
  { value: 'language', label: 'Lingue' },
  { value: 'palette', label: 'Arte' },
  { value: 'music', label: 'Musica' },
  { value: 'run', label: 'Ed. Fisica' },
  { value: 'device', label: 'Tecnologia' },
  { value: 'heart', label: 'Religione' },
];

export function SubjectForm({
  opened,
  onClose,
  subject,
  onSave,
  loading = false,
}: SubjectFormProps) {
  const t = useTranslations('subjects');
  const tCommon = useTranslations('common');
  const [submitLoading, setSubmitLoading] = useState(false);

  const form = useForm<Subject>({
    initialValues: {
      name: '',
      code: '',
      color: '#3b82f6',
      icon: null,
      weeklyHours: null,
      isActive: true,
    },
    validate: {
      name: (value) => (value.length < 2 ? t('validation.nameTooShort') : null),
      code: (value) => {
        if (value.length < 1) return t('validation.codeRequired');
        if (value.length > 10) return t('validation.codeTooLong');
        return null;
      },
    },
  });

  useEffect(() => {
    if (subject) {
      form.setValues({
        name: subject.name || '',
        code: subject.code || '',
        color: subject.color || '#3b82f6',
        icon: subject.icon || null,
        weeklyHours: subject.weeklyHours,
        isActive: subject.isActive ?? true,
      });
    } else {
      form.reset();
    }
  }, [subject, opened]);

  const handleSubmit = async (values: Subject) => {
    setSubmitLoading(true);
    try {
      // Convert Subject to CreateSubjectData format
      const data: CreateSubjectData = {
        name: values.name,
        code: values.code,
        color: values.color || undefined,
        icon: values.icon,
        weeklyHours: values.weeklyHours,
        isActive: values.isActive,
      };
      await onSave(data);
      notifications.show({
        title: tCommon('success'),
        message: subject ? t('updateSuccess') : t('createSuccess'),
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

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={subject ? t('editSubject') : t('addSubject')}
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
          <Grid>
            <Grid.Col span={8}>
              <TextInput
                label={t('name')}
                placeholder={t('namePlaceholder')}
                required
                {...form.getInputProps('name')}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label={t('code')}
                placeholder={t('codePlaceholder')}
                required
                maxLength={10}
                {...form.getInputProps('code')}
              />
            </Grid.Col>
          </Grid>

          <Grid>
            <Grid.Col span={6}>
              <ColorInput
                label={t('color')}
                placeholder={t('colorPlaceholder')}
                format="hex"
                swatches={[
                  '#3b82f6', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6',
                  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#78716c'
                ]}
                {...form.getInputProps('color')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Select
                label={t('icon')}
                placeholder={t('iconPlaceholder')}
                data={SUBJECT_ICONS}
                clearable
                {...form.getInputProps('icon')}
              />
            </Grid.Col>
          </Grid>

          <Grid>
            <Grid.Col span={6}>
              <NumberInput
                label={t('weeklyHours')}
                placeholder={t('weeklyHoursPlaceholder')}
                min={0}
                max={40}
                {...form.getInputProps('weeklyHours')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <Switch
                label={t('isActive')}
                description={t('isActiveDescription')}
                mt="md"
                {...form.getInputProps('isActive', { type: 'checkbox' })}
              />
            </Grid.Col>
          </Grid>

          <Group justify="flex-end" mt="xl">
            <Button
              variant="light"
              onClick={onClose}
              radius="lg"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              type="submit"
              loading={submitLoading || loading}
              variant="gradient"
              gradient={{ from: 'indigo', to: 'purple', deg: 45 }}
              radius="lg"
            >
              {subject ? t('updateSubject') : t('createSubject')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
