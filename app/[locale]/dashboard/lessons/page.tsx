'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  Container,
  Title,
  Text,
  Paper,
  Button,
  Group,
  Grid,
  Stack,
  LoadingOverlay,
  Alert,
  ActionIcon,
  TextInput,
  Select,
  Badge,
  Table,
  ScrollArea,
  Tabs,
  Avatar,
  Tooltip,
  SegmentedControl,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconSearch,
  IconRefresh,
  IconX,
  IconInfoCircle,
  IconCalendar,
  IconList,
  IconEye,
  IconEdit,
  IconUsers,
  IconClock,
  IconBook2,
  IconCheck,
  IconX as IconXCircle,
  IconTrendingUp,
} from '@tabler/icons-react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/it';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '@/components/calendar/LessonCalendar.css';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';
import { ModernModal } from '@/components/modals/ModernModal';
import { LessonForm } from '@/components/forms/LessonForm';

moment.locale('it');
const localizer = momentLocalizer(moment);

interface Lesson {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  room?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  isRecurring: boolean;
  description?: string;
  class: {
    id: string;
    name: string;
    code: string;
  };
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
  };
  course: {
    id: string;
    name: string;
    level: string;
  };
  _count?: {
    attendance: number;
  };
  attendance?: Array<{
    id: string;
    status: string;
  }>;
}

interface LessonsResponse {
  lessons: Lesson[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface LessonsStats {
  total: number;
  scheduled: number;
  completed: number;
  cancelled: number;
  averageAttendance: number;
  upcomingToday: number;
}

interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
}

interface Class {
  id: string;
  name: string;
  code: string;
  teacher: Teacher;
  course: {
    id: string;
    name: string;
    level: string;
  };
}

interface Course {
  id: string;
  name: string;
  level: string;
}

const StatusBadge = ({ status }: { status: string }) => {
  const colors = {
    SCHEDULED: 'blue',
    COMPLETED: 'green',
    CANCELLED: 'red',
  };
  const labels = {
    SCHEDULED: 'Programmata',
    COMPLETED: 'Completata',
    CANCELLED: 'Annullata',
  };
  return (
    <Badge color={colors[status as keyof typeof colors] || 'gray'} variant="light" size="sm">
      {labels[status as keyof typeof labels] || status}
    </Badge>
  );
};

export default function LessonsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const locale = useLocale();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<LessonsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const [opened, { open, close }] = useDisclosure(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  // Check permissions
  const canManageLessons = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN' || session?.user?.role === 'TEACHER';
  const canViewLessons = canManageLessons || session?.user?.role === 'STUDENT';

  // Fetch lessons
  const fetchLessons = async (
    page = 1,
    search = searchTerm,
    status = statusFilter,
    classId = classFilter
  ) => {
    if (!canViewLessons) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        include: 'class,teacher,course,attendance',
      });

      if (search) params.append('search', search);
      if (status) params.append('status', status);
      if (classId) params.append('classId', classId);

      const response = await fetch(`/api/lessons?${params}`);
      if (!response.ok) throw new Error('Failed to fetch lessons');

