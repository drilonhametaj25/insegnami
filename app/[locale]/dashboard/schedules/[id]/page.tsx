'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import {
  Container,
  Title,
  Text,
  Paper,
  Button,
  Group,
  Stack,
  LoadingOverlay,
  Alert,
  Badge,
  Select,
  SegmentedControl,
  Card,
  Grid,
  Table,
  ScrollArea,
  Tooltip,
  ThemeIcon,
  Progress,
  Divider,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import {
  IconArrowLeft,
  IconInfoCircle,
  IconRocket,
  IconPlayerPlay,
  IconCheck,
  IconX,
  IconCalendarEvent,
  IconUsers,
  IconSchool,
  IconClock,
  IconChartBar,
  IconDownload,
} from '@tabler/icons-react';

interface ScheduleSlot {
  id: string;
  dayOfWeek: number;
  slotNumber: number;
  startTime: string;
  endTime: string;
  room: string | null;
  score: number | null;
  class: {
    id: string;
    name: string;
    year: number;
    section: string;
  };
  subject: {
    id: string;
    name: string;
    code: string;
  };
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface Schedule {
  id: string;
  name: string;
  status: 'DRAFT' | 'GENERATED' | 'APPLIED' | 'ARCHIVED';
  startDate: string;
  endDate: string;
  score: number | null;
  generatedAt: string | null;
  appliedAt: string | null;
  createdAt: string;
  academicYear: {
    id: string;
    name: string;
  };
  slots: ScheduleSlot[];
  stats?: {
    totalSlots: number;
    slotsGenerated: number;
    generationTimeMs: number;
    optimizationTimeMs: number;
    backtrackingSteps: number;
  };
}

const DAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì'];
const DAY_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven'];

const StatusBadge = ({ status }: { status: Schedule['status'] }) => {
  const config = {
    DRAFT: { color: 'gray', label: 'Bozza' },
    GENERATED: { color: 'blue', label: 'Generato' },
    APPLIED: { color: 'green', label: 'Applicato' },
    ARCHIVED: { color: 'orange', label: 'Archiviato' },
  };
  return (
    <Badge color={config[status].color} variant="filled" size="lg">
      {config[status].label}
    </Badge>
  );
};

// Color mapping for subjects (consistent colors)
const getSubjectColor = (subjectId: string) => {
  const colors = [
    '#667eea', '#f093fb', '#43e97b', '#fa709a', '#4facfe',
    '#ff9a9e', '#a8edea', '#fed6e3', '#ffecd2', '#d299c2',
  ];
  // Simple hash to get consistent color
  let hash = 0;
  for (let i = 0; i < subjectId.length; i++) {
    hash = subjectId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function ScheduleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const { data: session } = useSession();
  const scheduleId = params.id as string;

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [viewMode, setViewMode] = useState<'class' | 'teacher'>('class');
  const [filterValue, setFilterValue] = useState<string | null>(null);

  const canManage =
    session?.user?.role === 'ADMIN' ||
    session?.user?.role === 'DIRECTOR' ||
    session?.user?.role === 'SUPERADMIN';

  // Fetch schedule
  const fetchSchedule = async () => {
    try {
      const response = await fetch(`/api/schedules/${scheduleId}`);
      if (!response.ok) throw new Error('Failed to fetch schedule');

      const data = await response.json();
      setSchedule(data);
    } catch (error) {
      console.error('Error fetching schedule:', error);
      notifications.show({
        title: 'Errore',
        message: 'Impossibile caricare l\'orario',
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [scheduleId]);

  // Get unique classes and teachers for filters
  const { classes, teachers } = useMemo(() => {
    if (!schedule) return { classes: [], teachers: [] };

    const classesMap = new Map();
    const teachersMap = new Map();

    schedule.slots.forEach((slot) => {
      if (!classesMap.has(slot.class.id)) {
        classesMap.set(slot.class.id, slot.class);
      }
      if (!teachersMap.has(slot.teacher.id)) {
        teachersMap.set(slot.teacher.id, slot.teacher);
      }
    });

    return {
      classes: Array.from(classesMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
      teachers: Array.from(teachersMap.values()).sort((a, b) =>
        `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)
      ),
    };
  }, [schedule]);

  // Set default filter when data loads
  useEffect(() => {
    if (!filterValue && classes.length > 0) {
      setFilterValue(classes[0].id);
    }
  }, [classes, filterValue]);

  // Get time slots from schedule
  const timeSlots = useMemo(() => {
    if (!schedule) return [];

    const slotsMap = new Map<number, { startTime: string; endTime: string }>();
    schedule.slots.forEach((slot) => {
      if (!slotsMap.has(slot.slotNumber)) {
        slotsMap.set(slot.slotNumber, {
          startTime: slot.startTime,
          endTime: slot.endTime,
        });
      }
    });

    return Array.from(slotsMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([num, times]) => ({ slotNumber: num, ...times }));
  }, [schedule]);

  // Filter slots based on view mode and filter
  const filteredSlots = useMemo(() => {
    if (!schedule || !filterValue) return [];

    if (viewMode === 'class') {
      return schedule.slots.filter((slot) => slot.class.id === filterValue);
    } else {
      return schedule.slots.filter((slot) => slot.teacher.id === filterValue);
    }
  }, [schedule, viewMode, filterValue, filterValue]);

  // Generate grid data
  const gridData = useMemo(() => {
    const grid: Map<string, ScheduleSlot> = new Map();

    filteredSlots.forEach((slot) => {
      const key = `${slot.dayOfWeek}-${slot.slotNumber}`;
      grid.set(key, slot);
    });

    return grid;
  }, [filteredSlots]);

  // Generate schedule
  const handleGenerate = async () => {
    setGenerating(true);
    try {
      notifications.show({
        id: 'generating',
        title: 'Generazione in corso...',
        message: 'Sto generando l\'orario ottimale',
        loading: true,
        autoClose: false,
        withCloseButton: false,
      });

      const response = await fetch(`/api/schedules/${scheduleId}/generate`, {
        method: 'POST',
      });

      notifications.hide('generating');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Generazione fallita');
      }

      notifications.show({
        title: data.success ? 'Orario Generato!' : 'Generazione parziale',
        message: `Score: ${data.score}/100 - ${data.slotsGenerated} slot`,
        color: data.success ? 'green' : 'yellow',
        icon: data.success ? <IconCheck size={18} /> : <IconInfoCircle size={18} />,
      });

      fetchSchedule();
    } catch (error: any) {
      notifications.hide('generating');
      notifications.show({
        title: 'Errore',
        message: error.message,
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setGenerating(false);
    }
  };

  // Apply schedule
  const handleApply = () => {
    modals.openConfirmModal({
      title: 'Applica Orario',
      children: (
        <Text size="sm">
          Vuoi applicare questo orario? Verranno create le lezioni nel calendario.
        </Text>
      ),
      labels: { confirm: 'Applica', cancel: 'Annulla' },
      confirmProps: { color: 'green' },
      onConfirm: async () => {
        setApplying(true);
        try {
          const response = await fetch(`/api/schedules/${scheduleId}/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ weekCount: 4 }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error);
          }

          notifications.show({
            title: 'Orario Applicato!',
            message: data.message,
            color: 'green',
            icon: <IconCheck size={18} />,
          });

          fetchSchedule();
        } catch (error: any) {
          notifications.show({
            title: 'Errore',
            message: error.message,
            color: 'red',
            icon: <IconX size={18} />,
          });
        } finally {
          setApplying(false);
        }
      },
    });
  };

  if (loading) {
    return (
      <Container size="xl" py="md">
        <LoadingOverlay visible />
      </Container>
    );
  }

  if (!schedule) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconInfoCircle />} color="red">
          Orario non trovato
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      {/* Header */}
      <Group justify="space-between" mb="xl">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={18} />}
            onClick={() => router.push(`/${locale}/dashboard/schedules`)}
          >
            Indietro
          </Button>
          <div>
            <Group gap="sm" mb={4}>
              <Title order={2}>{schedule.name}</Title>
              <StatusBadge status={schedule.status} />
            </Group>
            <Text c="dimmed">
              {schedule.academicYear.name} •{' '}
              {new Date(schedule.startDate).toLocaleDateString('it-IT')} -{' '}
              {new Date(schedule.endDate).toLocaleDateString('it-IT')}
            </Text>
          </div>
        </Group>

