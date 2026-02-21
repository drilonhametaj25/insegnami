'use client';

import { useState, useEffect } from 'react';
import { useForm } from '@mantine/form';
import {
  Modal,
  TextInput,
  Button,
  Group,
  Stack,
  Grid,
  Switch,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useTranslations } from 'next-intl';

interface AcademicYear {
  id?: string;
  name: string;
  startDate: Date;
  endDate: Date;
  isCurrent: boolean;
}

interface CreateAcademicYearData {
  name: string;
  startDate: string;
  endDate: string;
  isCurrent?: boolean;
}

interface AcademicYearFormProps {
  opened: boolean;
  onClose: () => void;
  academicYear?: AcademicYear | null;
  onSave: (data: CreateAcademicYearData) => Promise<void>;
  loading?: boolean;
}

export function AcademicYearForm({
  opened,
  onClose,
  academicYear,
  onSave,
  loading = false,
}: AcademicYearFormProps) {
  const t = useTranslations('academicYears');
  const tCommon = useTranslations('common');
  const [submitLoading, setSubmitLoading] = useState(false);

  const form = useForm({
    initialValues: {
      name: '',
      startDate: null as Date | null,
      endDate: null as Date | null,
      isCurrent: false,
    },
    validate: {
      name: (value) => (value.length < 3 ? t('validation.nameTooShort') : null),
      startDate: (value) => (!value ? t('validation.startDateRequired') : null),
      endDate: (value, values) => {
        if (!value) return t('validation.endDateRequired');
        if (values.startDate && value <= values.startDate) {
          return t('validation.endDateAfterStart');
        }
        return null;
      },
    },
  });

  useEffect(() => {
    if (academicYear) {
      form.setValues({
        name: academicYear.name || '',
        startDate: academicYear.startDate ? new Date(academicYear.startDate) : null,
        endDate: academicYear.endDate ? new Date(academicYear.endDate) : null,
        isCurrent: academicYear.isCurrent ?? false,
      });
    } else {
      form.reset();
    }
  }, [academicYear, opened]);

  const handleSubmit = async (values: typeof form.values) => {
    if (!values.startDate || !values.endDate) return;

    setSubmitLoading(true);
    try {
      await onSave({
        name: values.name,
        startDate: values.startDate.toISOString(),
        endDate: values.endDate.toISOString(),
        isCurrent: values.isCurrent,
      });
      notifications.show({
        title: tCommon('success'),
        message: academicYear ? t('updateSuccess') : t('createSuccess'),
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
      title={academicYear ? t('editYear') : t('addYear')}
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
          <TextInput
            label={t('name')}
            placeholder={t('namePlaceholder')}
            required
            {...form.getInputProps('name')}
          />

          <Grid>
            <Grid.Col span={6}>
              <DatePickerInput
                label={t('startDate')}
                placeholder={t('selectDate')}
                required
                {...form.getInputProps('startDate')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <DatePickerInput
                label={t('endDate')}
                placeholder={t('selectDate')}
                required
                minDate={form.values.startDate || undefined}
                {...form.getInputProps('endDate')}
              />
            </Grid.Col>
          </Grid>

          <Switch
            label={t('isCurrent')}
            description={t('isCurrentDescription')}
            {...form.getInputProps('isCurrent', { type: 'checkbox' })}
          />

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
              {academicYear ? t('updateYear') : t('createYear')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
