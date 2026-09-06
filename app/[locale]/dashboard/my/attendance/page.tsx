'use client';

// Portale famiglia: riepilogo presenze/assenze/ritardi (sola lettura)
// + richiesta giustificazione assenze (feature 'absenceJustifications')

import { useMemo, useState } from 'react';
import {
  Container,
  Stack,
  Paper,
  Table,
  Text,
  Badge,
  Alert,
  Skeleton,
  SimpleGrid,
  Group,
  Button,
  Modal,
  Textarea,
  Select,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCalendarCheck,
  IconInfoCircle,
  IconAlertTriangle,
  IconFileCheck,
} from '@tabler/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchJson,
  useChildFilter,
  ChildSelect,
  MyPageHeader,
} from '../_components/family';

interface AttendanceRow {
  id: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  notes?: string | null;
  lesson: {
    id: string;
    title: string | null;
    startTime: string;
    endTime: string;
    class?: { id: string; name: string; course?: { id: string; name: string } | null } | null;
  };
}

interface JustificationRow {
  id: string;
  dateFrom: string;
  dateTo: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  student?: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
}

const STATUS_META: Record<AttendanceRow['status'], { label: string; color: string }> = {
  PRESENT: { label: 'Presente', color: 'green' },
  ABSENT: { label: 'Assente', color: 'red' },
  LATE: { label: 'In ritardo', color: 'orange' },
  EXCUSED: { label: 'Giustificato', color: 'blue' },
};

const JUSTIFICATION_META: Record<JustificationRow['status'], { label: string; color: string }> = {
  PENDING: { label: 'In attesa', color: 'yellow' },
  APPROVED: { label: 'Approvata', color: 'green' },
  REJECTED: { label: 'Rifiutata', color: 'red' },
};

