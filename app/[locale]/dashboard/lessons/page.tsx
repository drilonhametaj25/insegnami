'use client';

import { useState, useMemo } from 'react';
import { Calendar, momentLocalizer, Views } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/it';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import '@/components/calendar/LessonCalendar.css';
import {
  Container,
  Title,
  Paper,
  Button,
  Group,
  Stack,
  Modal,
  Select,
  TextInput,
  Textarea,
  Switch,
  Grid,
  Badge,
  Text,
  ActionIcon,
  Alert,
  LoadingOverlay,
  Skeleton,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useTranslations } from 'next-intl';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconCalendar,
  IconClock,
  IconUsers,
  IconMapPin,
} from '@tabler/icons-react';
import {
  useCalendarLessons,
  useCreateLesson,
  useUpdateLesson,
  useDeleteLesson,
  type Lesson,
  type CreateLessonData
} from '@/lib/hooks/useLessons';
import { useClasses } from '@/lib/hooks/useClasses';
import { useTeachers } from '@/lib/hooks/useTeachers';
import { useCourses } from '@/lib/hooks/useCourses';

// Set Italian locale
moment.locale('it');
const localizer = momentLocalizer(moment);

interface LessonEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    classId: string;
    className: string;
    teacherId: string;
    teacherName: string;
    location?: string;
    maxStudents: number;
    currentStudents: number;
    isRecurring: boolean;
    description?: string;
    status: string;
    courseId?: string;
    courseName?: string;
  };
}

interface LessonFormData {
  title: string;
  classId: string;
  teacherId: string;
  courseId: string;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
  isRecurring: boolean;
  recurringFrequency?: 'WEEKLY' | 'MONTHLY';
  recurringEndDate?: Date;
}

