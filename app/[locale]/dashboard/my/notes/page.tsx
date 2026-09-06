'use client';

// Portale famiglia: note disciplinari in sola lettura

import {
  Container,
  Stack,
  Paper,
  Text,
  Badge,
  Alert,
  Skeleton,
  Group,
} from '@mantine/core';
import {
  IconClipboardText,
  IconInfoCircle,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchJson,
  useChildFilter,
  ChildSelect,
  MyPageHeader,
} from '../_components/family';

interface NoteRow {
  id: string;
  type: 'NOTE' | 'WARNING' | 'SUSPENSION' | 'POSITIVE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
  date: string;
  resolved: boolean;
  resolution?: string | null;
  student: { id: string; firstName: string; lastName: string };
  teacher?: { id: string; firstName: string; lastName: string } | null;
  class?: { id: string; name: string } | null;
}

const TYPE_META: Record<NoteRow['type'], { label: string; color: string }> = {
  NOTE: { label: 'Nota', color: 'yellow' },
  WARNING: { label: 'Ammonizione', color: 'orange' },
  SUSPENSION: { label: 'Sospensione', color: 'red' },
  POSITIVE: { label: 'Nota di merito', color: 'green' },
};

const SEVERITY_LABELS: Record<NoteRow['severity'], string> = {
  LOW: 'Lieve',
  MEDIUM: 'Media',
  HIGH: 'Grave',
  CRITICAL: 'Molto grave',
};

export default function MyNotesPage() {
  const { isParent, children, selectedChildId, setSelectedChildId, childParam } =
    useChildFilter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-disciplinary-notes', selectedChildId],
    queryFn: () =>
      fetchJson<{ data: NoteRow[] }>(`/api/disciplinary-notes?limit=100${childParam}`),
  });

  const notes = data?.data ?? [];

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <MyPageHeader
          icon={<IconClipboardText size="1.5rem" />}
          title="Note disciplinari"
          subtitle={
            isParent
              ? 'Le note disciplinari dei tuoi figli (sola lettura)'
              : 'Le tue note disciplinari (sola lettura)'
          }
          action={
            <ChildSelect
              options={children}
              value={selectedChildId}
              onChange={setSelectedChildId}
            />
          }
        />

        {error && (
          <Alert color="red" icon={<IconAlertTriangle size="1rem" />}>
            {(error as Error).message}
          </Alert>
        )}

        {isLoading ? (
          <Skeleton height={200} radius="md" />
        ) : notes.length === 0 ? (
          <Alert color="blue" icon={<IconInfoCircle size="1rem" />}>
            Nessuna nota disciplinare. Ottimo!
          </Alert>
        ) : (
          <Stack gap="sm" data-testid="my-notes-list">
            {notes.map((note) => (
              <Paper key={note.id} p="md" withBorder radius="md">
                <Group justify="space-between" wrap="wrap" align="flex-start">
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <Group gap="xs" mb={4}>
                      <Badge color={TYPE_META[note.type]?.color ?? 'gray'} variant="filled">
                        {TYPE_META[note.type]?.label ?? note.type}
                      </Badge>
                      {note.type !== 'POSITIVE' && (
                        <Badge color="gray" variant="light">
                          Gravità: {SEVERITY_LABELS[note.severity] ?? note.severity}
                        </Badge>
                      )}
                      {note.resolved && (
                        <Badge color="teal" variant="light">
                          Risolta
                        </Badge>
                      )}
                    </Group>
                    <Text fw={600}>{note.title}</Text>
                    <Text size="sm" mt={4} style={{ whiteSpace: 'pre-wrap' }}>
                      {note.description}
                    </Text>
                    {note.resolution && (
                      <Text size="sm" c="teal" mt={4}>
                        Risoluzione: {note.resolution}
                      </Text>
                    )}
                  </div>
                  <Stack gap={2} align="flex-end">
                    <Text size="sm" fw={500}>
                      {note.student.firstName} {note.student.lastName}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {new Date(note.date).toLocaleDateString('it-IT')}
                      {note.class?.name ? ` · ${note.class.name}` : ''}
                    </Text>
                    {note.teacher && (
                      <Text size="xs" c="dimmed">
                        {note.teacher.firstName} {note.teacher.lastName}
                      </Text>
                    )}
                  </Stack>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
