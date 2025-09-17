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
  Avatar,
  Table,
  Alert,
  Divider,
  LoadingOverlay,
  Skeleton,
  Select,
} from '@mantine/core';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import {
  IconCalendar,
  IconBook,
  IconClipboardCheck,
  IconBell,
  IconCoin,
  IconTrendingUp,
  IconDownload,
  IconInfoCircle,
  IconClock,
  IconMapPin,
  IconMail,
  IconPhone,
  IconUser,
} from '@tabler/icons-react';

import { StatsCard } from '@/components/cards/StatsCard';
import { useNotices } from '@/lib/hooks/useNotices';

const localizer = momentLocalizer(moment);

interface Child {
  id: string;
  name: string;
  avatar?: string;
  class: string;
  teacher: string;
  attendanceRate: number;
  currentGrade?: number;
  nextLesson?: Date;
}

interface Communication {
  id: string;
  from: string;
  subject: string;
  message: string;
  date: Date;
  type: 'notice' | 'grade' | 'attendance' | 'general';
  childId?: string;
  read: boolean;
}

export default function ParentDashboard() {
  const { data: session } = useSession();
  const t = useTranslations('parent');
  const tc = useTranslations('common');
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedChild, setSelectedChild] = useState<string>('all');

  // TanStack Query hooks (using mock data for now)
  const studentsLoading = false;
  const studentsError = null;
  const lessonsLoading = false;
  const attendanceLoading = false;
  const paymentsLoading = false;

  const lessons: any[] = []; // Mock empty lessons
  const attendanceRecords: any[] = []; // Mock empty attendance records
  const payments: any[] = []; // Mock empty payments

  const { 
    data: noticesData, 
    isLoading: noticesLoading 
  } = useNotices(1, 10, { status: 'PUBLISHED' });

  if (!session?.user) {
    return (
      <Container size="xl" py="md">
        <LoadingOverlay visible />
      </Container>
    );
  }

  const notices = noticesData?.notices || [];

  // Mock children data (in a real app, this would be filtered from students API based on parent relationship)
  const mockChildren: Child[] = [
    {
      id: '1',
      name: 'Marco Rossi',
      class: t('mockData.class1'),
      teacher: 'Sarah Johnson',
      attendanceRate: 92,
      currentGrade: 8.5,
      nextLesson: new Date(2024, 1, 17, 9, 0),
    },
    {
      id: '2',
      name: 'Giulia Rossi',
      class: t('mockData.class2'),
      teacher: 'Marie Dubois',
      attendanceRate: 88,
      currentGrade: 7.8,
      nextLesson: new Date(2024, 1, 16, 14, 0),
    },
  ];

  // Filter lessons by selected child
  const filteredLessons = selectedChild === 'all' 
    ? lessons 
    : lessons.filter(lesson => 
        mockChildren.some(child => 
          child.id === selectedChild && lesson.class?.name === child.class
        )
      );

  // Transform lessons for calendar
  const calendarEvents = filteredLessons.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    start: lesson.startTime,
    end: lesson.endTime,
    resource: lesson,
  }));

  // Mock communications
  const communications: Communication[] = [
    {
      id: '1',
      from: 'Sarah Johnson',
      subject: t('mockData.communication1Subject'),
      message: t('mockData.communication1Message'),
      date: new Date(2024, 1, 14),
      type: 'grade',
      childId: '1',
      read: false,
    },
    {
      id: '2',
      from: t('mockData.schoolDirection'),
      subject: t('mockData.communication2Subject'),
      message: t('mockData.communication2Message'),
      date: new Date(2024, 1, 13),
      type: 'general',
      read: true,
    },
  ];

  const stats = [
    {
      title: t('stats.enrolledChildren'),
      value: mockChildren.length,
      icon: <IconUser size={24} />,
      color: 'blue',
      loading: studentsLoading,
    },
    {
      title: t('stats.activeCourses'),
      value: mockChildren.length, // Each child has one active course
      icon: <IconBook size={24} />,
      color: 'green',
      loading: false,
    },
    {
      title: t('stats.averageAttendanceRate'),
      value: `${Math.round(mockChildren.reduce((acc, child) => acc + child.attendanceRate, 0) / mockChildren.length)}%`,
      icon: <IconClipboardCheck size={24} />,
      color: 'teal',
      loading: attendanceLoading,
    },
    {
      title: t('stats.pendingPayments'),
      value: payments.filter(p => p.status === 'PENDING').length,
      icon: <IconCoin size={24} />,
      color: 'orange',
      loading: paymentsLoading,
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
          <Select
            placeholder={t('selectChild')}
            data={[
              { value: 'all', label: t('allChildren') },
              ...mockChildren.map(child => ({ value: child.id, label: child.name }))
            ]}
            value={selectedChild}
            onChange={(value) => setSelectedChild(value || 'all')}
            w={200}
          />
        </Group>

        <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'overview')}>
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconUser size={16} />}>
              {t('tabs.overview')}
            </Tabs.Tab>
            <Tabs.Tab value="calendar" leftSection={<IconCalendar size={16} />}>
              {t('tabs.calendar')}
            </Tabs.Tab>
            <Tabs.Tab value="attendance" leftSection={<IconClipboardCheck size={16} />}>
              {t('tabs.attendance')}
            </Tabs.Tab>
            <Tabs.Tab value="payments" leftSection={<IconCoin size={16} />}>
              {t('tabs.payments')}
            </Tabs.Tab>
            <Tabs.Tab value="communications" leftSection={<IconBell size={16} />}>
              {t('tabs.communications')}
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

              {/* Children Overview */}
              <Paper p="md" withBorder>
                <Title order={3} mb="md">{t('yourChildren')}</Title>
                {studentsLoading ? (
                  <Grid>
                    {[1, 2].map((i) => (
                      <Grid.Col span={{ base: 12, md: 6 }} key={i}>
                        <Skeleton height={200} />
                      </Grid.Col>
                    ))}
                  </Grid>
                ) : studentsError ? (
                  <Alert color="red" icon={<IconInfoCircle size={16} />}>
                    {t('errorLoadingData')}
                  </Alert>
                ) : (
                  <Grid>
                    {mockChildren.map((child) => (
                      <Grid.Col span={{ base: 12, md: 6 }} key={child.id}>
                        <Card p="md" withBorder>
                          <Stack gap="sm">
                            <Group gap="sm">
                              <Avatar size="md" color="blue">
                                {child.name.split(' ').map(n => n[0]).join('')}
                              </Avatar>
                              <div>
                                <Text fw={500} size="lg">{child.name}</Text>
                                <Text size="sm" c="dimmed">{child.class}</Text>
                                <Text size="sm" c="dimmed">{t('teacher')}: {child.teacher}</Text>
                              </div>
                            </Group>

                            <Divider />

                            <Group justify="space-between">
                              <Text size="sm">{t('attendance')}</Text>
                              <Badge color={child.attendanceRate >= 90 ? 'green' : child.attendanceRate >= 80 ? 'yellow' : 'red'}>
                                {child.attendanceRate}%
                              </Badge>
                            </Group>

                            {child.currentGrade && (
                              <Group justify="space-between">
                                <Text size="sm">{t('averageGrade')}</Text>
                                <Badge color={child.currentGrade >= 8 ? 'green' : child.currentGrade >= 6 ? 'yellow' : 'red'}>
                                  {child.currentGrade}/10
                                </Badge>
                              </Group>
                            )}

                            {child.nextLesson && (
                              <Group gap="xs">
                                <IconClock size={14} />
                                <Text size="sm" c="dimmed">
                                  {t('nextLesson')}: {moment(child.nextLesson).format('DD/MM/YYYY HH:mm')}
                                </Text>
                              </Group>
                            )}

                            <Button variant="light" fullWidth size="sm">
                              {t('viewDetails')}
                            </Button>
                          </Stack>
                        </Card>
                      </Grid.Col>
                    ))}
                  </Grid>
                )}
              </Paper>

              {/* Recent Communications */}
              <Paper p="md" withBorder>
                <Group justify="space-between" align="center" mb="md">
                  <Title order={3}>{t('recentCommunications')}</Title>
                  <Badge color="red" variant="light">
                    {communications.filter(c => !c.read).length} {t('unread')}
                  </Badge>
                </Group>

                {noticesLoading ? (
                  <Stack gap="sm">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} height={80} />
                    ))}
                  </Stack>
                ) : communications.length === 0 ? (
                  <Text c="dimmed" ta="center" py="xl">
                    {t('noRecentCommunications')}
                  </Text>
                ) : (
                  <Stack gap="sm">
                    {communications.slice(0, 5).map((comm) => (
                      <Card key={comm.id} p="sm" withBorder={!comm.read}>
                        <Group justify="space-between" align="flex-start">
                          <div>
                            <Group gap="xs" mb="xs">
                              <Badge 
                                color={comm.type === 'grade' ? 'green' : 
                                       comm.type === 'attendance' ? 'blue' : 
                                       comm.type === 'notice' ? 'orange' : 'gray'}
                                size="sm"
                              >
                                {t(`communicationTypes.${comm.type}`)}
                              </Badge>
                              {!comm.read && (
                                <Badge color="red" size="sm">{t('new')}</Badge>
                              )}
                            </Group>
                            <Text fw={500} size="sm">{comm.subject}</Text>
                            <Text size="xs" c="dimmed" lineClamp={2}>
                              {comm.message}
                            </Text>
                            <Text size="xs" c="dimmed" mt="xs">
                              {t('from')}: {comm.from} • {moment(comm.date).format('DD/MM/YYYY')}
                            </Text>
                          </div>
                          <Button size="xs" variant="light">
                            {t('read')}
                          </Button>
                        </Group>
                      </Card>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="calendar" pt="lg">
            <Paper p="md" withBorder>
              <Group justify="space-between" mb="md">
                <Title order={3}>{t('lessonsCalendar')}</Title>
                <Text size="sm" c="dimmed">
                  {t('viewing')}: {selectedChild === 'all' ? t('allChildren') : mockChildren.find(c => c.id === selectedChild)?.name}
                </Text>
              </Group>
              
              {lessonsLoading ? (
                <Skeleton height={600} />
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

          <Tabs.Panel value="attendance" pt="lg">
            <Paper p="md" withBorder>
              <Title order={2} mb="md">{t('attendanceRegister')}</Title>
              
              {attendanceLoading ? (
                <Skeleton height={400} />
              ) : (
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{t('child')}</Table.Th>
                      <Table.Th>{t('lesson')}</Table.Th>
                      <Table.Th>{t('date')}</Table.Th>
                      <Table.Th>{t('status')}</Table.Th>
                      <Table.Th>{t('notes')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {attendanceRecords.slice(0, 15).map((record) => (
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
                          <Text size="sm" c="dimmed">
                            {record.notes || '-'}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="payments" pt="lg">
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={2}>{t('paymentStatus')}</Title>
                <Button leftSection={<IconDownload size={16} />} variant="light">
                  {t('downloadSummary')}
                </Button>
              </Group>
              
              {paymentsLoading ? (
                <Grid>
                  {[1, 2, 3, 4].map((i) => (
                    <Grid.Col span={{ base: 12, md: 6 }} key={i}>
                      <Skeleton height={150} />
                    </Grid.Col>
                  ))}
                </Grid>
              ) : payments.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  {t('noPaymentsRecorded')}
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
                              {t('dueDate')}: {moment(payment.dueDate).format('DD/MM/YYYY')}
                            </Text>
                            {payment.description && (
                              <Text size="sm" c="dimmed" mt="xs">
                                {payment.description}
                              </Text>
                            )}
                          </div>
                          <Badge 
                            color={payment.status === 'PAID' ? 'green' : 'red'}
                            size="lg"
                          >
                            {t(`paymentStatuses.${payment.status?.toLowerCase()}`)}
                          </Badge>
                        </Group>
                        
                        {payment.status === 'PENDING' && (
                          <Button fullWidth mt="md" color="blue">
                            {t('payNow')}
                          </Button>
                        )}
                        
                        {payment.status === 'PAID' && (
                          <Button fullWidth mt="md" variant="light">
                            {t('downloadReceipt')}
                          </Button>
                        )}
                      </Card>
                    </Grid.Col>
                  ))}
                </Grid>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="communications" pt="lg">
            <Paper p="md" withBorder>
              <Group justify="space-between" align="center" mb="md">
                <Title order={2}>{t('allCommunications')}</Title>
                <Badge color="red" variant="light">
                  {communications.filter(c => !c.read).length} {t('unread')}
                </Badge>
              </Group>
              
              <Stack gap="md">
                {communications.map((comm) => (
                  <Card key={comm.id} p="md" withBorder={!comm.read} style={{ backgroundColor: !comm.read ? '#f8f9fa' : 'transparent' }}>
                    <Group justify="space-between" align="flex-start">
                      <div style={{ flex: 1 }}>
                        <Group gap="xs" mb="sm">
                          <Badge 
                            color={comm.type === 'grade' ? 'green' : 
                                   comm.type === 'attendance' ? 'blue' : 
                                   comm.type === 'notice' ? 'orange' : 'gray'}
                          >
                            {t(`communicationTypes.${comm.type}`)}
                          </Badge>
                          {!comm.read && (
                            <Badge color="red">{t('new')}</Badge>
                          )}
                          {comm.childId && (
                            <Badge variant="outline">
                              {mockChildren.find(c => c.id === comm.childId)?.name}
                            </Badge>
                          )}
                        </Group>

                        <Text fw={500} mb="sm">{comm.subject}</Text>
                        <Text size="sm" mb="sm">{comm.message}</Text>
                        
                        <Group gap="sm">
                          <Group gap="xs">
                            <IconUser size={14} />
                            <Text size="xs" c="dimmed">{comm.from}</Text>
                          </Group>
                          <Group gap="xs">
                            <IconClock size={14} />
                            <Text size="xs" c="dimmed">
                              {moment(comm.date).format('DD/MM/YYYY HH:mm')}
                            </Text>
                          </Group>
                        </Group>
                      </div>
                      
                      <Group gap="xs">
                        <Button size="xs" variant="light" leftSection={<IconMail size={14} />}>
                          {t('reply')}
                        </Button>
                        {!comm.read && (
                          <Button size="xs" variant="outline">
                            {t('markAsRead')}
                          </Button>
                        )}
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </Paper>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
