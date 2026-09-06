'use client';

// Portale famiglia: le mie valutazioni (STUDENT) / valutazioni dei figli (PARENT)

import { useMemo } from 'react';
import {
  Container,
  Stack,
  Group,
  Paper,
  Table,
  Text,
  Badge,
  Alert,
  Skeleton,
  SimpleGrid,
} from '@mantine/core';
import { IconChartBar, IconInfoCircle, IconAlertTriangle } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  fetchJson,
  useChildFilter,
  ChildSelect,
  MyPageHeader,
} from '../_components/family';

interface GradeRow {
  id: string;
  value: string | number;
  weight: string | number;
  type: string;
  description: string | null;
  date: string;
  subject: { id: string; name: string; color: string | null };
  student: { id: string; firstName: string; lastName: string };
}

const TYPE_LABELS: Record<string, string> = {
  WRITTEN: 'Scritto',
  ORAL: 'Orale',
  PRACTICAL: 'Pratico',
  PROJECT: 'Progetto',
  OTHER: 'Altro',
};

function gradeColor(value: number): string {
  if (value >= 8) return 'green';
  if (value >= 6) return 'blue';
  if (value >= 5) return 'orange';
  return 'red';
}

export default function MyGradesPage() {
  const { isParent, children, selectedChildId, setSelectedChildId, childParam } =
    useChildFilter();

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-grades', selectedChildId],
    queryFn: () =>
      fetchJson<{ grades: GradeRow[] }>(`/api/grades?limit=500${childParam}`),
  });

  const grades = useMemo(() => data?.grades ?? [], [data]);

  const { overallAverage, bySubject } = useMemo(() => {
    let weightedSum = 0;
    let weightTotal = 0;
    const subjects = new Map<
      string,
      { name: string; color: string | null; sum: number; weight: number; grades: GradeRow[] }
    >();

    for (const g of grades) {
      const value = Number(g.value);
      const weight = Number(g.weight) || 1;
      if (Number.isNaN(value)) continue;
      weightedSum += value * weight;
      weightTotal += weight;

      let entry = subjects.get(g.subject.id);
      if (!entry) {
        entry = { name: g.subject.name, color: g.subject.color, sum: 0, weight: 0, grades: [] };
        subjects.set(g.subject.id, entry);
      }
      entry.sum += value * weight;
      entry.weight += weight;
      entry.grades.push(g);
    }

    return {
      overallAverage: weightTotal > 0 ? weightedSum / weightTotal : null,
      bySubject: Array.from(subjects.values()).map((s) => ({
        ...s,
        average: s.weight > 0 ? s.sum / s.weight : 0,
        // Voti già ordinati per data desc dall'API: i primi sono i più recenti
        recent: s.grades.slice(0, 5),
      })),
    };
  }, [grades]);

  const chartData = bySubject.map((s) => ({
    subject: s.name,
    media: Number(s.average.toFixed(2)),
  }));

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <MyPageHeader
          icon={<IconChartBar size="1.5rem" />}
          title="Le mie valutazioni"
          subtitle={
            isParent
              ? 'Voti e medie dei tuoi figli'
              : 'I tuoi voti e le tue medie per materia'
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
          <Skeleton height={220} radius="md" />
        ) : grades.length === 0 ? (
          <Alert color="blue" icon={<IconInfoCircle size="1rem" />}>
            Nessuna valutazione disponibile al momento.
          </Alert>
        ) : (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Paper p="md" withBorder radius="md" data-testid="my-grades-average">
                <Text size="sm" c="dimmed">
                  Media complessiva
                </Text>
                <Group gap="xs" align="baseline">
                  <Text size="2rem" fw={700}>
                    {overallAverage !== null ? overallAverage.toFixed(2) : '—'}
                  </Text>
                  <Text size="sm" c="dimmed">
                    su {grades.length} voti
                  </Text>
                </Group>
              </Paper>

              <Paper p="md" withBorder radius="md">
                <Text size="sm" c="dimmed" mb="xs">
                  Media per materia
                </Text>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="subject" tick={{ fontSize: 11 }} interval={0} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} width={24} />
                    <Tooltip />
                    <Bar dataKey="media" fill="var(--mantine-color-blue-6)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </SimpleGrid>

            <Paper withBorder radius="md" p="md">
              <Table.ScrollContainer minWidth={600}>
                <Table verticalSpacing="sm" data-testid="my-grades-table">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Materia</Table.Th>
                      <Table.Th>Media</Table.Th>
                      <Table.Th>Ultimi voti</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {bySubject.map((s) => (
                      <Table.Tr key={s.name}>
                        <Table.Td>
                          <Text fw={500}>{s.name}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={gradeColor(s.average)} variant="light" size="lg">
                            {s.average.toFixed(2)}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={6}>
                            {s.recent.map((g) => (
                              <Badge
                                key={g.id}
                                color={gradeColor(Number(g.value))}
                                variant="filled"
                                title={`${TYPE_LABELS[g.type] ?? g.type} — ${new Date(
                                  g.date
                                ).toLocaleDateString('it-IT')}${
                                  g.description ? ` — ${g.description}` : ''
                                }`}
                              >
                                {Number(g.value).toLocaleString('it-IT', {
                                  maximumFractionDigits: 2,
                                })}
                              </Badge>
                            ))}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>
          </>
        )}
      </Stack>
    </Container>
  );
}
