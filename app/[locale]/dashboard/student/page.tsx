'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import {
  Container,
  Title,
  Grid,
  Paper,
  Button,
  Group,
  Stack,
  Tabs,
  Card,
  Text,
  Badge,
  Progress,
  Timeline,
  Alert,
  LoadingOverlay,
  Skeleton,
} from '@mantine/core';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import {
  IconCalendar,
  IconBook,
  IconClipboardCheck,
  IconBell,
  IconTrendingUp,
  IconDownload,
  IconInfoCircle,
  IconClock,
  IconMapPin,
} from '@tabler/icons-react';

import { useStudentDashboard } from '@/lib/hooks/useDashboard';
import { StatsCard } from '@/components/cards/StatsCard';

const localizer = momentLocalizer(moment);

interface Assignment {
  id: string;
  title: string;
  course: string;
  dueDate: Date;
  status: 'pending' | 'submitted' | 'graded';
  grade?: number;
}

export default function StudentDashboard() {
  const { data: session } = useSession();
  const t = useTranslations('student');
  const tc = useTranslations('common');
  const [activeTab, setActiveTab] = useState('overview');

  // Use the new dashboard hook
  const { 
    data: dashboardResponse, 
    isLoading: dashboardLoading,
    error: dashboardError
  } = useStudentDashboard();

  if (!session?.user) {
    return (
      <Container size="xl" py="md">
        <LoadingOverlay visible />
      </Container>
    );
  }

  if (dashboardLoading) {
    return (
      <Container size="xl" py="md">
        <LoadingOverlay visible />
      </Container>
    );
  }

  if (dashboardError || !dashboardResponse?.success) {
    return (
      <Container size="xl" py="md">
        <Alert color="red" icon={<IconInfoCircle size={16} />}>
          Errore nel caricamento dei dati: {dashboardError?.message || 'Errore sconosciuto'}
        </Alert>
      </Container>
    );
  }

  const dashboardData = dashboardResponse.data;
  const { student, stats, classes, upcomingLessons, recentAttendance, payments, notices } = dashboardData;

  // Mock assignments data (keeping for assignments tab - in real app would come from API)
  const assignments = [
    {
      id: '1',
      title: 'Homework 1',
      course: classes[0]?.course?.name || 'Course 1',
      dueDate: new Date(2025, 1, 18),
      status: 'pending',
    },
    {
      id: '2', 
      title: 'Assignment 2',
      course: classes[0]?.course?.name || 'Course 1',
      dueDate: new Date(2025, 1, 12),
      status: 'graded',
      grade: 8.5,
    },
  ];

  const dashboardStats = [
    {
      title: t('stats.activeCourses'),
      value: stats.activeCourses,
      icon: <IconBook size={24} />,
      color: 'blue',
      loading: false,
    },
    {
      title: t('stats.attendanceRate'),
      value: `${stats.attendanceRate}%`,
      icon: <IconClipboardCheck size={24} />,
      color: 'green',
      loading: false,
    },
    {
      title: t('stats.upcomingLessons'),
      value: stats.upcomingLessons,
      icon: <IconCalendar size={24} />,
      color: 'violet',
      loading: false,
    },
    {
      title: t('stats.pendingAssignments'),
      value: assignments.filter(a => a.status === 'pending').length,
      icon: <IconBell size={24} />,
      color: 'orange',
      loading: false,
    },
  ];

  // Transform lessons for calendar
  const calendarEvents = upcomingLessons.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    start: new Date(lesson.startTime),
    end: new Date(lesson.endTime),
    resource: lesson,
  }));

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <div>
            <Title order={1}>{t('title')}</Title>
            <Text c="dimmed" size="sm" mt="xs">
              {t('welcome', { name: `${session.user.firstName} ${session.user.lastName}` })}
            </Text>
          </div>
        </Group>

        <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'overview')}>
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconBook size={16} />}>
              {t('tabs.overview')}
            </Tabs.Tab>
            <Tabs.Tab value="calendar" leftSection={<IconCalendar size={16} />}>
              {t('tabs.calendar')}
            </Tabs.Tab>
            <Tabs.Tab value="courses" leftSection={<IconBook size={16} />}>
              {t('tabs.myCourses')}
            </Tabs.Tab>
            <Tabs.Tab value="assignments" leftSection={<IconClipboardCheck size={16} />}>
              {t('tabs.assignments')}
            </Tabs.Tab>
            <Tabs.Tab value="payments" leftSection={<IconTrendingUp size={16} />}>
              {t('tabs.payments')}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" pt="lg">
            <Stack gap="lg">
              {/* Stats Cards */}
              <Grid>
                {dashboardStats.map((stat, index) => (
                  <Grid.Col span={{ base: 12, sm: 6, md: 3 }} key={index}>
                    {stat.loading ? (
                      <Skeleton height={120} />
                    ) : (
                      <StatsCard {...stat} />
                    )}
                  </Grid.Col>
                ))}
              </Grid>

              {/* Upcoming Lessons */}
              <Paper p="md" withBorder>
                <Group justify="space-between" align="center" mb="md">
                  <Title order={3}>{t('upcomingLessons')}</Title>
                  <Badge color="blue">{upcomingLessons.length} {t('lessons')}</Badge>
                </Group>
                
                {upcomingLessons.length === 0 ? (
                  <Text c="dimmed" ta="center" py="xl">
                    {t('noUpcomingLessons')}
                  </Text>
                ) : (
                  <Stack gap="sm">
                    {upcomingLessons.map((lesson) => (
                      <Card key={lesson.id} p="sm" withBorder>
                        <Group justify="space-between">
                          <div>
                            <Text fw={500}>{lesson.title}</Text>
                            <Group gap="xs" mt="xs">
                              <IconClock size={14} />
                              <Text size="sm" c="dimmed">
                                {moment(lesson.startTime).format('DD/MM/YYYY HH:mm')} - {moment(lesson.endTime).format('HH:mm')}
                              </Text>
                            </Group>
                            <Text size="sm" c="dimmed" mt="xs">
                              {t('teacher')}: {lesson.teacher.name}
                            </Text>
                            <Text size="sm" c="dimmed">
                              Corso: {lesson.class.course}
                            </Text>
                          </div>
                          <Badge 
                            color={lesson.status === 'SCHEDULED' ? 'blue' : lesson.status === 'COMPLETED' ? 'green' : 'gray'}
                            variant="light"
                          >
                            {lesson.status === 'SCHEDULED' ? 'Programmata' : 
                             lesson.status === 'COMPLETED' ? 'Completata' : 
                             lesson.status === 'IN_PROGRESS' ? 'In Corso' : 'Annullata'}
                          </Badge>
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Paper>

              {/* Pending Assignments */}
              <Paper p="md" withBorder>
                <Title order={3} mb="md">Compiti in Scadenza</Title>
                {assignments.filter(a => a.status === 'pending').length === 0 ? (
                  <Text c="dimmed" ta="center" py="xl">
                    Nessun compito in scadenza
                  </Text>
                ) : (
                  <Stack gap="sm">
                    {assignments
                      .filter(a => a.status === 'pending')
                      .map((assignment) => (
                        <Alert key={assignment.id} icon={<IconInfoCircle size={16} />}>
                          <Group justify="space-between">
                            <div>
                              <Text fw={500}>{assignment.title}</Text>
                              <Text size="sm" c="dimmed">
                                Corso: {assignment.course} • Scadenza: {moment(assignment.dueDate).format('DD/MM/YYYY')}
                              </Text>
                            </div>
                            <Button size="xs" variant="light">
                              Visualizza
                            </Button>
                          </Group>
                        </Alert>
                      ))}
                  </Stack>
                )}
              </Paper>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="calendar" pt="lg">
            <Paper p="md" withBorder>
              <div style={{ height: '600px' }}>
                <Calendar
                  localizer={localizer}
                  events={calendarEvents}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height: '100%' }}
                  views={['month', 'week', 'day']}
                  defaultView="week"
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
                    noEventsInRange: 'Nessuna lezione in questo periodo',
                  }}
                />
              </div>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="courses" pt="lg">
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={2}>I Miei Corsi</Title>
              </Group>
              
              {classes.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  Non sei iscritto a nessun corso
                </Text>
              ) : (
                <Grid>
                  {classes.map((classItem) => {
                    // Mock progress calculation
                    const progress = Math.floor(Math.random() * 100);
                    const totalLessons = 24;
                    const attendedLessons = Math.floor((progress / 100) * totalLessons);

                    return (
                      <Grid.Col span={{ base: 12, md: 6 }} key={classItem.id}>
                        <Card p="md" withBorder>
                          <Stack gap="sm">
                            <Group justify="space-between">
                              <div>
                                <Text fw={500} size="lg">{classItem.name}</Text>
                                <Badge color="blue" size="sm" mt="xs">
                                  {classItem.course?.level || 'N/A'}
                                </Badge>
                              </div>
                            </Group>
                            
                            <Text size="sm" c="dimmed">
                              Descrizione: {classItem.description || 'Nessuna descrizione disponibile'}
                            </Text>
                            
                            <Text size="sm" c="dimmed">
                              Corso: {classItem.course?.name || 'N/A'}
                            </Text>
                            
                            <Text size="sm" c="dimmed">
                              Insegnante: {classItem.teacher.name}
                            </Text>
                            
                            <div>
                              <Group justify="space-between" mb="xs">
                                <Text size="sm">Progresso</Text>
                                <Text size="sm">{progress}%</Text>
                              </Group>
                              <Progress value={progress} color="blue" />
                            </div>
                            
                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">
                                Lezioni: {attendedLessons}/{totalLessons}
                              </Text>
                            </Group>
                            
                            <Button variant="light" fullWidth>
                              Dettagli Corso
                            </Button>
                          </Stack>
                        </Card>
                      </Grid.Col>
                    );
                  })}
                </Grid>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="assignments" pt="lg">
            <Stack gap="md">
              <Title order={2}>I Miei Compiti</Title>
              
              <Timeline>
                {assignments.map((assignment) => (
                  <Timeline.Item 
                    key={assignment.id}
                    bullet={assignment.status === 'graded' ? <IconClipboardCheck size={12} /> : 
                           assignment.status === 'submitted' ? <IconClock size={12} /> : 
                           <IconBell size={12} />}
                    color={assignment.status === 'graded' ? 'green' : 
                           assignment.status === 'submitted' ? 'blue' : 'orange'}
                  >
                    <Card p="sm" withBorder>
                      <Group justify="space-between">
                        <div>
                          <Text fw={500}>{assignment.title}</Text>
                          <Text size="sm" c="dimmed" mt="xs">
                            {assignment.course} • Scadenza: {moment(assignment.dueDate).format('DD/MM/YYYY')}
                          </Text>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Badge 
                            color={assignment.status === 'graded' ? 'green' : 
                                   assignment.status === 'submitted' ? 'blue' : 'orange'}
                          >
                            {assignment.status === 'graded' ? 'Valutato' : 
                             assignment.status === 'submitted' ? 'Consegnato' : 'In Attesa'}
                          </Badge>
                          {assignment.grade && (
                            <Text fw={500} mt="xs">
                              Voto: {assignment.grade}/10
                            </Text>
                          )}
                        </div>
                      </Group>
                    </Card>
                  </Timeline.Item>
                ))}
              </Timeline>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="payments" pt="lg">
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={2}>Stato Pagamenti</Title>
                <Button leftSection={<IconDownload size={16} />} variant="light">
                  Scarica Ricevute
                </Button>
              </Group>
              
              {payments.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  Nessun pagamento registrato
                </Text>
              ) : (
                <Grid>
                  {payments.map((payment) => (
                    <Grid.Col span={{ base: 12, md: 6 }} key={payment.id}>
                      <Card p="md" withBorder>
                        <Group justify="space-between" align="flex-start">
                          <div>
                            <Text fw={500} size="lg">
                              {moment(payment.dueDate).format('MMMM YYYY')}
                            </Text>
                            <Text size="xl" fw={700} mt="xs">
                              €{payment.amount}
                            </Text>
                            <Text size="sm" c="dimmed" mt="xs">
                              Scadenza: {moment(payment.dueDate).format('DD/MM/YYYY')}
                            </Text>
                            {payment.description && (
                              <Text size="sm" c="dimmed" mt="xs">
                                {payment.description}
                              </Text>
                            )}
                          </div>
                          <Badge 
                            color={payment.status === 'PAID' ? 'green' : 
                                   payment.status === 'PENDING' ? 'blue' : 'red'}
                            size="lg"
                          >
                            {payment.status === 'PAID' ? 'Pagato' : 'In Attesa'}
                          </Badge>
                        </Group>
                        
                        {payment.status === 'PENDING' && (
                          <Button fullWidth mt="md" color="blue">
                            Paga Ora
                          </Button>
                        )}
                        
                        {payment.status === 'PAID' && (
                          <Button fullWidth mt="md" variant="light">
                            Scarica Ricevuta
                          </Button>
                        )}
                      </Card>
                    </Grid.Col>
                  ))}
                </Grid>
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