export default function MyAttendancePage() {
  const { isParent, isStudent, children, selectedChildId, setSelectedChildId, childParam } =
    useChildFilter();

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-attendance', selectedChildId],
    queryFn: () =>
      fetchJson<{ attendance: AttendanceRow[] }>(
        `/api/attendance?page=1&limit=200${childParam}`
      ),
  });

  // Giustificazioni proprie/dei figli. Se la feature non è nel piano la GET
  // risponde 403: la sezione resta semplicemente nascosta.
  const justificationsQuery = useQuery({
    queryKey: ['absence-justifications', 'my'],
    queryFn: () =>
      fetchJson<{ data: JustificationRow[] }>('/api/absence-justifications?limit=50'),
    retry: false,
  });
  const justifications = justificationsQuery.data?.data ?? [];

  // Modale richiesta giustificazione
  const [justifyOpened, { open: openJustify, close: closeJustify }] = useDisclosure(false);
  const [justifyRange, setJustifyRange] = useState<[Date | null, Date | null]>([null, null]);
  const [justifyReason, setJustifyReason] = useState('');
  const [justifyChildId, setJustifyChildId] = useState<string | null>(null);

  const submitJustification = useMutation({
    mutationFn: async () => {
      const [from, to] = justifyRange;
      const response = await fetch('/api/absence-justifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: isParent ? justifyChildId ?? selectedChildId ?? undefined : undefined,
          dateFrom: from?.toISOString(),
          dateTo: (to ?? from)?.toISOString(),
          reason: justifyReason.trim(),
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Errore nell\'invio della giustificazione');
      }
      return response.json();
    },
    onSuccess: () => {
      notifications.show({
        title: 'Richiesta inviata',
        message: 'La giustificazione è stata inviata e verrà valutata dalla scuola',
        color: 'green',
      });
      closeJustify();
      setJustifyRange([null, null]);
      setJustifyReason('');
      setJustifyChildId(null);
      queryClient.invalidateQueries({ queryKey: ['absence-justifications'] });
    },
    onError: (err: Error) => {
      notifications.show({
        title: 'Errore',
        message: err.message,
        color: 'red',
      });
    },
  });

  const canSubmitJustification =
    Boolean(justifyRange[0]) &&
    justifyReason.trim().length >= 3 &&
    (!isParent || children.length <= 1 || Boolean(justifyChildId ?? selectedChildId));

  const records = useMemo(() => data?.attendance ?? [], [data]);

  // Statistiche calcolate client-side
  const stats = useMemo(() => {
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const r of records) {
      if (counts[r.status] !== undefined) counts[r.status] += 1;
    }
    const total = records.length;
    const attended = counts.PRESENT + counts.LATE;
    return {
      ...counts,
      total,
      rate: total > 0 ? Math.round((attended / total) * 100) : null,
    };
  }, [records]);

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <MyPageHeader
          icon={<IconCalendarCheck size="1.5rem" />}
          title="Presenze"
          subtitle={
            isParent
              ? 'Presenze, assenze e ritardi dei tuoi figli'
              : 'Le tue presenze, assenze e ritardi'
          }
          action={
            <Group gap="sm" wrap="wrap">
              <ChildSelect
                options={children}
                value={selectedChildId}
                onChange={setSelectedChildId}
              />
              {(isParent || isStudent) && (
                <Button
                  leftSection={<IconFileCheck size={16} />}
                  variant="light"
                  onClick={openJustify}
                  data-testid="giustificazioni-richiedi"
                >
                  Giustifica assenza
                </Button>
              )}
            </Group>
          }
        />

        {error && (
          <Alert color="red" icon={<IconAlertTriangle size="1rem" />}>
            {(error as Error).message}
          </Alert>
        )}

        {isLoading ? (
          <Skeleton height={220} radius="md" />
        ) : records.length === 0 ? (
          <Alert color="blue" icon={<IconInfoCircle size="1rem" />}>
            Nessuna presenza registrata al momento.
          </Alert>
        ) : (
          <>
            <SimpleGrid
              cols={{ base: 2, sm: 5 }}
              spacing="md"
              data-testid="my-attendance-stats"
            >
              <Paper p="md" withBorder radius="md">
                <Text size="xl" fw={700}>
                  {stats.rate !== null ? `${stats.rate}%` : '—'}
                </Text>
                <Text size="sm" c="dimmed">
                  Frequenza
                </Text>
              </Paper>
              {(Object.keys(STATUS_META) as AttendanceRow['status'][]).map((s) => (
                <Paper key={s} p="md" withBorder radius="md">
                  <Text size="xl" fw={700} c={STATUS_META[s].color}>
                    {stats[s]}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {STATUS_META[s].label}
                  </Text>
                </Paper>
              ))}
            </SimpleGrid>

            <Paper withBorder radius="md" p="md">
              <Table.ScrollContainer minWidth={640}>
                <Table verticalSpacing="sm" data-testid="my-attendance-table">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Data</Table.Th>
                      <Table.Th>Lezione</Table.Th>
                      <Table.Th>Classe</Table.Th>
                      <Table.Th>Stato</Table.Th>
                      <Table.Th>Note</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {records.map((r) => (
                      <Table.Tr key={r.id}>
                        <Table.Td>
                          <Group gap={4}>
                            <Text size="sm">
                              {new Date(r.lesson.startTime).toLocaleDateString('it-IT')}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {new Date(r.lesson.startTime).toLocaleTimeString('it-IT', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>{r.lesson.title ?? '—'}</Table.Td>
                        <Table.Td>{r.lesson.class?.name ?? '—'}</Table.Td>
                        <Table.Td>
                          <Badge color={STATUS_META[r.status].color} variant="light">
                            {STATUS_META[r.status].label}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {r.notes ?? ''}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>
          </>
        )}

        {/* Storico giustificazioni inviate */}
        {justifications.length > 0 && (
          <Paper withBorder radius="md" p="md" data-testid="giustificazioni-storico">
            <Text fw={600} mb="sm">
              Giustificazioni inviate
            </Text>
            <Table.ScrollContainer minWidth={520}>
              <Table verticalSpacing="sm">
                <Table.Thead>
                  <Table.Tr>
                    {isParent && <Table.Th>Figlio</Table.Th>}
                    <Table.Th>Periodo</Table.Th>
                    <Table.Th>Motivo</Table.Th>
                    <Table.Th>Stato</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {justifications.map((j) => (
                    <Table.Tr key={j.id}>
                      {isParent && (
                        <Table.Td>
                          {j.student ? `${j.student.firstName} ${j.student.lastName}` : '—'}
                        </Table.Td>
                      )}
                      <Table.Td>
                        {new Date(j.dateFrom).toLocaleDateString('it-IT')}
                        {' – '}
                        {new Date(j.dateTo).toLocaleDateString('it-IT')}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={1}>
                          {j.reason}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={JUSTIFICATION_META[j.status].color} variant="light">
                          {JUSTIFICATION_META[j.status].label}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
        )}
      </Stack>

      {/* Modale richiesta giustificazione */}
      <Modal
        opened={justifyOpened}
        onClose={closeJustify}
        title="Giustifica assenza"
        size="md"
      >
        <Stack gap="md">
          {isParent && children.length > 1 && (
            <Select
              label="Figlio"
              placeholder="Seleziona il figlio"
              required
              data={children.map((c) => ({
                value: c.id,
                label: `${c.firstName} ${c.lastName}`,
              }))}
              value={justifyChildId ?? selectedChildId}
              onChange={setJustifyChildId}
              data-testid="giustificazioni-figlio"
            />
          )}

          <DatePickerInput
            type="range"
            label="Periodo dell'assenza"
            placeholder="Seleziona le date"
            required
            allowSingleDateInRange
            value={justifyRange}
            onChange={setJustifyRange}
            data-testid="giustificazioni-periodo"
          />

          <Textarea
            label="Motivo"
            placeholder="Es. malattia, visita medica..."
            required
            minRows={3}
            value={justifyReason}
            onChange={(e) => setJustifyReason(e.currentTarget.value)}
            data-testid="giustificazioni-motivo"
          />

          <Group justify="flex-end" mt="sm">
            <Button variant="light" onClick={closeJustify}>
              Annulla
            </Button>
            <Button
              onClick={() => submitJustification.mutate()}
              loading={submitJustification.isPending}
              disabled={!canSubmitJustification}
              data-testid="giustificazioni-invia"
            >
              Invia richiesta
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
