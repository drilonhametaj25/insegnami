'use client';

import { useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import {
  Container,
  Title,
  Grid,
  Paper,
  Button,
  Group,
  Stack,
  Card,
  Text,
  Badge,
  LoadingOverlay,
  Skeleton,
  Alert,
} from '@mantine/core';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import {
  IconCalendar,
  IconClipboardCheck,
  IconBook,
  IconClock,
  IconInfoCircle,
  IconChecklist,
} from '@tabler/icons-react';

import { StatsCard } from '@/components/cards/StatsCard';
import { useCalendarLessons } from '@/lib/hooks/useLessons';
import { useTeacherDashboard } from '@/lib/hooks/useDashboard';

const localizer = momentLocalizer(moment);

/** Formatta una data come YYYY-MM-DD per i filtri dell'API lezioni. */
function toDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'blue',
  IN_PROGRESS: 'yellow',
  COMPLETED: 'green',
  CANCELLED: 'gray',
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Programmata',
  IN_PROGRESS: 'In corso',
  COMPLETED: 'Completata',
  CANCELLED: 'Annullata',
};

export default function TeacherDashboard() {
  const { data: session } = useSession();
  const locale = useLocale();

  // Mese visualizzato nel calendario (guida startDate/endDate della query)
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());
  const monthRange = useMemo(() => {
    const start = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
    const end = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
    return { start: toDateParam(start), end: toDateParam(end) };
  }, [calendarDate]);

  const {
    data: dashboardResponse,
    isLoading: dashboardLoading,
    error: dashboardError,
  } = useTeacherDashboard();

  // Lo scoping docente è server-side: niente filtri client su teacher.id
  const {
    data: calendarLessons,
    isLoading: calendarLoading,
    error: calendarError,
  } = useCalendarLessons(monthRange.start, monthRange.end);

  if (!session?.user) {
    return (
      <Container size="xl" py="md">
        <LoadingOverlay visible />
      </Container>
    );
  }

  const dashboard = dashboardResponse?.data;
  const todayLessons = dashboard?.todayLessons ?? [];
  const pendingAttendance = dashboard?.pendingAttendance ?? [];
  const upcomingHomework = dashboard?.upcomingHomework ?? [];
  const weekLessonsCount = dashboard?.weekLessonsCount ?? 0;

  const calendarEvents = (calendarLessons ?? []).map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    start: new Date(lesson.startTime),
    end: new Date(lesson.endTime),
    resource: lesson,
  }));

  const stats = [
    {
      title: 'Lezioni di oggi',
      value: todayLessons.length,
      icon: <IconCalendar size={24} />,
      color: 'green',
    },
    {
      title: 'Presenze da registrare',
      value: pendingAttendance.length,
      icon: <IconClipboardCheck size={24} />,
      color: 'orange',
    },
    {
      title: 'Lezioni questa settimana',
      value: weekLessonsCount,
      icon: <IconBook size={24} />,
      color: 'blue',
    },
    {
      title: 'Compiti in scadenza',
      value: upcomingHomework.length,
      icon: <IconChecklist size={24} />,
      color: 'violet',
    },
  ];

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <div>
            <Title order={1}>Dashboard Docente</Title>
            <Text c="dimmed" size="sm" mt="xs">
              Benvenuto, {session.user?.firstName || ''} {session.user?.lastName || ''}
            </Text>
          </div>
        </Group>

        {dashboardError ? (
          <Alert color="red" icon={<IconInfoCircle size={16} />}>
            Errore nel caricamento della dashboard: {(dashboardError as Error).message}
          </Alert>
        ) : null}

        {/* Statistiche */}
        <Grid>
          {stats.map((stat, index) => (
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }} key={index}>
              {dashboardLoading ? <Skeleton height={120} /> : <StatsCard {...stat} />}
            </Grid.Col>
          ))}
        </Grid>

        <Grid>
          {/* Lezioni di oggi */}
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Paper p="md" withBorder>
              <Group justify="space-between" align="center" mb="md">
                <Title order={3}>Lezioni di oggi</Title>
                <Badge color="blue">{todayLessons.length} lezioni</Badge>
              </Group>

              {dashboardLoading ? (
                <Stack gap="sm">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} height={80} />
                  ))}
                </Stack>
              ) : todayLessons.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  Nessuna lezione programmata per oggi
                </Text>
              ) : (
                <Stack gap="sm">
                  {todayLessons.map((lesson) => (
                    <Card key={lesson.id} p="sm" withBorder>
                      <Group justify="space-between" align="flex-start">
                        <div>
                          <Text fw={500}>{lesson.title}</Text>
                          <Group gap="xs" mt="xs">
                            <IconClock size={14} />
                            <Text size="sm" c="dimmed">
                              {moment(lesson.startTime).format('HH:mm')} -{' '}
                              {moment(lesson.endTime).format('HH:mm')}
                            </Text>
                          </Group>
                          <Text size="sm" c="dimmed" mt="xs">
                            Classe: {lesson.class?.name || 'N/D'}
                          </Text>
                        </div>
                        <Stack gap="xs" align="flex-end">
                          <Badge
                            color={STATUS_COLORS[lesson.status] || 'gray'}
                            variant="light"
                          >
                            {STATUS_LABELS[lesson.status] || lesson.status}
                          </Badge>
                          {(lesson._count?.attendance ?? 0) > 0 && (
                            <Badge color="green" variant="outline" size="sm">
                              {lesson._count?.attendance} presenze registrate
                            </Badge>
                          )}
                          <Button
                            component={Link}
                            href={`/${locale}/dashboard/lessons/${lesson.id}`}
                            size="xs"
                            variant="light"
                            data-testid="teacher-registro"
                          >
                            Registro
                          </Button>
                        </Stack>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              )}
            </Paper>
          </Grid.Col>

          {/* Presenze da registrare */}
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Paper p="md" withBorder>
              <Group justify="space-between" align="center" mb="md">
                <Title order={3}>Presenze da registrare</Title>
                <Badge color="orange">{pendingAttendance.length}</Badge>
              </Group>

              {dashboardLoading ? (
                <Skeleton height={200} />
              ) : pendingAttendance.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  Nessun appello in sospeso nelle ultime 2 settimane
                </Text>
              ) : (
                <Stack gap="sm">
                  {pendingAttendance.map((lesson) => (
                    <Group key={lesson.id} justify="space-between" wrap="nowrap">
                      <div style={{ minWidth: 0 }}>
                        <Text size="sm" fw={500} truncate>
                          {lesson.title}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {lesson.class?.name || 'N/D'} ·{' '}
                          {moment(lesson.startTime).format('DD/MM/YYYY HH:mm')}
                        </Text>
                      </div>
                      <Button
                        component={Link}
                        href={`/${locale}/dashboard/lessons/${lesson.id}`}
                        size="xs"
                        variant="light"
                        color="orange"
                        data-testid="teacher-registra-presenze"
                      >
                        Registro
                      </Button>
                    </Group>
                  ))}
                </Stack>
              )}
            </Paper>

            {/* Compiti in scadenza */}
            <Paper p="md" withBorder mt="md">
              <Title order={4} mb="md">
                Compiti in scadenza
              </Title>
              {dashboardLoading ? (
                <Skeleton height={120} />
              ) : upcomingHomework.length === 0 ? (
                <Text c="dimmed" ta="center" py="md" size="sm">
                  Nessun compito con scadenza futura
                </Text>
              ) : (
                <Stack gap="xs">
                  {upcomingHomework.map((hw) => (
                    <Group key={hw.id} justify="space-between" wrap="nowrap">
                      <div style={{ minWidth: 0 }}>
                        <Text size="sm" fw={500} truncate>
                          {hw.title}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {hw.class?.name || 'N/D'}
                          {hw.subject?.name ? ` · ${hw.subject.name}` : ''}
                        </Text>
                      </div>
                      <Badge color="violet" variant="light">
                        {moment(hw.dueDate).format('DD/MM')}
                      </Badge>
                    </Group>
                  ))}
                </Stack>
              )}
            </Paper>
          </Grid.Col>
        </Grid>

        {/* Calendario mensile */}
        <Paper p="md" withBorder>
          <Title order={3} mb="md">
            Calendario
          </Title>
          {calendarLoading ? (
            <Skeleton height={600} />
          ) : calendarError ? (
            <Alert color="red" icon={<IconInfoCircle size={16} />}>
              Errore nel caricamento del calendario: {(calendarError as Error).message}
            </Alert>
          ) : (
            <div style={{ height: '600px' }}>
              <Calendar
                localizer={localizer}
                events={calendarEvents}
                startAccessor="start"
                endAccessor="end"
                style={{ height: '100%' }}
                views={['month', 'week', 'day']}
                defaultView="week"
                date={calendarDate}
                onNavigate={(date) => setCalendarDate(date)}
                messages={{
                  next: 'Avanti',
                  previous: 'Indietro',
                  today: 'Oggi',
                  month: 'Mese',
                  week: 'Settimana',
                  day: 'Giorno',
                  agenda: 'Agenda',
                  date: 'Data',
                  time: 'Ora',
                  event: 'Lezione',
                  noEventsInRange: 'Nessuna lezione nel periodo',
                }}
              />
            </div>
          )}
        </Paper>
      </Stack>
    </Container>
  );
}
