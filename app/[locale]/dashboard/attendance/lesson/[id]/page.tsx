'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import {
  Container,
  Title,
  Grid,
  Paper,
  Button,
  Group,
  Stack,
  Text,
  Badge,
  Avatar,
  Card,
  ActionIcon,
  UnstyledButton,
  Table,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconCalendar,
  IconClock,
  IconUser,
  IconCheck,
  IconX,
  IconEye,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface LessonAttendance {
  lesson: {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    topic?: string;
    notes?: string;
    class: {
      id: string;
      name: string;
      level: string;
    };
    teacher: {
      id: string;
      firstName: string;
      lastName: string;
    };
    room: string;
  };
  attendance: Array<{
    student: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      avatar?: string;
    };
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    arrivalTime?: string;
    notes?: string;
  }>;
  stats: {
    totalStudents: number;
    present: number;
    absent: number;
    late: number;
    excused: number;
    attendanceRate: number;
  };
}

export default function LessonAttendancePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('attendance');
  
  const [attendanceData, setAttendanceData] = useState<LessonAttendance | null>(null);
  const [loading, setLoading] = useState(true);

  const lessonId = params.id as string;
  const date = searchParams.get('date');

  useEffect(() => {
    loadLessonAttendance();
  }, [lessonId, date]);

  const loadLessonAttendance = async () => {
    try {
      setLoading(true);
      
      // Mock data - replace with actual API call
      const mockData: LessonAttendance = {
        lesson: {
          id: lessonId,
          date: date || '2024-02-14',
          startTime: '10:00',
          endTime: '11:30',
          topic: 'Present Simple - Affirmative and Negative Forms',
          notes: 'Lezione introduttiva sul presente semplice con esercizi pratici.',
          class: {
            id: 'class1',
            name: 'Inglese A1 - Principianti',
            level: 'A1',
          },
          teacher: {
            id: 'teacher1',
            firstName: 'Sarah',
            lastName: 'Johnson',
          },
          room: 'Aula 1',
        },
        attendance: [
          {
            student: {
              id: 'student1',
              firstName: 'Marco',
              lastName: 'Rossi',
              email: 'marco.rossi@email.com',
            },
            status: 'PRESENT',
            arrivalTime: '10:00',
          },
          {
            student: {
              id: 'student2',
              firstName: 'Elena',
              lastName: 'Bianchi',
              email: 'elena.bianchi@email.com',
            },
            status: 'PRESENT',
            arrivalTime: '10:05',
          },
          {
            student: {
              id: 'student3',
              firstName: 'Luca',
              lastName: 'Verde',
              email: 'luca.verde@email.com',
            },
            status: 'LATE',
            arrivalTime: '10:15',
            notes: 'Arrivato in ritardo per traffico',
          },
          {
            student: {
              id: 'student4',
              firstName: 'Anna',
              lastName: 'Gialli',
              email: 'anna.gialli@email.com',
            },
            status: 'ABSENT',
            notes: 'Malata - giustificata',
          },
          {
            student: {
              id: 'student5',
              firstName: 'Paolo',
              lastName: 'Blu',
              email: 'paolo.blu@email.com',
            },
            status: 'EXCUSED',
            notes: 'Viaggio di lavoro comunicato in anticipo',
          },
        ],
        stats: {
          totalStudents: 15,
          present: 11,
          absent: 2,
          late: 1,
          excused: 1,
          attendanceRate: 86.7,
        },
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      setAttendanceData(mockData);
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: 'Impossibile caricare i dettagli della presenza',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PRESENT': return <IconCheck size={16} color="green" />;
      case 'LATE': return <IconClock size={16} color="orange" />;
      case 'ABSENT': return <IconX size={16} color="red" />;
      case 'EXCUSED': return <IconCheck size={16} color="blue" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT': return 'green';
      case 'LATE': return 'orange'; 
      case 'ABSENT': return 'red';
      case 'EXCUSED': return 'blue';
      default: return 'gray';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PRESENT': return 'Presente';
      case 'LATE': return 'In Ritardo';
      case 'ABSENT': return 'Assente';
      case 'EXCUSED': return 'Giustificato';
      default: return status;
    }
  };

  if (loading || !attendanceData) {
    return <div>Caricamento...</div>;
  }

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <ActionIcon
              variant="light"
              size="lg"
              onClick={() => router.push(`/${locale}/dashboard/classes/${attendanceData.lesson.class.id}`)}
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
            <div>
              <Title order={1}>
                Presenze - {attendanceData.lesson.class.name}
              </Title>
              <Group gap="xs" mt="xs">
                <Badge color="blue" variant="light">
                  {new Date(attendanceData.lesson.date).toLocaleDateString('it-IT')}
                </Badge>
                <Badge color="green" variant="light">
                  {attendanceData.lesson.startTime} - {attendanceData.lesson.endTime}
                </Badge>
                <Badge color="purple" variant="light">
                  {attendanceData.lesson.room}
                </Badge>
              </Group>
            </div>
          </Group>
          <Button 
            variant="light" 
            onClick={() => router.push(`/${locale}/dashboard/classes/${attendanceData.lesson.class.id}`)}
          >
            Torna alla Classe
          </Button>
        </Group>

        {/* Lesson Info Card */}
        <Card withBorder radius="md" p="lg">
          <Grid>
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Stack gap="md">
                <div>
                  <Group gap="sm" mb="xs">
                    <IconCalendar size={20} />
                    <Text fw={600}>Dettagli Lezione</Text>
                  </Group>
                  {attendanceData.lesson.topic && (
                    <div>
                      <Text fw={500} mb="xs">Argomento:</Text>
                      <Text c="dimmed">{attendanceData.lesson.topic}</Text>
                    </div>
                  )}
                  {attendanceData.lesson.notes && (
                    <div>
                      <Text fw={500} mb="xs">Note:</Text>
                      <Text c="dimmed">{attendanceData.lesson.notes}</Text>
                    </div>
                  )}
                </div>
                
                <div>
                  <Text fw={600} mb="xs">Docente</Text>
                  <Group gap="sm">
                    <Avatar size="sm" color="blue">
                      {attendanceData.lesson.teacher.firstName[0]}{attendanceData.lesson.teacher.lastName[0]}
                    </Avatar>
                    <UnstyledButton
                      onClick={() => router.push(`/${locale}/dashboard/users/${attendanceData.lesson.teacher.id}`)}
                    >
                      <Text fw={500} c="blue" style={{ cursor: 'pointer' }}>
                        {attendanceData.lesson.teacher.firstName} {attendanceData.lesson.teacher.lastName}
                      </Text>
                    </UnstyledButton>
                  </Group>
                </div>
              </Stack>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Stack gap="md">
                <div>
                  <Text fw={600} mb="md">Statistiche Presenza</Text>
                  <Stack gap="xs">
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconCheck size={16} color="green" />
                        <Text size="sm">Presenti</Text>
                      </Group>
                      <Text fw={600} c="green">{attendanceData.stats.present}</Text>
                    </Group>
                    
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconClock size={16} color="orange" />
                        <Text size="sm">In Ritardo</Text>
                      </Group>
                      <Text fw={600} c="orange">{attendanceData.stats.late}</Text>
                    </Group>
                    
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconX size={16} color="red" />
                        <Text size="sm">Assenti</Text>
                      </Group>
                      <Text fw={600} c="red">{attendanceData.stats.absent}</Text>
                    </Group>
                    
                    <Group justify="space-between">
                      <Group gap="xs">
                        <IconCheck size={16} color="blue" />
                        <Text size="sm">Giustificati</Text>
                      </Group>
                      <Text fw={600} c="blue">{attendanceData.stats.excused}</Text>
                    </Group>
                    
                    <Group justify="space-between" pt="xs" style={{ borderTop: '1px solid #eee' }}>
                      <Text fw={600}>Tasso Presenza</Text>
                      <Badge size="lg" color={attendanceData.stats.attendanceRate >= 80 ? 'green' : 'orange'}>
                        {attendanceData.stats.attendanceRate}%
                      </Badge>
                    </Group>
                  </Stack>
                </div>
              </Stack>
            </Grid.Col>
          </Grid>
        </Card>

        {/* Attendance Table */}
        <Card withBorder radius="md" p="lg">
          <Group justify="space-between" mb="md">
            <Title order={3}>Lista Presenze</Title>
            <Text size="sm" c="dimmed">
              {attendanceData.attendance.length} studenti registrati
            </Text>
          </Group>
          
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Studente</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Orario Arrivo</Table.Th>
                <Table.Th>Note</Table.Th>
                <Table.Th>Azioni</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {attendanceData.attendance.map((record) => (
                <Table.Tr key={record.student.id}>
                  <Table.Td>
                    <Group gap="sm">
                      <Avatar size="sm" color="blue">
                        {record.student.firstName[0]}{record.student.lastName[0]}
                      </Avatar>
                      <div>
                        <UnstyledButton
                          onClick={() => router.push(`/${locale}/dashboard/users/${record.student.id}`)}
                        >
                          <Text fw={500} c="blue" style={{ cursor: 'pointer' }}>
                            {record.student.firstName} {record.student.lastName}
                          </Text>
                        </UnstyledButton>
                        <Text size="xs" c="dimmed">{record.student.email}</Text>
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {getStatusIcon(record.status)}
                      <Badge color={getStatusColor(record.status)} variant="light">
                        {getStatusLabel(record.status)}
                      </Badge>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {record.arrivalTime || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c={record.notes ? 'dimmed' : 'gray'}>
                      {record.notes || '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconEye size={12} />}
                        onClick={() => router.push(`/${locale}/dashboard/users/${record.student.id}`)}
                      >
                        Profilo
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => router.push(`/${locale}/dashboard/attendance?student=${record.student.id}`)}
                      >
                        Storico
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>

        {/* Quick Actions */}
        <Card withBorder radius="md" p="lg">
          <Title order={4} mb="md">Azioni Rapide</Title>
          <Group gap="md">
            <Button
              variant="light"
              onClick={() => router.push(`/${locale}/dashboard/classes/${attendanceData.lesson.class.id}?tab=attendance`)}
            >
              Vedi Tutte le Presenze della Classe
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/${locale}/dashboard/users/${attendanceData.lesson.teacher.id}`)}
            >
              Profilo Docente
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push(`/${locale}/dashboard/lessons?class=${attendanceData.lesson.class.id}`)}
            >
              Altre Lezioni
            </Button>
          </Group>
        </Card>
      </Stack>
    </Container>
  );
}
