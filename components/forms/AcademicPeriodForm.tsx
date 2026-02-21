'use client';

import { useState, useEffect } from 'react';
import { useForm } from '@mantine/form';
import {
  Modal,
  TextInput,
  Select,
  Button,
  Group,
  Stack,
  Grid,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useTranslations } from 'next-intl';
import { PeriodType } from '@prisma/client';

interface AcademicPeriod {
  id?: string;
  name: string;
  type: PeriodType;
  startDate: Date;
  endDate: Date;
  orderIndex?: number;
}

interface CreatePeriodData {
  name: string;
  periodType: PeriodType;
  startDate: string;
  endDate: string;
  orderIndex?: number;
}

interface AcademicPeriodFormProps {
  opened: boolean;
  onClose: () => void;
  period?: AcademicPeriod | null;
  yearStartDate?: Date;
  yearEndDate?: Date;
  onSave: (data: CreatePeriodData) => Promise<void>;
  loading?: boolean;
}

const PERIOD_TYPES = [
  { value: 'TRIMESTRE', label: 'Trimestre' },
  { value: 'QUADRIMESTRE', label: 'Quadrimestre' },
  { value: 'SEMESTRE', label: 'Semestre' },
  { value: 'PENTAMESTRE', label: 'Pentamestre' },
];

export function AcademicPeriodForm({
  opened,
  onClose,
  period,
  yearStartDate,
  yearEndDate,
  onSave,
  loading = false,
}: AcademicPeriodFormProps) {
  const t = useTranslations('academicYears');
  const tCommon = useTranslations('common');
  const [submitLoading, setSubmitLoading] = useState(false);

  const form = useForm({
    initialValues: {
      name: '',
      periodType: 'QUADRIMESTRE' as PeriodType,
      startDate: null as Date | null,
      endDate: null as Date | null,
    },
    validate: {
      name: (value) => (value.length < 2 ? t('validation.nameRequired') : null),
      periodType: (value) => (!value ? t('validation.periodTypeRequired') : null),
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
    if (period) {
      form.setValues({
        name: period.name || '',
        periodType: period.type || 'QUADRIMESTRE',
        startDate: period.startDate ? new Date(period.startDate) : null,
        endDate: period.endDate ? new Date(period.endDate) : null,
      });
    } else {
      form.reset();
    }
  }, [period, opened]);

  const handleSubmit = async (values: typeof form.values) => {
    if (!values.startDate || !values.endDate) return;

    setSubmitLoading(true);
    try {
      await onSave({
        name: values.name,
        periodType: values.periodType,
        startDate: values.startDate.toISOString(),
        endDate: values.endDate.toISOString(),
      });
      notifications.show({
        title: tCommon('success'),
        message: period ? t('periodUpdateSuccess') : t('periodCreateSuccess'),
        color: 'green',
      });
      form.reset();
      onClose();
    } catch (error) {
      notifications.show({
        title: tCommon('error'),
        message: error instanceof Error ? error.message : t('periodSaveError'),
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
      title={period ? t('editPeriod') : t('addPeriod')}
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
          background: 'linear-gradient(135deg, #48bb78 0%, #38a169 100%)',
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
                label={t('periodName')}
                placeholder={t('periodNamePlaceholder')}
                required
                {...form.getInputProps('name')}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Select
                label={t('periodType')}
                data={PERIOD_TYPES}
                required
                {...form.getInputProps('periodType')}
              />
            </Grid.Col>
          </Grid>

          <Grid>
            <Grid.Col span={6}>
              <DatePickerInput
                label={t('startDate')}
                required
                minDate={yearStartDate}
                maxDate={yearEndDate}
                {...form.getInputProps('startDate')}
              />
            </Grid.Col>
            <Grid.Col span={6}>
              <DatePickerInput
                label={t('endDate')}
                required
                minDate={form.values.startDate || yearStartDate}
                maxDate={yearEndDate}
                {...form.getInputProps('endDate')}
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
              gradient={{ from: 'teal', to: 'green', deg: 45 }}
              radius="lg"
            >
              {period ? t('updatePeriod') : t('createPeriod')}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
