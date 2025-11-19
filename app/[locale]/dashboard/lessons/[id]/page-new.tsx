'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
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
  Badge,
  Tabs,
  Avatar,
  Table,
  ScrollArea,
  Textarea,
  Select,
  Menu,
  Modal,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconInfoCircle,
  IconCalendar,
  IconClock,
  IconUsers,
  IconBook2,
  IconCheck,
  IconX,
  IconEdit,
  IconTrash,
  IconDotsVertical,
  IconFileText,
  IconChartBar,
  IconArrowLeft,
  IconUser,
  IconMapPin,
} from '@tabler/icons-react';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';
import { MaterialsManager } from '@/components/materials/MaterialsManager';

interface Lesson {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  room?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  isRecurring: boolean;
  description?: string;
  notes?: string;
  homework?: string;
  class: {
    id: string;
    name: string;
    code: string;
    students: Array<{
      id: string;
      student: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      };
    }>;
  };
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  course: {
    id: string;
    name: string;
    level: string;
  };
  attendance: Array<{
    id: string;
    studentId: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    notes?: string;
  }>;
  materials: Array<{
    id: string;
    name: string;
    description?: string;
    fileName: string;
    fileSize: number;
    fileType: string;
    fileUrl: string;
    uploadedAt: string;
    uploadedBy: {
      id: string;
      firstName: string;
      lastName: string;
    };
    downloads: number;
    tags?: string[];
  }>;
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
    <Badge color={colors[status as keyof typeof colors] || 'gray'} variant="light">
      {labels[status as keyof typeof labels] || status}
    </Badge>
  );
};

const AttendanceBadge = ({ status }: { status: string }) => {
  const colors = {
    PRESENT: 'green',
    ABSENT: 'red',
    LATE: 'yellow',
    EXCUSED: 'blue',
  };
  const labels = {
    PRESENT: 'Presente',
    ABSENT: 'Assente',
    LATE: 'In Ritardo',
    EXCUSED: 'Giustificato',
  };
  return (
    <Badge color={colors[status as keyof typeof colors] || 'gray'} variant="light" size="sm">
      {labels[status as keyof typeof labels] || status}
    </Badge>
  );
};

