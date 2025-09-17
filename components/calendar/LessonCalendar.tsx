'use client';

import { useState, useEffect } from 'react';
import { Card, Title, Group, Button, Modal, Text, Badge, Stack } from '@mantine/core';
import { IconPlus, IconClock, IconMapPin, IconUsers } from '@tabler/icons-react';
import './LessonCalendar.css';

// Lazy load the calendar to avoid SSR issues
import dynamic from 'next/dynamic';

const DynamicCalendar = dynamic(
  () => import('./CalendarComponent').then((mod) => ({ default: mod.CalendarComponent })),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text>Caricamento calendario...</Text>
      </div>
    ),
  }
);

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

        <DynamicCalendar
          lessons={lessons}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          view={view}
        />
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
                {new Date(selectedLesson.startTime).toLocaleDateString('it-IT', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })} -{' '}
                {new Date(selectedLesson.endTime).toLocaleTimeString('it-IT', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
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
