'use client';

import { useState, useEffect } from 'react';
import {
  TextInput,
  NumberInput,
  Textarea,
  Button,
  Group,
  Stack,
  Select,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useTranslations } from 'next-intl';

interface HoursPackageFormProps {
  students: Array<{ id: string; firstName: string; lastName: string; studentCode: string }>;
  courses: Array<{ id: string; name: string; code: string }>;
  onSubmit: (data: HoursPackageFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  initialData?: Partial<HoursPackageFormData>;
}

export interface HoursPackageFormData {
  studentId: string;
  courseId: string;
  totalHours: number;
  price?: number | null;
  expiryDate?: Date | null;
  notes?: string | null;
}

export function HoursPackageForm({
  students,
  courses,
  onSubmit,
  onCancel,
  isSubmitting = false,
  initialData,
}: HoursPackageFormProps) {
  const t = useTranslations();

  const [formData, setFormData] = useState<HoursPackageFormData>({
    studentId: initialData?.studentId || '',
    courseId: initialData?.courseId || '',
    totalHours: initialData?.totalHours || 10,
    price: initialData?.price || null,
    expiryDate: initialData?.expiryDate || null,
    notes: initialData?.notes || null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.studentId) {
      newErrors.studentId = t('validation.required');
    }

    if (!formData.courseId) {
      newErrors.courseId = t('validation.required');
    }

    if (!formData.totalHours || formData.totalHours <= 0) {
      newErrors.totalHours = t('validation.positiveNumber');
    }

    if (formData.price !== null && formData.price !== undefined && formData.price < 0) {
      newErrors.price = t('validation.positiveNumber');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  const studentOptions = students.map((student) => ({
    value: student.id,
    label: `${student.firstName} ${student.lastName} (${student.studentCode})`,
  }));

  const courseOptions = courses.map((course) => ({
    value: course.id,
    label: `${course.name} (${course.code})`,
  }));

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <Select
          label={t('student')}
          placeholder={t('selectStudent')}
          data={studentOptions}
          value={formData.studentId}
          onChange={(value) => setFormData({ ...formData, studentId: value || '' })}
          error={errors.studentId}
          required
          searchable
          withAsterisk
        />

        <Select
          label={t('course')}
          placeholder={t('selectCourse')}
          data={courseOptions}
          value={formData.courseId}
          onChange={(value) => setFormData({ ...formData, courseId: value || '' })}
          error={errors.courseId}
          required
          searchable
          withAsterisk
        />

        <NumberInput
          label={t('hoursPackages.totalHours')}
          placeholder="20"
          value={formData.totalHours}
          onChange={(value) => setFormData({ ...formData, totalHours: Number(value) || 0 })}
          error={errors.totalHours}
          min={0.5}
          step={0.5}
          decimalScale={1}
          required
          withAsterisk
        />

        <NumberInput
          label={t('price')}
          placeholder="500.00"
          value={formData.price || undefined}
          onChange={(value) => setFormData({ ...formData, price: value !== '' ? Number(value) : null })}
          error={errors.price}
          min={0}
          step={10}
          decimalScale={2}
          prefix="€ "
        />

        <DateInput
          label={t('hoursPackages.expiryDate')}
          placeholder={t('hoursPackages.expiryDatePlaceholder')}
          value={formData.expiryDate}
          onChange={(value) => setFormData({ ...formData, expiryDate: value })}
          minDate={new Date()}
          clearable
        />

        <Textarea
          label={t('notes')}
          placeholder={t('hoursPackages.notesPlaceholder')}
          value={formData.notes || ''}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
          minRows={3}
        />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onCancel} disabled={isSubmitting}>
            {t('cancel')}
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {initialData ? t('save') : t('create')}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
