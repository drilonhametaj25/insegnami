'use client';

import { useState } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { Card, Title, Group, Button, Modal, Text, Badge, Stack } from '@mantine/core';
import { IconPlus, IconClock, IconMapPin, IconUsers } from '@tabler/icons-react';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './LessonCalendar.css';

const localizer = momentLocalizer(moment);

interface Lesson {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  class: {
    name: string;
    course: {
      name: string;
    };
  };
  teacher: {
    firstName: string;
    lastName: string;
  };
  room?: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
}

interface LessonCalendarProps {
  lessons: Lesson[];
  onSelectLesson?: (lesson: Lesson) => void;
  onCreateLesson?: (date: Date) => void;
  view?: 'month' | 'week' | 'day';
}

export function LessonCalendar({
  lessons,
  onSelectLesson,
  onCreateLesson,
  view = 'week',
}: LessonCalendarProps) {
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [modalOpened, setModalOpened] = useState(false);

  // Transform lessons to calendar events
  const events = lessons.map((lesson) => ({
    id: lesson.id,
    title: lesson.title,
    start: lesson.startTime,
    end: lesson.endTime,
    resource: lesson,
  }));

  const handleSelectEvent = (event: any) => {
    setSelectedLesson(event.resource);
    setModalOpened(true);
    onSelectLesson?.(event.resource);
  };

  const handleSelectSlot = ({ start }: { start: Date }) => {
    onCreateLesson?.(start);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'blue';
      case 'IN_PROGRESS':
        return 'yellow';
      case 'COMPLETED':
        return 'green';
      case 'CANCELLED':
        return 'red';
      default:
        return 'gray';
    }
  };

  const eventStyleGetter = (event: any) => {
    const status = event.resource.status;
    let backgroundColor = '#3174ad';
    
    switch (status) {
      case 'SCHEDULED':
        backgroundColor = '#339af0';
        break;
      case 'IN_PROGRESS':
        backgroundColor = '#ffd43b';
        break;
      case 'COMPLETED':
        backgroundColor = '#51cf66';
        break;
      case 'CANCELLED':
        backgroundColor = '#ff6b6b';
        break;
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: status === 'CANCELLED' ? 0.6 : 1,
        color: 'white',
        border: '0',
        display: 'block',
      },
    };
  };

  return (
    <>
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="md">
          <Title order={3}>Calendario Lezioni</Title>
          {onCreateLesson && (
            <Button
              leftSection={<IconPlus size={16} />}
              size="sm"
              onClick={() => onCreateLesson(new Date())}
            >
              Nuova Lezione
            </Button>
          )}
        </Group>

        <div style={{ height: '600px' }}>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            selectable
            defaultView={view}
            views={['month', 'week', 'day']}
            eventPropGetter={eventStyleGetter}
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
      </Card>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title="Dettagli Lezione"
        size="md"
      >
        {selectedLesson && (
          <Stack gap="md">
            <Group justify="space-between">
              <Title order={4}>{selectedLesson.title}</Title>
              <Badge color={getStatusColor(selectedLesson.status)}>
                {selectedLesson.status}
              </Badge>
            </Group>

            <Group gap="xs">
              <IconClock size={16} />
              <Text size="sm">
                {moment(selectedLesson.startTime).format('DD/MM/YYYY HH:mm')} -{' '}
                {moment(selectedLesson.endTime).format('HH:mm')}
              </Text>
            </Group>

            <Group gap="xs">
              <IconUsers size={16} />
              <Text size="sm">
                {selectedLesson.class.course.name} - {selectedLesson.class.name}
              </Text>
            </Group>

            <Group gap="xs">
              <Text size="sm">
                <strong>Docente:</strong> {selectedLesson.teacher.firstName}{' '}
                {selectedLesson.teacher.lastName}
              </Text>
            </Group>

            {selectedLesson.room && (
              <Group gap="xs">
                <IconMapPin size={16} />
                <Text size="sm">{selectedLesson.room}</Text>
              </Group>
            )}
          </Stack>
        )}
      </Modal>
    </>
  );
}