      const data: LessonsResponse = await response.json();
      setLessons(data.lessons);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching lessons:', error);
      notifications.show({
        id: `fetch-error-${Date.now()}`,
        title: 'Errore',
        message: 'Impossibile caricare le lezioni',
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    if (!canViewLessons) return;

    try {
      const response = await fetch('/api/lessons/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');

      const data: LessonsStats = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching lesson stats:', error);
    }
  };

  // Fetch teachers
  const fetchTeachers = async () => {
    if (!canManageLessons) return;

    try {
      const response = await fetch('/api/teachers?limit=100');
      if (!response.ok) throw new Error('Failed to fetch teachers');

      const data = await response.json();
      setTeachers(data.teachers || []);
    } catch (error) {
      console.error('Error fetching teachers:', error);
    }
  };

  // Fetch classes
  const fetchClasses = async () => {
    if (!canManageLessons) return;

    try {
      const response = await fetch('/api/classes?limit=100&include=teacher,course');
      if (!response.ok) throw new Error('Failed to fetch classes');

      const data = await response.json();
      setClasses(data.classes || []);
    } catch (error) {
      console.error('Error fetching classes:', error);
    }
  };

  // Fetch courses
  const fetchCourses = async () => {
    if (!canManageLessons) return;

    try {
      const response = await fetch('/api/courses?limit=100');
      if (!response.ok) throw new Error('Failed to fetch courses');

      const data = await response.json();
      setCourses(data.courses || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  useEffect(() => {
    if (canViewLessons) {
      fetchLessons();
      fetchStats();
      fetchTeachers();
      fetchClasses();
      fetchCourses();
    }
  }, [canViewLessons]);

  // Handlers
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    fetchLessons(1, value, statusFilter, classFilter);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    fetchLessons(1, searchTerm, value, classFilter);
  };

  const handleClassFilter = (value: string) => {
    setClassFilter(value);
    fetchLessons(1, searchTerm, statusFilter, value);
  };

  const handleCreate = () => {
    setEditingLesson(null);
    open();
  };

  const handleEdit = (lesson: Lesson) => {
    setEditingLesson(lesson);
    open();
  };

  const handleView = (lesson: Lesson) => {
    router.push(`/${locale}/dashboard/lessons/${lesson.id}`);
  };

  const handleFormSubmit = async (formData: any) => {
    try {
      setSubmitting(true);

      const url = editingLesson
        ? `/api/lessons/${editingLesson.id}`
        : '/api/lessons';
      const method = editingLesson ? 'PUT' : 'POST';

      notifications.show({
        id: 'saving-lesson',
        title: editingLesson ? '⏳ Aggiornamento in corso...' : '⏳ Creazione in corso...',
        message: editingLesson ? 'Salvataggio modifiche lezione' : 'Creazione nuova lezione',
        loading: true,
        autoClose: false,
        withCloseButton: false,
      });

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      notifications.hide('saving-lesson');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save lesson');
      }

      const responseData = await response.json();

      notifications.show({
        id: `lesson-success-${Date.now()}`,
        title: '✅ Successo',
        message: responseData.message || `Lezione ${editingLesson ? 'aggiornata' : 'creata'} con successo`,
        color: 'green',
        icon: <IconCheck size={18} />,
        autoClose: 4000,
      });

      close();
      fetchLessons();
      fetchStats();
    } catch (error: any) {
      notifications.hide('saving-lesson');

      console.error('Error saving lesson:', error);
      notifications.show({
        id: `lesson-error-${Date.now()}`,
        title: '❌ Errore',
        message: error.message || 'Impossibile salvare la lezione',
        color: 'red',
        icon: <IconX size={18} />,
        autoClose: 6000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Transform lessons to calendar events
  const calendarEvents = useMemo(() => {
    return lessons.map((lesson) => ({
      id: lesson.id,
      title: `${lesson.class.name} - ${lesson.title}`,
      start: new Date(lesson.startTime),
      end: new Date(lesson.endTime),
      resource: lesson,
    }));
  }, [lessons]);

  // Stats cards
  const statsCards = stats
    ? [
        {
          title: 'Lezioni Totali',
          value: stats.total.toString(),
          icon: <IconBook2 size={24} />,
          gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          change: {
            value: 12,
            type: 'increase' as const,
            period: 'rispetto al mese scorso',
          },
        },
        {
          title: 'Programmate',
          value: stats.scheduled.toString(),
          icon: <IconCalendar size={24} />,
          gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          change: {
            value: 8,
            type: 'increase' as const,
            period: 'rispetto al mese scorso',
          },
        },
        {
          title: 'Completate',
          value: stats.completed.toString(),
          icon: <IconCheck size={24} />,
          gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        },
        {
          title: 'Presenze Media',
          value: `${stats.averageAttendance.toFixed(1)}%`,
          icon: <IconUsers size={24} />,
          gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        },
        {
          title: 'Oggi',
          value: stats.upcomingToday.toString(),
          icon: <IconTrendingUp size={24} />,
          gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          badge: {
            text: 'In programma',
            color: 'blue',
          },
        },
      ]
    : [];

  if (!canViewLessons) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconInfoCircle />} color="red">
          Non hai i permessi per accedere a questa pagina
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={loading && lessons.length === 0} />

      {/* Header */}
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2} mb="xs">
            Gestione Lezioni
          </Title>
          <Text c="dimmed">Organizza e monitora tutte le lezioni</Text>
        </div>
        {canManageLessons && (
          <Button
            onClick={handleCreate}
            leftSection={<IconPlus size={18} />}
            variant="gradient"
            gradient={{ from: 'indigo', to: 'purple', deg: 45 }}
            radius="lg"
          >
            Nuova Lezione
          </Button>
        )}
      </Group>

      {/* Stats Cards */}
      {stats && (
        <Grid mb="xl">
          {statsCards.map((card, index) => (
            <Grid.Col key={index} span={{ base: 12, sm: 6, lg: 2.4 }}>
              <ModernStatsCard {...card} />
            </Grid.Col>
          ))}
        </Grid>
      )}

      {/* View Mode Toggle */}
      <Group justify="space-between" mb="md">
        <SegmentedControl
          value={viewMode}
          onChange={(value) => setViewMode(value as 'calendar' | 'list')}
          data={[
            {
              value: 'calendar',
              label: (
                <Group gap="xs">
                  <IconCalendar size={16} />
                  <span>Calendario</span>
                </Group>
              ),
            },
            {
              value: 'list',
              label: (
                <Group gap="xs">
                  <IconList size={16} />
                  <span>Lista</span>
                </Group>
              ),
            },
          ]}
        />

        {viewMode === 'list' && (
          <Group gap="md">
            <TextInput
              placeholder="Cerca lezioni..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              leftSection={<IconSearch size={16} />}
              style={{ flex: 1, minWidth: 200 }}
            />
            <Select
              placeholder="Tutti gli stati"
              value={statusFilter}
              onChange={(value) => handleStatusFilter(value || '')}
              data={[
                { value: '', label: 'Tutti gli stati' },
                { value: 'SCHEDULED', label: 'Programmate' },
                { value: 'COMPLETED', label: 'Completate' },
                { value: 'CANCELLED', label: 'Annullate' },
              ]}
              style={{ minWidth: 150 }}
            />
            <Select
              placeholder="Tutte le classi"
              value={classFilter}
              onChange={(value) => handleClassFilter(value || '')}
              data={[
                { value: '', label: 'Tutte le classi' },
                ...classes.map((c) => ({ value: c.id, label: c.name })),
              ]}
              style={{ minWidth: 150 }}
            />
            <Button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setClassFilter('');
                fetchLessons(1, '', '', '');
              }}
              variant="light"
              leftSection={<IconRefresh size={16} />}
            >
              Reset
            </Button>
          </Group>
        )}
      </Group>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <Paper shadow="sm" radius="lg" p="md" mb="md" style={{ minHeight: 600 }}>
          <Calendar
            localizer={localizer}
            events={calendarEvents}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 600 }}
            views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
            defaultView={Views.WEEK}
            onSelectEvent={(event) => handleView(event.resource)}
            eventPropGetter={(event) => {
              const status = event.resource.status;
              let backgroundColor = '#667eea';
              if (status === 'COMPLETED') backgroundColor = '#43e97b';
              if (status === 'CANCELLED') backgroundColor = '#f5576c';
              return {
                style: {
                  backgroundColor,
                  borderRadius: '5px',
                  opacity: 0.9,
                  color: 'white',
                  border: '0px',
                  display: 'block',
                },
              };
            }}
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
        </Paper>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <Paper shadow="sm" radius="lg" p="md" mb="md">
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Lezione</Table.Th>
                  <Table.Th>Classe</Table.Th>
                  <Table.Th>Docente</Table.Th>
                  <Table.Th>Data e Ora</Table.Th>
                  <Table.Th>Aula</Table.Th>
                  <Table.Th>Presenze</Table.Th>
                  <Table.Th>Stato</Table.Th>
                  <Table.Th>Azioni</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {lessons.map((lesson) => (
                  <Table.Tr key={lesson.id}>
                    <Table.Td>
                      <div>
                        <Text fw={500} size="sm">
                          {lesson.title}
                        </Text>
                        {lesson.isRecurring && (
                          <Badge size="xs" variant="light" color="purple">
                            Ricorrente
                          </Badge>
                        )}
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="sm">
                        <Avatar size="sm" color="blue" radius="md">
                          {lesson.class?.code?.substring(0, 2) || 'CL'}
                        </Avatar>
                        <div>
                          <Text fw={500} size="sm">
                            {lesson.class?.name || 'N/A'}
                          </Text>
                          {lesson.course && (
                            <Text size="xs" c="dimmed">
                              {lesson.course.name}
                            </Text>
                          )}
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="sm">
                        <Avatar size="sm" color="indigo">
                          {lesson.teacher.firstName[0]}
                          {lesson.teacher.lastName[0]}
                        </Avatar>
                        <Text size="sm">
                          {lesson.teacher.firstName} {lesson.teacher.lastName}
                        </Text>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <div>
                        <Text fw={500} size="sm">
                          {new Date(lesson.startTime).toLocaleDateString('it-IT', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {new Date(lesson.startTime).toLocaleTimeString('it-IT', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          -{' '}
                          {new Date(lesson.endTime).toLocaleTimeString('it-IT', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{lesson.room || '-'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{lesson._count?.attendance || 0}</Text>
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge status={lesson.status} />
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <Tooltip label="Visualizza dettagli">
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color="blue"
                            onClick={() => handleView(lesson)}
                          >
                            <IconEye size={14} />
                          </ActionIcon>
                        </Tooltip>
                        {canManageLessons && (
                          <Tooltip label="Modifica lezione">
                            <ActionIcon
                              size="sm"
                              variant="light"
                              color="yellow"
                              onClick={() => handleEdit(lesson)}
                            >
                              <IconEdit size={14} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>

          {loading && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Text c="dimmed">Caricamento lezioni...</Text>
            </div>
          )}

          {!loading && lessons.length === 0 && (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <Text c="dimmed">Nessuna lezione trovata</Text>
            </div>
          )}
        </Paper>
      )}

      {/* Create/Edit Modal */}
      <ModernModal
        opened={opened}
        onClose={close}
        title={editingLesson ? 'Modifica Lezione' : 'Nuova Lezione'}
        size="lg"
      >
        <LessonForm
          opened={opened}
          onClose={close}
          lessonData={editingLesson ? {
            id: editingLesson.id,
            title: editingLesson.title,
            classId: editingLesson.class.id,
            teacherId: editingLesson.teacher.id,
            courseId: editingLesson.course?.id || '',
            startTime: editingLesson.startTime,
            endTime: editingLesson.endTime,
            room: editingLesson.room,
            description: editingLesson.description,
            status: editingLesson.status,
            isRecurring: editingLesson.isRecurring,
          } : undefined}
          onSave={handleFormSubmit}
          loading={submitting}
          teachers={teachers}
          classes={classes}
          courses={courses}
        />
      </ModernModal>
    </Container>
  );
}
