'use client';

import { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  NumberInput,
  TextInput,
  Textarea,
  Button,
  Group,
  Text,
  Badge,
  Paper,
  Divider,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconCheck, IconX } from '@tabler/icons-react';
import { ReportCardEntry, getGradeColor } from '@/lib/hooks/useReportCards';

interface ReportCardEntryFormProps {
  opened: boolean;
  onClose: () => void;
  entry: ReportCardEntry | null;
  onSave: (data: {
    id?: string;
    subjectId: string;
    finalGrade: number;
    finalGradeText?: string;
    teacherComment?: string;
  }) => Promise<void>;
  loading?: boolean;
}

export function ReportCardEntryForm({
  opened,
  onClose,
  entry,
  onSave,
  loading = false,
}: ReportCardEntryFormProps) {
  const form = useForm({
    initialValues: {
      finalGrade: 6,
      finalGradeText: '',
      teacherComment: '',
    },
    validate: {
      finalGrade: (value) => {
        if (value < 1 || value > 10) {
          return 'Il voto deve essere tra 1 e 10';
        }
        return null;
      },
    },
  });

  useEffect(() => {
    if (entry) {
      form.setValues({
        finalGrade: Number(entry.finalGrade),
        finalGradeText: entry.finalGradeText || '',
        teacherComment: entry.teacherComment || '',
      });
    } else {
      form.reset();
    }
  }, [entry]);

  const handleSubmit = form.onSubmit(async (values) => {
    if (!entry) return;

    await onSave({
      id: entry.id,
      subjectId: entry.subjectId,
      finalGrade: values.finalGrade,
      finalGradeText: values.finalGradeText || undefined,
      teacherComment: values.teacherComment || undefined,
    });
  });

  const gradeColor = getGradeColor(form.values.finalGrade);

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <Text fw={600}>Modifica Voto</Text>
          {entry?.subject && (
            <Badge color={entry.subject.color || 'blue'} variant="light">
              {entry.subject.name}
            </Badge>
          )}
        </Group>
      }
      size="md"
    >
      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {/* Averages info */}
          {entry && (
            <Paper p="sm" withBorder radius="sm">
              <Text size="sm" fw={500} mb="xs">
                Medie calcolate:
              </Text>
              <Group gap="xl">
                <div>
                  <Text size="xs" c="dimmed">
                    Orale
                  </Text>
                  <Text size="sm" fw={500}>
                    {entry.averageOral ? Number(entry.averageOral).toFixed(2) : '-'}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Scritto
                  </Text>
                  <Text size="sm" fw={500}>
                    {entry.averageWritten ? Number(entry.averageWritten).toFixed(2) : '-'}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Pratico
                  </Text>
                  <Text size="sm" fw={500}>
                    {entry.averagePractical ? Number(entry.averagePractical).toFixed(2) : '-'}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Media Generale
                  </Text>
                  <Text size="sm" fw={600}>
                    {entry.overallAverage ? Number(entry.overallAverage).toFixed(2) : '-'}
                  </Text>
                </div>
              </Group>
            </Paper>
          )}

          <Divider />

          {/* Final grade */}
          <NumberInput
            label="Voto Finale"
            description="Voto da assegnare nella pagella (1-10)"
            min={1}
            max={10}
            step={1}
            decimalScale={0}
            required
            styles={{
              input: {
                fontSize: '1.5rem',
                fontWeight: 600,
                textAlign: 'center',
                color:
                  gradeColor === 'red'
                    ? 'var(--mantine-color-red-6)'
                    : gradeColor === 'yellow'
                    ? 'var(--mantine-color-yellow-6)'
                    : 'var(--mantine-color-green-6)',
              },
            }}
            {...form.getInputProps('finalGrade')}
          />

          {/* Text grade (for primary school) */}
          <TextInput
            label="Giudizio Sintetico (opzionale)"
            description="Es: Ottimo, Distinto, Buono, Sufficiente, Non Sufficiente"
            placeholder="Inserisci giudizio..."
            {...form.getInputProps('finalGradeText')}
          />

          {/* Teacher comment */}
          <Textarea
            label="Commento del Docente (opzionale)"
            description="Note o osservazioni per la materia"
            placeholder="Inserisci commento..."
            rows={3}
            {...form.getInputProps('teacherComment')}
          />

          <Divider />

          <Group justify="flex-end" gap="sm">
            <Button variant="light" onClick={onClose} disabled={loading}>
              Annulla
            </Button>
            <Button
              type="submit"
              loading={loading}
              leftSection={<IconCheck size={16} />}
            >
              Salva Voto
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