        <Group>
          {schedule.status === 'DRAFT' && canManage && (
            <Button
              leftSection={<IconRocket size={18} />}
              loading={generating}
              onClick={handleGenerate}
              variant="gradient"
              gradient={{ from: 'indigo', to: 'purple' }}
            >
              Genera Orario
            </Button>
          )}
          {schedule.status === 'GENERATED' && canManage && (
            <>
              <Button
                variant="light"
                leftSection={<IconRocket size={18} />}
                loading={generating}
                onClick={handleGenerate}
              >
                Rigenera
              </Button>
              <Button
                leftSection={<IconPlayerPlay size={18} />}
                loading={applying}
                onClick={handleApply}
                color="green"
              >
                Applica Orario
              </Button>
            </>
          )}
        </Group>
      </Group>

      {/* Stats */}
      {schedule.score !== null && (
        <Grid mb="xl">
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder radius="md" p="md">
              <Group>
                <ThemeIcon size="lg" variant="light" color="blue">
                  <IconChartBar size={20} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Score
                  </Text>
                  <Group gap="xs">
                    <Text fw={700} size="xl">
                      {schedule.score}
                    </Text>
                    <Text c="dimmed">/100</Text>
                  </Group>
                  <Progress
                    value={schedule.score}
                    size="sm"
                    color={
                      schedule.score >= 80
                        ? 'green'
                        : schedule.score >= 60
                        ? 'yellow'
                        : 'red'
                    }
                    mt={4}
                  />
                </div>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder radius="md" p="md">
              <Group>
                <ThemeIcon size="lg" variant="light" color="indigo">
                  <IconCalendarEvent size={20} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Slot Generati
                  </Text>
                  <Text fw={700} size="xl">
                    {schedule.slots.length}
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder radius="md" p="md">
              <Group>
                <ThemeIcon size="lg" variant="light" color="green">
                  <IconSchool size={20} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Classi
                  </Text>
                  <Text fw={700} size="xl">
                    {classes.length}
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card withBorder radius="md" p="md">
              <Group>
                <ThemeIcon size="lg" variant="light" color="orange">
                  <IconUsers size={20} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Insegnanti
                  </Text>
                  <Text fw={700} size="xl">
                    {teachers.length}
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
        </Grid>
      )}