export default function LessonDetailPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const locale = useLocale();
  const lessonId = params.id as string;

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [attendanceEditing, setAttendanceEditing] = useState(false);
  const [notes, setNotes] = useState('');
  const [homework, setHomework] = useState('');

  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] =
    useDisclosure(false);

  const canManageLessons =
    session?.user?.role === 'ADMIN' ||
    session?.user?.role === 'SUPERADMIN' ||
    session?.user?.role === 'TEACHER';

  // Fetch lesson details
  const fetchLesson = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/lessons/${lessonId}?include=class,teacher,course,attendance,materials`
      );
      if (!response.ok) throw new Error('Failed to fetch lesson');

      const data = await response.json();
      setLesson(data.lesson || data);
      setNotes(data.lesson?.notes || data.notes || '');
      setHomework(data.lesson?.homework || data.homework || '');
    } catch (error) {
      console.error('Error fetching lesson:', error);
      notifications.show({
        id: `fetch-error-${Date.now()}`,
        title: 'Errore',
        message: 'Impossibile caricare i dettagli della lezione',
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lessonId) {
      fetchLesson();
    }
  }, [lessonId]);

  const handleAttendanceChange = async (studentId: string, status: string) => {
    try {
      const response = await fetch(`/api/lessons/${lessonId}/attendance`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId,
          status,
        }),
      });

      if (!response.ok) throw new Error('Failed to update attendance');

      notifications.show({
        id: `attendance-success-${Date.now()}`,
        title: '✅ Successo',
        message: 'Presenza aggiornata con successo',
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      fetchLesson();
    } catch (error) {
      console.error('Error updating attendance:', error);
      notifications.show({
        id: `attendance-error-${Date.now()}`,
        title: '❌ Errore',
        message: 'Impossibile aggiornare la presenza',
        color: 'red',
        icon: <IconX size={18} />,
      });
    }
  };

  const handleSaveNotes = async () => {
    try {
      const response = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes,
          homework,
        }),
      });

      if (!response.ok) throw new Error('Failed to save notes');

      notifications.show({
        id: `notes-success-${Date.now()}`,
        title: '✅ Successo',
        message: 'Note salvate con successo',
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      fetchLesson();
    } catch (error) {
      console.error('Error saving notes:', error);
      notifications.show({
        id: `notes-error-${Date.now()}`,
        title: '❌ Errore',
        message: 'Impossibile salvare le note',
        color: 'red',
        icon: <IconX size={18} />,
      });
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/lessons/${lessonId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete lesson');

      notifications.show({
        id: `delete-success-${Date.now()}`,
        title: '✅ Successo',
        message: 'Lezione eliminata con successo',
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      router.push(`/${locale}/dashboard/lessons`);
    } catch (error) {
      console.error('Error deleting lesson:', error);
      notifications.show({
        id: `delete-error-${Date.now()}`,
        title: '❌ Errore',
        message: 'Impossibile eliminare la lezione',
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      closeDeleteModal();
    }
  };

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <LoadingOverlay visible />
      </Container>
    );
  }

  if (!lesson) {
    return (
      <Container size="xl" py="xl">
        <Alert icon={<IconInfoCircle />} color="red">
          Lezione non trovata
        </Alert>
      </Container>
    );
  }

  // Calculate stats
  const totalStudents = lesson.class?.students?.length || 0;
  const presentStudents =
    lesson.attendance?.filter((att) => att.status === 'PRESENT').length || 0;
  const absentStudents =
    lesson.attendance?.filter((att) => att.status === 'ABSENT').length || 0;
  const attendanceRate =
    totalStudents > 0 ? Math.round((presentStudents / totalStudents) * 100) : 0;

  const duration =
    lesson.endTime && lesson.startTime
      ? Math.round(
          (new Date(lesson.endTime).getTime() - new Date(lesson.startTime).getTime()) /
            (1000 * 60)
        )
      : 0;

  const statsCards = [
    {
      title: 'Studenti Totali',
      value: totalStudents.toString(),
      icon: <IconUsers size={24} />,
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    {
      title: 'Presenti',
      value: presentStudents.toString(),
      icon: <IconCheck size={24} />,
      gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    },
    {
      title: 'Tasso Presenze',
      value: `${attendanceRate}%`,
      icon: <IconChartBar size={24} />,
      gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    },
    {
      title: 'Durata',
      value: `${duration} min`,
      icon: <IconClock size={24} />,
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    },
  ];

  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={loading} />

      {/* Header */}
      <Group justify="space-between" mb="xl">
        <div>
          <Group gap="xs" mb="xs">
            <ActionIcon
              variant="light"
              onClick={() => router.push(`/${locale}/dashboard/lessons`)}
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
            <Title order={2}>{lesson.title}</Title>
          </Group>
          <Group gap="xs">
            <Badge color="blue" variant="light">
              {lesson.class.name}
            </Badge>
            <StatusBadge status={lesson.status} />
            {lesson.isRecurring && (
              <Badge color="purple" variant="light">
                Ricorrente
              </Badge>
            )}
          </Group>
        </div>

        {canManageLessons && (
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <ActionIcon variant="subtle" size="lg">
                <IconDotsVertical size={20} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconEdit size={16} />}
                onClick={() => router.push(`/${locale}/dashboard/lessons/edit/${lessonId}`)}
              >
                Modifica
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                leftSection={<IconTrash size={16} />}
                color="red"
                onClick={openDeleteModal}
              >
                Elimina
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>

      {/* Stats Cards */}
      <Grid mb="xl">
        {statsCards.map((card, index) => (
          <Grid.Col key={index} span={{ base: 12, sm: 6, lg: 3 }}>
            <ModernStatsCard {...card} />
          </Grid.Col>
        ))}
      </Grid>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconBook2 size={16} />}>
            Panoramica
          </Tabs.Tab>
          <Tabs.Tab value="attendance" leftSection={<IconUsers size={16} />}>
            Presenze ({totalStudents})
          </Tabs.Tab>
          <Tabs.Tab value="content" leftSection={<IconFileText size={16} />}>
            Contenuto e Note
          </Tabs.Tab>
          <Tabs.Tab value="materials" leftSection={<IconFileText size={16} />}>
            Materiali ({lesson.materials?.length || 0})
          </Tabs.Tab>
        </Tabs.List>

        {/* Overview Tab */}
        <Tabs.Panel value="overview" pt="md">
          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper shadow="sm" radius="lg" p="md">
                <Stack gap="md">
                  <Title order={4}>Informazioni Lezione</Title>

                  <Group>
                    <IconCalendar size={18} />
                    <div>
                      <Text size="sm" fw={500}>
                        {new Date(lesson.startTime).toLocaleDateString('it-IT', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
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
                  </Group>

                  <Group>
                    <IconClock size={18} />
                    <Text size="sm">
                      Durata: {duration} minuti
                    </Text>
                  </Group>

                  {lesson.room && (
                    <Group>
                      <IconMapPin size={18} />
                      <Text size="sm">Aula: {lesson.room}</Text>
                    </Group>
                  )}

                  <Group>
                    <IconUser size={18} />
                    <Text size="sm">
                      Docente: {lesson.teacher.firstName} {lesson.teacher.lastName}
                    </Text>
                  </Group>

                  {lesson.description && (
                    <div>
                      <Text fw={500} size="sm" mb={4}>
                        Descrizione
                      </Text>
                      <Text size="sm" c="dimmed">
                        {lesson.description}
                      </Text>
                    </div>
                  )}
                </Stack>
              </Paper>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <Paper shadow="sm" radius="lg" p="md">
                <Stack gap="md">
                  <Title order={4}>Informazioni Classe</Title>

                  <div>
                    <Text fw={500} size="sm" mb={4}>
                      Classe
                    </Text>
                    <Badge size="lg" variant="light" color="blue">
                      {lesson.class.name} ({lesson.class.code})
                    </Badge>
                  </div>

                  <div>
                    <Text fw={500} size="sm" mb={4}>
                      Corso
                    </Text>
                    <Text size="sm" c="dimmed">
                      {lesson.course.name} - {lesson.course.level}
                    </Text>
                  </div>

                  <div>
                    <Text fw={500} size="sm" mb={4}>
                      Studenti Iscritti
                    </Text>
                    <Text size="sm" c="dimmed">
                      {totalStudents} studenti
                    </Text>
                  </div>

                  <Button
                    variant="light"
                    leftSection={<IconUsers size={16} />}
                    onClick={() =>
                      router.push(`/${locale}/dashboard/classes/${lesson.class.id}`)
                    }
                  >
                    Vai alla Classe
                  </Button>
                </Stack>
              </Paper>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        {/* Attendance Tab */}
        <Tabs.Panel value="attendance" pt="md">
          <Paper shadow="sm" radius="lg" p="md">
            <Group justify="space-between" mb="md">
              <Title order={4}>Registro Presenze</Title>
              {canManageLessons && (
                <Button
                  size="sm"
                  variant={attendanceEditing ? 'filled' : 'outline'}
                  onClick={() => setAttendanceEditing(!attendanceEditing)}
                >
                  {attendanceEditing ? 'Chiudi' : 'Modifica'}
                </Button>
              )}
            </Group>

            <ScrollArea>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Studente</Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Stato</Table.Th>
                    {attendanceEditing && <Table.Th>Azioni</Table.Th>}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {lesson.class.students?.map((enrollment) => {
                    const student = enrollment.student;
                    const attendance = lesson.attendance?.find(
                      (att) => att.studentId === student.id
                    );
                    const status = attendance?.status || 'PRESENT';

                    return (
                      <Table.Tr key={student.id}>
                        <Table.Td>
                          <Group gap="sm">
                            <Avatar size="sm" color="blue">
                              {student.firstName[0]}
                              {student.lastName[0]}
                            </Avatar>
                            <Text fw={500} size="sm">
                              {student.firstName} {student.lastName}
                            </Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {student.email}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {attendanceEditing ? (
                            <Select
                              size="sm"
                              value={status}
                              onChange={(value) =>
                                value && handleAttendanceChange(student.id, value)
                              }
                              data={[
                                { value: 'PRESENT', label: 'Presente' },
                                { value: 'ABSENT', label: 'Assente' },
                                { value: 'LATE', label: 'In Ritardo' },
                                { value: 'EXCUSED', label: 'Giustificato' },
                              ]}
                            />
                          ) : (
                            <AttendanceBadge status={status} />
                          )}
                        </Table.Td>
                        {attendanceEditing && (
                          <Table.Td>
                            <Group gap={4}>
                              <ActionIcon
                                size="sm"
                                color="green"
                                onClick={() => handleAttendanceChange(student.id, 'PRESENT')}
                              >
                                <IconCheck size={14} />
                              </ActionIcon>
                              <ActionIcon
                                size="sm"
                                color="red"
                                onClick={() => handleAttendanceChange(student.id, 'ABSENT')}
                              >
                                <IconX size={14} />
                              </ActionIcon>
                            </Group>
                          </Table.Td>
                        )}
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>

            {(!lesson.class.students || lesson.class.students.length === 0) && (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <Text c="dimmed">Nessuno studente iscritto alla classe</Text>
              </div>
            )}
          </Paper>
        </Tabs.Panel>

        {/* Content Tab */}
        <Tabs.Panel value="content" pt="md">
          <Paper shadow="sm" radius="lg" p="md">
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={4}>Contenuto della Lezione</Title>
                {canManageLessons && (
                  <Button size="sm" onClick={handleSaveNotes}>
                    Salva Note
                  </Button>
                )}
              </Group>

              <Textarea
                label="Note della Lezione"
                placeholder="Aggiungi note sulla lezione, argomenti trattati, ecc."
                value={notes}
                onChange={(event) => setNotes(event.currentTarget.value)}
                minRows={6}
                disabled={!canManageLessons}
              />

              <Textarea
                label="Compiti per Casa"
                placeholder="Aggiungi compiti da assegnare agli studenti"
                value={homework}
                onChange={(event) => setHomework(event.currentTarget.value)}
                minRows={4}
                disabled={!canManageLessons}
              />
            </Stack>
          </Paper>
        </Tabs.Panel>

        {/* Materials Tab */}
        <Tabs.Panel value="materials" pt="md">
          <Paper shadow="sm" radius="lg" p="md">
            <MaterialsManager
              entityType="lesson"
              entityId={lessonId}
              materials={lesson.materials || []}
              canEdit={canManageLessons}
              onMaterialsUpdate={fetchLesson}
            />
          </Paper>
        </Tabs.Panel>
      </Tabs>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title="Conferma Eliminazione"
        centered
      >
        <Text mb="md">
          Sei sicuro di voler eliminare questa lezione? Questa azione non può essere annullata.
        </Text>
        <Group justify="flex-end">
          <Button variant="outline" onClick={closeDeleteModal}>
            Annulla
          </Button>
          <Button color="red" onClick={handleDelete}>
            Elimina
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