export default function LessonsPage() {
  const t = useTranslations('lessons');
  
  const [selectedEvent, setSelectedEvent] = useState<LessonEvent | null>(null);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);
  const [editingLesson, setEditingLesson] = useState<LessonEvent | null>(null);

  // TanStack Query hooks
  const { 
    data: lessons, 
    isLoading: lessonsLoading,
    error: lessonsError
  } = useCalendarLessons();

  const { 
    data: classesData, 
    isLoading: classesLoading 
  } = useClasses();

  const { 
    data: teachersData, 
    isLoading: teachersLoading 
  } = useTeachers();

  const { 
    data: coursesData, 
    isLoading: coursesLoading 
  } = useCourses();

  const createLesson = useCreateLesson();
  const updateLesson = useUpdateLesson();
  const deleteLesson = useDeleteLesson();

  const classes = classesData?.classes || [];
  const teachers = teachersData?.teachers || [];
  const courses = coursesData?.courses || [];

  const form = useForm<LessonFormData>({
    initialValues: {
      title: '',
      classId: '',
      teacherId: '',
      courseId: '',
      start: new Date(),
      end: new Date(Date.now() + 90 * 60 * 1000), // +90 minutes
      location: '',
      description: '',
      isRecurring: false,
      recurringFrequency: 'WEEKLY',
      recurringEndDate: undefined,
    },
    validate: {
      title: (value) => (!value ? 'Titolo richiesto' : null),
      classId: (value) => (!value ? 'Seleziona una classe' : null),
      teacherId: (value) => (!value ? 'Seleziona un docente' : null),
      courseId: (value) => (!value ? 'Seleziona un corso' : null),
      start: (value) => (!value ? 'Data inizio richiesta' : null),
      end: (value, values) => {
        if (!value) return 'Data fine richiesta';
        if (value <= values.start) return 'La data fine deve essere successiva a quella di inizio';
        return null;
      },
    },
  });

  // Transform lessons to calendar events
  const events = useMemo((): LessonEvent[] => {
    if (!lessons) return [];
    
    return lessons.map((lesson: Lesson) => ({
      id: lesson.id,
      title: `${lesson.class.name} - ${lesson.teacher.firstName} ${lesson.teacher.lastName}`,
      start: new Date(lesson.startTime),
      end: new Date(lesson.endTime),
      resource: {
        classId: lesson.class.id,
        className: lesson.class.name,
        teacherId: lesson.teacher.id,
        teacherName: `${lesson.teacher.firstName} ${lesson.teacher.lastName}`,
        location: lesson.room,
        maxStudents: lesson.class?.students?.length || 0,
        currentStudents: lesson.attendance?.length || 0,
        isRecurring: lesson.isRecurring,
        description: lesson.description,
        status: lesson.status,
        courseId: lesson.class?.course?.id,
        courseName: lesson.class?.course?.name,
      },
    }));
  }, [lessons]);

  const handleSaveLesson = (values: LessonFormData) => {
    const lessonData: CreateLessonData = {
      title: values.title,
      classId: values.classId,
      teacherId: values.teacherId,
      courseId: values.courseId,
      startTime: values.start.toISOString(),
      endTime: values.end.toISOString(),
      location: values.location,
      description: values.description,
      isRecurring: values.isRecurring,
      recurringPattern: values.isRecurring ? {
        frequency: values.recurringFrequency || 'WEEKLY',
        interval: 1,
        endDate: values.recurringEndDate?.toISOString(),
      } : undefined,
    };

    if (editingLesson) {
      updateLesson.mutate(
        { id: editingLesson.id, data: lessonData },
        {
          onSuccess: () => {
            notifications.show({
              title: t('notifications.success'),
              message: t('notifications.lessonUpdatedSuccessfully'),
              color: 'green',
            });
            closeModal();
            form.reset();
          },
          onError: (error) => {
            notifications.show({
              title: t('notifications.error'),
              message: error.message || t('notifications.updateLessonError'),
              color: 'red',
            });
          },
        }
      );
    } else {
      createLesson.mutate(lessonData, {
        onSuccess: () => {
          notifications.show({
            title: t('notifications.success'),
            message: t('notifications.lessonCreatedSuccessfully'),
            color: 'green',
          });
          closeModal();
          form.reset();
        },
        onError: (error) => {
          notifications.show({
            title: t('notifications.error'),
            message: error.message || t('notifications.createLessonError'),
            color: 'red',
          });
        },
      });
    }
  };

  const handleNewLesson = () => {
    setEditingLesson(null);
    form.reset();
    openModal();
  };

  const handleEditLesson = (event: LessonEvent) => {
    setEditingLesson(event);
    form.setValues({
      title: event.title,
      classId: event.resource.classId,
      teacherId: event.resource.teacherId,
      courseId: event.resource.courseId,
      start: event.start,
      end: event.end,
      location: event.resource.location || '',
      description: event.resource.description || '',
      isRecurring: event.resource.isRecurring,
    });
    openModal();
  };

  const handleDeleteLesson = (eventId: string) => {
    if (!confirm(t('confirmDelete'))) return;

    deleteLesson.mutate(eventId, {
      onSuccess: () => {
        notifications.show({
          title: t('notifications.success'),
          message: t('notifications.lessonDeletedSuccessfully'),
          color: 'green',
        });
      },
      onError: (error) => {
        notifications.show({
          title: t('notifications.error'),
          message: error.message || t('notifications.deleteLessonError'),
          color: 'red',
        });
      },
    });
  };

  // Calendar event components
  const EventComponent = ({ event }: { event: LessonEvent }) => (
    <div className="lesson-event">
      <div className="lesson-title">{event.title}</div>
      <div className="lesson-info">
        <IconMapPin size={12} /> {event.resource.location || t('noClassroom')}
      </div>
      <div className="lesson-info">
        <IconUsers size={12} /> {event.resource.currentStudents}/{event.resource.maxStudents}
      </div>
    </div>
  );

  const EventAgenda = ({ event }: { event: LessonEvent }) => (
    <div>
      <strong>{event.title}</strong>
      <br />
      <Text size="sm" c="dimmed">
        {event.resource.location && (
          <>
            <IconMapPin size={12} /> {event.resource.location} |{' '}
          </>
        )}
        <IconUsers size={12} /> {event.resource.currentStudents}/{event.resource.maxStudents}
      </Text>
    </div>
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return 'blue';
      case 'IN_PROGRESS': return 'yellow';
      case 'COMPLETED': return 'green';
      case 'CANCELLED': return 'red';
      default: return 'gray';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'SCHEDULED': return 'Programmata';
      case 'IN_PROGRESS': return 'In corso';
      case 'COMPLETED': return 'Completata';
      case 'CANCELLED': return 'Annullata';
      default: return status;
    }
  };

  const isLoading = lessonsLoading || classesLoading || teachersLoading || coursesLoading;
  const isSaving = createLesson.isPending || updateLesson.isPending || deleteLesson.isPending;

  if (lessonsError) {
    return (
      <Container size="xl" py="md">
        <Alert color="red" title="Errore">
          Errore nel caricamento delle lezioni: {lessonsError.message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Title order={1}>{t('pageTitle')}</Title>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleNewLesson}
          >
            {t('createLesson')}
          </Button>
        </Group>

        <Paper shadow="sm" radius="md" p="lg" withBorder>
          {isLoading ? (
            <div style={{ height: 600, position: 'relative' }}>
              <LoadingOverlay visible />
              <Skeleton height={600} />
            </div>
          ) : (
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 600 }}
              views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
              defaultView={Views.WEEK}
              step={30}
              timeslots={2}
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
                event: t('calendar.event'),
                allDay: t('calendar.allDay'),
                noEventsInRange: t('calendar.noEventsInRange'),
                showMore: (total) => t('calendar.showMore', { total }),
              }}
              formats={{
                timeGutterFormat: 'HH:mm',
                eventTimeRangeFormat: ({ start, end }, culture, localizer) =>
                  localizer?.format(start, 'HH:mm', culture) + ' - ' + localizer?.format(end, 'HH:mm', culture),
              }}
              components={{
                event: EventComponent,
                agenda: {
                  event: EventAgenda,
                },
              }}
              onSelectEvent={(event) => setSelectedEvent(event)}
              onDoubleClickEvent={(event) => handleEditLesson(event)}
              dayPropGetter={(date) => ({
                className: moment(date).isSame(moment(), 'day') ? 'today' : '',
              })}
              eventPropGetter={(event) => ({
                className: `lesson-${event.resource.status.toLowerCase()}`,
              })}
            />
          )}
        </Paper>

        {/* Event Details Modal */}
        {selectedEvent && (
          <Modal
            opened={!!selectedEvent}
            onClose={() => setSelectedEvent(null)}
            title={t('lessonDetails')}
            size="md"
          >
            <Stack gap="md">
              <div>
                <Text fw={500}>{selectedEvent.title}</Text>
                <Text size="sm" c="dimmed">
                  {selectedEvent.resource.courseName}
                </Text>
              </div>

              <Grid>
                <Grid.Col span={6}>
                  <Text size="sm" fw={500}>{t('dateAndTime')}</Text>
                  <Text size="sm">
                    {moment(selectedEvent.start).format('DD/MM/YYYY HH:mm')} -{' '}
                    {moment(selectedEvent.end).format('HH:mm')}
                  </Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" fw={500}>{t('status')}</Text>
                  <Badge color={getStatusColor(selectedEvent.resource.status)} variant="light">
                    {getStatusLabel(selectedEvent.resource.status)}
                  </Badge>
                </Grid.Col>
              </Grid>

              <Grid>
                <Grid.Col span={6}>
                  <Text size="sm" fw={500}>{t('teacher')}</Text>
                  <Text size="sm">{selectedEvent.resource.teacherName}</Text>
                </Grid.Col>
                <Grid.Col span={6}>
                  <Text size="sm" fw={500}>{t('classroom')}</Text>
                  <Text size="sm">{selectedEvent.resource.location || t('notSpecified')}</Text>
                </Grid.Col>
              </Grid>

              <div>
                <Text size="sm" fw={500}>{t('students')}</Text>
                <Text size="sm">
                  {selectedEvent.resource.currentStudents} / {selectedEvent.resource.maxStudents}
                </Text>
              </div>

              {selectedEvent.resource.description && (
                <div>
                  <Text size="sm" fw={500}>{t('description')}</Text>
                  <Text size="sm">{selectedEvent.resource.description}</Text>
                </div>
              )}

              <Group justify="flex-end" mt="md">
                <ActionIcon
                  variant="light"
                  color="blue"
                  size="lg"
                  onClick={() => handleEditLesson(selectedEvent)}
                >
                  <IconEdit size={18} />
                </ActionIcon>
                <ActionIcon
                  variant="light"
                  color="red"
                  size="lg"
                  onClick={() => {
                    handleDeleteLesson(selectedEvent.id);
                    setSelectedEvent(null);
                  }}
                >
                  <IconTrash size={18} />
                </ActionIcon>
              </Group>
            </Stack>
          </Modal>
        )}

        {/* Lesson Form Modal */}
        <Modal
          opened={modalOpened}
          onClose={closeModal}
          title={editingLesson ? t('editLesson') : t('createLesson')}
          size="lg"
        >
          <form onSubmit={form.onSubmit(handleSaveLesson)}>
            <Stack gap="md">
              <TextInput
                label={t('title')}
                placeholder={t('titlePlaceholder')}
                {...form.getInputProps('title')}
              />

              <Grid>
                <Grid.Col span={6}>
                  <Select
                    label={t('course')}
                    placeholder={t('selectCourse')}
                    data={courses.map(c => ({
                      value: c.id,
                      label: c.name
                    }))}
                    {...form.getInputProps('courseId')}
                    searchable
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <Select
                    label={t('class')}
                    placeholder={t('selectClass')}
                    data={classes.map(c => ({
                      value: c.id,
                      label: `${c.name} - ${c.course?.name || t('noCourse')}`
                    }))}
                    {...form.getInputProps('classId')}
                    searchable
                  />
                </Grid.Col>
              </Grid>

              <Select
                label={t('teacher')}
                placeholder={t('selectTeacher')}
                data={teachers.map(t => ({
                  value: t.id,
                  label: `${t.firstName} ${t.lastName}`
                }))}
                {...form.getInputProps('teacherId')}
                searchable
              />

              <Grid>
                <Grid.Col span={6}>
                  <DateTimePicker
                    label={t('startDateTime')}
                    placeholder={t('selectDateTime')}
                    {...form.getInputProps('start')}
                  />
                </Grid.Col>
                <Grid.Col span={6}>
                  <DateTimePicker
                    label={t('endDateTime')}
                    placeholder={t('selectDateTime')}
                    {...form.getInputProps('end')}
                  />
                </Grid.Col>
              </Grid>

              <TextInput
                label={t('classroom')}
                placeholder={t('classroomPlaceholder')}
                {...form.getInputProps('location')}
              />

              <Textarea
                label={t('description')}
                placeholder={t('descriptionPlaceholder')}
                {...form.getInputProps('description')}
                minRows={3}
              />

              <Switch
                label={t('recurringLesson')}
                description={t('recurringDescription')}
                {...form.getInputProps('isRecurring', { type: 'checkbox' })}
              />

              {form.values.isRecurring && (
                <>
                  <Select
                    label={t('frequency')}
                    data={[
                      { value: 'WEEKLY', label: t('frequencies.weekly') },
                      { value: 'MONTHLY', label: t('frequencies.monthly') },
                    ]}
                    {...form.getInputProps('recurringFrequency')}
                  />

                  <DateTimePicker
                    label={t('endRecurrenceDate')}
                    placeholder={t('selectEndDate')}
                    {...form.getInputProps('recurringEndDate')}
                  />
                </>
              )}

              <Group justify="flex-end" mt="md">
                <Button variant="light" onClick={closeModal}>
                  {t('cancel')}
                </Button>
                <Button type="submit" loading={isSaving}>
                  {editingLesson ? t('update') : t('create')}
                </Button>
              </Group>
            </Stack>
          </form>
        </Modal>
      </Stack>
    </Container>
  );
}