      {/* Schedule Grid */}
      {schedule.slots.length > 0 && (
        <Paper shadow="sm" radius="lg" p="md">
          {/* Filters */}
          <Group justify="space-between" mb="md">
            <SegmentedControl
              value={viewMode}
              onChange={(value) => {
                setViewMode(value as 'class' | 'teacher');
                setFilterValue(null);
              }}
              data={[
                { value: 'class', label: 'Per Classe' },
                { value: 'teacher', label: 'Per Insegnante' },
              ]}
            />

            <Select
              placeholder={viewMode === 'class' ? 'Seleziona classe' : 'Seleziona insegnante'}
              value={filterValue}
              onChange={setFilterValue}
              data={
                viewMode === 'class'
                  ? classes.map((c) => ({ value: c.id, label: c.name }))
                  : teachers.map((t) => ({
                      value: t.id,
                      label: `${t.lastName} ${t.firstName}`,
                    }))
              }
              style={{ minWidth: 200 }}
            />
          </Group>

          <Divider mb="md" />

          {/* Grid Table */}
          <ScrollArea>
            <Table withTableBorder withColumnBorders striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 80 }}>Ora</Table.Th>
                  {DAYS.map((day, idx) => (
                    <Table.Th key={idx} style={{ textAlign: 'center', minWidth: 150 }}>
                      {day}
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {timeSlots.map((timeSlot) => (
                  <Table.Tr key={timeSlot.slotNumber}>
                    <Table.Td>
                      <Stack gap={0}>
                        <Text size="sm" fw={500}>
                          {timeSlot.slotNumber}ª ora
                        </Text>
                        <Text size="xs" c="dimmed">
                          {timeSlot.startTime}-{timeSlot.endTime}
                        </Text>
                      </Stack>
                    </Table.Td>
                    {[1, 2, 3, 4, 5].map((day) => {
                      const slot = gridData.get(`${day}-${timeSlot.slotNumber}`);

                      if (!slot) {
                        return (
                          <Table.Td
                            key={day}
                            style={{ textAlign: 'center', background: '#f8f9fa' }}
                          >
                            <Text size="xs" c="dimmed">
                              -
                            </Text>
                          </Table.Td>
                        );
                      }

                      return (
                        <Table.Td key={day} style={{ padding: 4 }}>
                          <Tooltip
                            label={
                              <Stack gap={2}>
                                <Text size="xs">
                                  <strong>Materia:</strong> {slot.subject.name}
                                </Text>
                                <Text size="xs">
                                  <strong>Insegnante:</strong> {slot.teacher.lastName}{' '}
                                  {slot.teacher.firstName}
                                </Text>
                                <Text size="xs">
                                  <strong>Classe:</strong> {slot.class.name}
                                </Text>
                                {slot.room && (
                                  <Text size="xs">
                                    <strong>Aula:</strong> {slot.room}
                                  </Text>
                                )}
                              </Stack>
                            }
                            multiline
                            w={220}
                          >
                            <Card
                              p="xs"
                              radius="sm"
                              style={{
                                backgroundColor: getSubjectColor(slot.subject.id) + '20',
                                borderLeft: `3px solid ${getSubjectColor(slot.subject.id)}`,
                                cursor: 'pointer',
                              }}
                            >
                              <Text size="sm" fw={600} lineClamp={1}>
                                {slot.subject.name}
                              </Text>
                              <Text size="xs" c="dimmed" lineClamp={1}>
                                {viewMode === 'class'
                                  ? `${slot.teacher.lastName}`
                                  : `${slot.class.name}`}
                              </Text>
                            </Card>
                          </Tooltip>
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}

      {/* Empty State */}
      {schedule.slots.length === 0 && (
        <Paper shadow="sm" radius="lg" p="xl">
          <Stack align="center" gap="md">
            <ThemeIcon size={60} radius="xl" variant="light" color="gray">
              <IconCalendarEvent size={30} />
            </ThemeIcon>
            <Title order={3}>Orario non ancora generato</Title>
            <Text c="dimmed" ta="center" maw={400}>
              Clicca su "Genera Orario" per creare automaticamente l'orario scolastico
              ottimale basato sui vincoli configurati.
            </Text>
            {canManage && (
              <Button
                leftSection={<IconRocket size={18} />}
                onClick={handleGenerate}
                loading={generating}
              >
                Genera Orario
              </Button>
            )}
          </Stack>
        </Paper>
      )}
    </Container>
  );
}
