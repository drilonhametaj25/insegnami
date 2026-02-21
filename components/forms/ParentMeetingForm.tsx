'use client';

import { useForm } from '@mantine/form';
import {
  TextInput,
  Select,
  NumberInput,
  Textarea,
  Button,
  Group,
  Stack,
  LoadingOverlay,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import {
  ParentMeeting,
  CreateParentMeetingInput,
  UpdateParentMeetingInput,
} from '@/lib/hooks/useParentMeetings';

interface ParentMeetingFormProps {
  meeting?: ParentMeeting | null;
  teachers?: { id: string; firstName: string; lastName: string }[];
  students?: { id: string; firstName: string; lastName: string }[];
  onSubmit: (data: CreateParentMeetingInput | UpdateParentMeetingInput) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ParentMeetingForm({
  meeting,
  teachers = [],
  students = [],
  onSubmit,
  onCancel,
  isLoading = false,
}: ParentMeetingFormProps) {
  const t = useTranslations('meetings');
  const { data: session } = useSession();
  const userRole = session?.user?.role;
  const isEdit = !!meeting;

  const form = useForm({
    initialValues: {
      teacherId: meeting?.teacherId || '',
      studentId: meeting?.studentId || '',
      date: meeting ? new Date(meeting.date) : null,
      duration: meeting?.duration || 15,
      room: meeting?.room || '',
      parentNotes: meeting?.parentNotes || '',
      teacherNotes: meeting?.teacherNotes || '',
    },
    validate: {
      teacherId: (value) =>
        userRole === 'TEACHER' || value ? null : t('selectTeacher'),
      studentId: (value) => (value ? null : t('selectStudent')),
      date: (value) => (value ? null : t('selectDateTime')),
      duration: (value) =>
        value && value >= 5 && value <= 120 ? null : 'Durata non valida (5-120 min)',
    },
  });

  const handleSubmit = (values: typeof form.values) => {
    const data: any = {
      date: values.date?.toISOString(),
      duration: values.duration,
      room: values.room || null,
    };

    if (!isEdit) {
      data.studentId = values.studentId;
      if (userRole !== 'TEACHER') {
        data.teacherId = values.teacherId;
      }
    }

    // Add notes based on role
    if (userRole === 'PARENT') {
      data.parentNotes = values.parentNotes;
    } else if (userRole === 'TEACHER' || userRole === 'ADMIN') {
      data.teacherNotes = values.teacherNotes;
    }

    onSubmit(data);
  };

  // Minimum date is now
  const minDate = new Date();

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <LoadingOverlay visible={isLoading} />

      <Stack gap="md">
        {/* Teacher select - for PARENT and ADMIN */}
        {userRole !== 'TEACHER' && teachers.length > 0 && !isEdit && (
          <Select
            label={t('selectTeacher')}
            placeholder={t('selectTeacher')}
            data={teachers.map((teacher) => ({
              value: teacher.id,
              label: `${teacher.firstName} ${teacher.lastName}`,
            }))}
            searchable
            required
            {...form.getInputProps('teacherId')}
          />
        )}

        {/* Student select - for TEACHER and ADMIN */}
        {userRole !== 'PARENT' && students.length > 0 && !isEdit && (
          <Select
            label={t('selectStudent')}
            placeholder={t('selectStudent')}
            data={students.map((student) => ({
              value: student.id,
              label: `${student.firstName} ${student.lastName}`,
            }))}
            searchable
            required
            {...form.getInputProps('studentId')}
          />
        )}

        {/* For PARENT with single child, auto-select */}
        {userRole === 'PARENT' && students.length === 1 && !isEdit && (
          <input type="hidden" {...form.getInputProps('studentId')} value={students[0].id} />
        )}

        {/* For PARENT with multiple children */}
        {userRole === 'PARENT' && students.length > 1 && !isEdit && (
          <Select
            label={t('selectStudent')}
            placeholder={t('selectStudent')}
            data={students.map((student) => ({
              value: student.id,
              label: `${student.firstName} ${student.lastName}`,
            }))}
            required
            {...form.getInputProps('studentId')}
          />
        )}

        {/* Date and time */}
        <DateTimePicker
          label={t('selectDateTime')}
          placeholder={t('selectDateTime')}
          minDate={minDate}
          required
          {...form.getInputProps('date')}
        />

        {/* Duration */}
        <NumberInput
          label={t('duration')}
          description={t('minutes')}
          min={5}
          max={120}
          step={5}
          {...form.getInputProps('duration')}
        />

        {/* Room/Link */}
        <TextInput
          label={t('room')}
          placeholder={t('roomPlaceholder')}
          {...form.getInputProps('room')}
        />

        {/* Notes based on role */}
        {userRole === 'PARENT' && (
          <Textarea
            label={t('parentNotes')}
            placeholder={t('notes')}
            minRows={3}
            {...form.getInputProps('parentNotes')}
          />
        )}

        {(userRole === 'TEACHER' || userRole === 'ADMIN') && (
          <Textarea
            label={t('teacherNotes')}
            placeholder={t('notes')}
            minRows={3}
            {...form.getInputProps('teacherNotes')}
          />
        )}

        {/* Actions */}
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onCancel}>
            {t('actions.cancel')}
          </Button>
          <Button type="submit" loading={isLoading}>
            {isEdit ? t('actions.edit') : t('newMeeting')}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
