'use client';

// Portale famiglia: materiali didattici delle proprie classi

import { useState, useEffect, useMemo } from 'react';
import {
  Container,
  Stack,
  Paper,
  Table,
  Text,
  Alert,
  Skeleton,
  Select,
  Button,
  Group,
  Badge,
} from '@mantine/core';
import {
  IconFolder,
  IconInfoCircle,
  IconAlertTriangle,
  IconDownload,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { fetchJson, useChildFilter, MyPageHeader } from '../_components/family';

interface ClassRow {
  id: string;
  name: string;
  code: string;
  course?: { id: string; name: string } | null;
}

interface MaterialRow {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  filePath: string;
  mimeType?: string | null;
  fileSize: number;
  uploadedAt: string;
  lesson?: { id: string; title: string | null; date: string } | null;
}

function formatSize(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MyMaterialsPage() {
  const { isParent } = useChildFilter();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const classesQuery = useQuery({
    queryKey: ['my-classes'],
    queryFn: () => fetchJson<{ classes: ClassRow[] }>('/api/classes?limit=100'),
  });

  const classes = useMemo(
    () => classesQuery.data?.classes ?? [],
    [classesQuery.data]
  );

  // Selezione automatica della prima classe disponibile
  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  const materialsQuery = useQuery({
    queryKey: ['my-class-materials', selectedClassId],
    queryFn: () =>
      fetchJson<{ materials: MaterialRow[] }>(
        `/api/classes/${selectedClassId}/materials`
      ),
    enabled: !!selectedClassId,
  });

  const materials = materialsQuery.data?.materials ?? [];

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <MyPageHeader
          icon={<IconFolder size="1.5rem" />}
          title="Materiali didattici"
          subtitle={
            isParent
              ? 'I materiali condivisi nelle classi dei tuoi figli'
              : 'I materiali condivisi nelle tue classi'
          }
          action={
            classes.length > 1 ? (
              <Select
                data-testid="my-materials-class-select"
                label="Classe"
                value={selectedClassId}
                onChange={setSelectedClassId}
                data={classes.map((c) => ({
                  value: c.id,
                  label: c.course?.name ? `${c.name} · ${c.course.name}` : c.name,
                }))}
                w={{ base: '100%', sm: 280 }}
              />
            ) : undefined
          }
        />

        {classesQuery.error && (
          <Alert color="red" icon={<IconAlertTriangle size="1rem" />}>
            {(classesQuery.error as Error).message}
          </Alert>
        )}

        {classesQuery.isLoading ? (
          <Skeleton height={200} radius="md" />
        ) : classes.length === 0 ? (
          <Alert color="blue" icon={<IconInfoCircle size="1rem" />}>
            Nessuna classe disponibile.
          </Alert>
        ) : materialsQuery.isLoading ? (
          <Skeleton height={200} radius="md" />
        ) : materialsQuery.error ? (
          <Alert color="orange" icon={<IconInfoCircle size="1rem" />}>
            Materiali non disponibili per questa classe:{' '}
            {(materialsQuery.error as Error).message}
          </Alert>
        ) : materials.length === 0 ? (
          <Alert color="blue" icon={<IconInfoCircle size="1rem" />}>
            Nessun materiale condiviso per questa classe.
          </Alert>
        ) : (
          <Paper withBorder radius="md" p="md">
            <Table.ScrollContainer minWidth={640}>
              <Table verticalSpacing="sm" data-testid="my-materials-table">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nome</Table.Th>
                    <Table.Th>Lezione</Table.Th>
                    <Table.Th>Dimensione</Table.Th>
                    <Table.Th>Caricato il</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {materials.map((m) => (
                    <Table.Tr key={m.id}>
                      <Table.Td>
                        <Text fw={500}>{m.name}</Text>
                        {m.description && (
                          <Text size="xs" c="dimmed">
                            {m.description}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {m.lesson ? (
                          <Group gap={4}>
                            <Text size="sm">{m.lesson.title ?? 'Lezione'}</Text>
                            <Badge variant="light" color="gray" size="sm">
                              {new Date(m.lesson.date).toLocaleDateString('it-IT')}
                            </Badge>
                          </Group>
                        ) : (
                          '—'
                        )}
                      </Table.Td>
                      <Table.Td>{formatSize(m.fileSize)}</Table.Td>
                      <Table.Td>
                        {new Date(m.uploadedAt).toLocaleDateString('it-IT')}
                      </Table.Td>
                      <Table.Td>
                        <Button
                          data-testid="my-material-download"
                          component="a"
                          href={m.filePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          size="xs"
                          variant="light"
                          leftSection={<IconDownload size="1rem" />}
                        >
                          Scarica
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
        )}
      </Stack>
    </Container>
  );
}
