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
  Avatar,
  Progress,
  ActionIcon,
  Table,
  LoadingOverlay,
  Skeleton,
  Alert,
} from '@mantine/core';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import {
  IconCalendar,
  IconUsers,
  IconClipboardCheck,
  IconBook,
  IconClock,
  IconCheck,
  IconX,
  IconEye,
  IconInfoCircle,
} from '@tabler/icons-react';

import { StatsCard } from '@/components/cards/StatsCard';
import { useCalendarLessons } from '@/lib/hooks/useLessons';
import { useClasses } from '@/lib/hooks/useClasses';
import { useAttendance } from '@/lib/hooks/useAttendance';

const localizer = momentLocalizer(moment);

interface Student {
  id: string;
  name: string;
  avatar?: string;
  lastAttendance?: 'present' | 'absent';
  attendanceRate: number;
}

export default function TeacherDashboard() {
  const { data: session } = useSession();
  const t = useTranslations('teacher');
  const tc = useTranslations('common');
  const [activeTab, setActiveTab] = useState('overview');

  // TanStack Query hooks
  const { 
    data: lessonsData, 
    isLoading: lessonsLoading,
    error: lessonsError
  } = useCalendarLessons();

  const { 
    data: classesData, 
    isLoading: classesLoading 
  } = useClasses(1, 10, { 
    teacherId: session?.user?.id // Filter by current teacher
  });

  const { 
    data: attendanceData, 
    isLoading: attendanceLoading 
  } = useAttendance(1, 20);

  if (!session?.user) {
    return (
      <Container size="xl" py="md">
        <LoadingOverlay visible />
      </Container>
    );
  }

  const lessons = lessonsData || [];
  const classes = classesData?.classes || [];
  const attendanceRecords = attendanceData?.attendance || [];

  // Filter lessons for current teacher
  const teacherLessons = lessons.filter(lesson => 
    lesson.teacher?.id === session?.user?.id
  );

  // Today's lessons
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
  
  const todayLessons = teacherLessons.filter(lesson => 
    lesson.startTime >= todayStart && lesson.startTime <= todayEnd
  );

  // Transform lessons for calendar
  const calendarEvents = teacherLessons.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    start: lesson.startTime,
    end: lesson.endTime,
    resource: lesson,
  }));

  // Mock students data (in a real app, this would come from classes API)
  const mockStudents: Student[] = [
    {
      id: '1',
      name: 'Marco Rossi',
      attendanceRate: 92,
      lastAttendance: 'present',
    },
    {
      id: '2',
      name: 'Giulia Bianchi',
      attendanceRate: 88,
      lastAttendance: 'present',
    },
    {
      id: '3',
      name: 'Luca Verde',
      attendanceRate: 75,
      lastAttendance: 'absent',
    },
  ];

  const stats = [
    {
      title: t('stats.assignedClasses'),
      value: classes.length,
      icon: <IconBook size={24} />,
      color: 'blue',
      loading: classesLoading,
    },
    {
      title: t('stats.todayLessons'),
      value: todayLessons.length,
      icon: <IconCalendar size={24} />,
      color: 'green',
      loading: lessonsLoading,
    },
    {
      title: t('stats.totalStudents'),
      value: mockStudents.length, // In real app: sum of students across classes
      icon: <IconUsers size={24} />,
      color: 'violet',
      loading: false,
    },
    {
      title: t('stats.attendanceToConfirm'),
      value: 0, // No pending status in our enum, using 0 as placeholder
      icon: <IconClipboardCheck size={24} />,
      color: 'orange',
      loading: attendanceLoading,
    },
  ];

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <div>
            <Title order={1}>{t('title')}</Title>
            <Text c="dimmed" size="sm" mt="xs">
              {t('welcome', { name: `${session.user?.firstName || 'N/A'} ${session.user?.lastName || 'N/A'}` })}
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
            <Tabs.Tab value="classes" leftSection={<IconUsers size={16} />}>
              {t('tabs.myClasses')}
            </Tabs.Tab>
            <Tabs.Tab value="attendance" leftSection={<IconClipboardCheck size={16} />}>
              {t('tabs.attendance')}
            </Tabs.Tab>
            <Tabs.Tab value="today" leftSection={<IconClock size={16} />}>
              {t('tabs.today')}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" pt="lg">
            <Stack gap="lg">
              {/* Stats Cards */}
              <Grid>
                {stats.map((stat, index) => (
                  <Grid.Col span={{ base: 12, sm: 6, md: 3 }} key={index}>
                    {stat.loading ? (
                      <Skeleton height={120} />
                    ) : (
                      <StatsCard {...stat} />
                    )}
                  </Grid.Col>
                ))}
              </Grid>

              {/* Today's Schedule */}
              <Paper p="md" withBorder>
                <Group justify="space-between" align="center" mb="md">
                  <Title order={3}>{t('todaySchedule')}</Title>
                  <Badge color="blue">{todayLessons.length} {t('lessons')}</Badge>
                </Group>
                
                {lessonsLoading ? (
                  <Stack gap="sm">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} height={80} />
                    ))}
                  </Stack>
                ) : lessonsError ? (
                  <Alert color="red" icon={<IconInfoCircle size={16} />}>
                    {t('lessonLoadError')}: {lessonsError.message}
                  </Alert>
                ) : todayLessons.length === 0 ? (
                  <Text c="dimmed" ta="center" py="xl">
                    {t('noLessonsToday')}
                  </Text>
                ) : (
                  <Stack gap="sm">
                    {todayLessons.map((lesson) => (
                      <Card key={lesson.id} p="sm" withBorder>
                        <Group justify="space-between">
                          <div>
                            <Text fw={500}>{lesson.title}</Text>
                            <Group gap="xs" mt="xs">
                              <IconClock size={14} />
                              <Text size="sm" c="dimmed">
                                {moment(lesson.startTime).format('HH:mm')} - {moment(lesson.endTime).format('HH:mm')}
                              </Text>
                            </Group>
                            <Text size="sm" c="dimmed" mt="xs">
                              {t('class')}: {lesson.class?.name}
                            </Text>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <Badge 
                              color={lesson.status === 'SCHEDULED' ? 'blue' : 
                                     lesson.status === 'IN_PROGRESS' ? 'yellow' : 
                                     lesson.status === 'COMPLETED' ? 'green' : 'gray'}
                              variant="light"
                            >
                              {t(`lessonStatuses.${lesson.status?.toLowerCase()}`)}
                            </Badge>
                            {lesson.status === 'SCHEDULED' && (
                              <Group gap="xs" mt="xs">
                                <ActionIcon color="green" variant="light" size="sm">
                                  <IconCheck size={14} />
                                </ActionIcon>
                                <ActionIcon color="blue" variant="light" size="sm">
                                  <IconEye size={14} />
                                </ActionIcon>
                              </Group>
                            )}
                          </div>
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Paper>

              {/* Recent Activity */}
              <Paper p="md" withBorder>
                <Title order={3} mb="md">{t('recentActivity')}</Title>
                <Stack gap="sm">
                  {mockStudents.slice(0, 5).map((student) => (
                    <Group key={student.id} justify="space-between">
                      <Group gap="sm">
                        <Avatar size="sm" color="blue">
                          {student.name.split(' ').map(n => n[0]).join('')}
                        </Avatar>
                        <div>
                          <Text size="sm" fw={500}>{student.name}</Text>
                          <Text size="xs" c="dimmed">
                            {t('attendance')}: {student.attendanceRate}%
                          </Text>
                        </div>
                      </Group>
                      <Badge 
                        color={student.lastAttendance === 'present' ? 'green' : 'red'}
                        variant="light"
                        size="sm"
                      >
                        {t(`attendanceStatuses.${student.lastAttendance}`)}
                      </Badge>
                    </Group>
                  ))}
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="calendar" pt="lg">
            <Paper p="md" withBorder>
              {lessonsLoading ? (
                <Skeleton height={600} />
              ) : lessonsError ? (
                <Alert color="red" icon={<IconInfoCircle size={16} />}>
                  {t('calendarLoadError')}: {lessonsError.message}
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
                    messages={{
                      next: t('calendar.next'),
                      previous: t('calendar.previous'),
                      today: t('calendar.today'),
                      month: t('calendar.month'),
                      week: t('calendar.week'),
                      day: t('calendar.day'),
                      agenda: t('calendar.agenda'),
                      date: t('calendar.date'),
                      time: t('calendar.time'),
                      event: t('calendar.lesson'),
                      noEventsInRange: t('calendar.noLessonsInRange'),
                    }}
                  />
                </div>
              )}
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="classes" pt="lg">
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={2}>{t('myClasses')}</Title>
              </Group>
              
              {classesLoading ? (
                <Grid>
                  {[1, 2, 3, 4].map((i) => (
                    <Grid.Col span={{ base: 12, md: 6 }} key={i}>
                      <Skeleton height={200} />
                    </Grid.Col>
                  ))}
                </Grid>
              ) : classes.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  {t('noClassesAssigned')}
                </Text>
              ) : (
                <Grid>
                  {classes.map((classItem) => (
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
                            {classItem.description || t('noDescriptionAvailable')}
                          </Text>
                          
                          <Group justify="space-between">
                            <Text size="sm" c="dimmed">
                              {t('students')}: {mockStudents.length} {/* In real app: classItem.students.length */}
                            </Text>
                          </Group>
                          
                          <Button variant="light" fullWidth>
                            {t('manageClass')}
                          </Button>
                        </Stack>
                      </Card>
                    </Grid.Col>
                  ))}
                </Grid>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="attendance" pt="lg">
            <Paper p="md" withBorder>
              <Group justify="space-between" align="center" mb="md">
                <Title order={2}>{t('attendanceRegistration')}</Title>
                <Button color="green" leftSection={<IconCheck size={16} />}>
                  {t('confirmAll')}
                </Button>
              </Group>
              
              {attendanceLoading ? (
                <Skeleton height={300} />
              ) : attendanceRecords.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  {t('noAttendanceToRegister')}
                </Text>
              ) : (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('student')}</Table.Th>
                      <Table.Th>{t('class')}</Table.Th>
                      <Table.Th>{t('lesson')}</Table.Th>
                      <Table.Th>{t('date')}</Table.Th>
                      <Table.Th>{t('status')}</Table.Th>
                      <Table.Th>{tc('actions')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {attendanceRecords.slice(0, 10).map((record) => (
                      <Table.Tr key={record.id}>
                        <Table.Td>
                          <Group gap="sm">
                            <Avatar size="sm" color="blue">
                              {record.student?.firstName?.[0]}{record.student?.lastName?.[0]}
                            </Avatar>
                            <Text size="sm">
                              {record.student?.firstName} {record.student?.lastName}
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{record.lesson?.class?.name || 'N/A'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{record.lesson?.title || 'N/A'}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {record.recordedAt ? moment(record.recordedAt).format('DD/MM/YYYY') : 'N/A'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge 
                            color={record.status === 'PRESENT' ? 'green' : 
                                   record.status === 'ABSENT' ? 'red' : 
                                   record.status === 'LATE' ? 'yellow' : 'blue'}
                            variant="light"
                          >
                            {t(`attendanceStatuses.${record.status?.toLowerCase()}`)}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <ActionIcon color="green" variant="light" size="sm">
                              <IconCheck size={14} />
                            </ActionIcon>
                            <ActionIcon color="red" variant="light" size="sm">
                              <IconX size={14} />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="today" pt="lg">
            <Grid>
              <Grid.Col span={{ base: 12, md: 8 }}>
                <Paper p="md" withBorder>
                  <Title order={3} mb="md">{t('todayLessons')}</Title>
                  {lessonsLoading ? (
                    <Stack gap="sm">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} height={100} />
                      ))}
                    </Stack>
                  ) : todayLessons.length === 0 ? (
                    <Text c="dimmed" ta="center" py="xl">
                      {t('noLessonsToday')}
                    </Text>
                  ) : (
                    <Stack gap="md">
                      {todayLessons.map((lesson) => (
                        <Card key={lesson.id} p="md" withBorder>
                          <Group justify="space-between" align="flex-start">
                            <div>
                              <Text fw={500} size="lg">{lesson.title}</Text>
                              <Group gap="xs" mt="xs">
                                <IconClock size={16} />
                                <Text>
                                  {moment(lesson.startTime).format('HH:mm')} - {moment(lesson.endTime).format('HH:mm')}
                                </Text>
                              </Group>
                              <Text size="sm" c="dimmed" mt="xs">
                                {t('class')}: {lesson.class?.name}
                              </Text>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <Badge 
                                color={lesson.status === 'SCHEDULED' ? 'blue' : 
                                       lesson.status === 'IN_PROGRESS' ? 'yellow' : 
                                       lesson.status === 'COMPLETED' ? 'green' : 'gray'}
                              >
                                {t(`lessonStatuses.${lesson.status?.toLowerCase()}`)}
                              </Badge>
                              <Group gap="xs" mt="md">
                                <Button size="xs" variant="light">
                                  {t('startLesson')}
                                </Button>
                                <Button size="xs" variant="outline">
                                  {t('details')}
                                </Button>
                              </Group>
                            </div>
                          </Group>
                        </Card>
                      ))}
                    </Stack>
                  )}
                </Paper>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 4 }}>
                <Stack gap="md">
                  <Paper p="md" withBorder>
                    <Title order={4} mb="md">{t('dailySummary')}</Title>
                    <Stack gap="sm">
                      <Group justify="space-between">
                        <Text size="sm">{t('totalLessons')}</Text>
                        <Text size="sm" fw={500}>{todayLessons.length}</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">{t('completed')}</Text>
                        <Text size="sm" fw={500}>
                          {todayLessons.filter(l => l.status === 'COMPLETED').length}
                        </Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm">{t('scheduled')}</Text>
                        <Text size="sm" fw={500}>
                          {todayLessons.filter(l => l.status === 'SCHEDULED').length}
                        </Text>
                      </Group>
                      <Progress 
                        value={(todayLessons.filter(l => l.status === 'COMPLETED').length / Math.max(todayLessons.length, 1)) * 100}
                        color="green"
                        mt="md"
                      />
                    </Stack>
                  </Paper>

                  <Paper p="md" withBorder>
                    <Title order={4} mb="md">{t('reminders')}</Title>
                    <Stack gap="sm">
                      <Alert color="blue" variant="light">
                        <Text size="sm">
                          {t('reminderAttendance')}
                        </Text>
                      </Alert>
                      <Alert color="yellow" variant="light">
                        <Text size="sm">
                          {t('reminderMaterial')}
                        </Text>
                      </Alert>
                    </Stack>
                  </Paper>
                </Stack>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
