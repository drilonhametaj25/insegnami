'use client';

import React, { useState, useEffect } from 'react';
import {
  Paper,
  Title,
  Group,
  Button,
  Badge,
  Text,
  Table,
  Avatar,
  ActionIcon,
  Select,
  Alert,
  LoadingOverlay,
  Progress,
  Stack,
  Card,
  Grid,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconX,
  IconClock,
  IconExclamationMark,
  IconDownload,
  IconCalendar,
  IconUsers,
  IconChartBar,
  IconInfoCircle,
} from '@tabler/icons-react';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  studentCode?: string;
}

interface Lesson {
  id: string;
  title: string;
  startTime: string;
  status: string;
}

interface AttendanceRecord {
  id?: string;
  studentId: string;
  lessonId: string;
  status: 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'LATE';
  notes?: string;
}

interface AttendanceGridProps {
  classId: string;
  students: Student[];
  lessons: Lesson[];
  canEdit?: boolean;
}

const ATTENDANCE_STATUS = {
  PRESENT: { label: 'Presente', color: 'green', icon: IconCheck },
  ABSENT: { label: 'Assente', color: 'red', icon: IconX },
  EXCUSED: { label: 'Giustificato', color: 'yellow', icon: IconExclamationMark },
  LATE: { label: 'Ritardo', color: 'orange', icon: IconClock },
};

export function AttendanceGrid({ classId, students, lessons, canEdit = false }: AttendanceGridProps) {
  const [attendanceData, setAttendanceData] = useState<Map<string, AttendanceRecord>>(new Map());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<string>('');

  // Create a unique key for student-lesson combination
  const getAttendanceKey = (studentId: string, lessonId: string) => `${studentId}-${lessonId}`;

  // Load attendance data
  const loadAttendanceData = async () => {
    if (!selectedLesson) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/classes/${classId}/attendance?lessonId=${selectedLesson}`);
      if (response.ok) {
        const data = await response.json();
        const attendanceMap = new Map<string, AttendanceRecord>();
        
        data.attendance?.forEach((record: AttendanceRecord) => {
          const key = getAttendanceKey(record.studentId, record.lessonId);
          attendanceMap.set(key, record);
        });
        
        setAttendanceData(attendanceMap);
      }
    } catch (error) {
      console.error('Error loading attendance:', error);
      notifications.show({
        title: 'Errore',
        message: 'Impossibile caricare i dati delle presenze',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLesson) {
      loadAttendanceData();
    }
  }, [selectedLesson, classId]);

  // Update attendance status
  const updateAttendanceStatus = async (studentId: string, lessonId: string, status: keyof typeof ATTENDANCE_STATUS) => {
    if (!canEdit) return;

    const key = getAttendanceKey(studentId, lessonId);
    const currentRecord = attendanceData.get(key);

    // Optimistic update
    const newRecord: AttendanceRecord = {
      ...currentRecord,
      studentId,
      lessonId,
      status,
    };
    
    const newAttendanceData = new Map(attendanceData);
    newAttendanceData.set(key, newRecord);
    setAttendanceData(newAttendanceData);

    try {
      const response = await fetch(`/api/classes/${classId}/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lessonId,
          studentId,
          status,
        }),
      });

      if (!response.ok) {
        throw new Error('Errore nel salvataggio');
      }

      const updatedRecord = await response.json();
      newAttendanceData.set(key, updatedRecord);
      setAttendanceData(new Map(newAttendanceData));

    } catch (error) {
      console.error('Error updating attendance:', error);
      // Revert optimistic update
      setAttendanceData(attendanceData);
      notifications.show({
        title: 'Errore',
        message: 'Impossibile aggiornare la presenza',
        color: 'red',
      });
    }
  };

  // Bulk mark all students as present
  const markAllPresent = async () => {
    if (!canEdit || !selectedLesson) return;

    setSaving(true);
    try {
      const updates = students.map(student => ({
        studentId: student.id,
        lessonId: selectedLesson,
        status: 'PRESENT' as const,
      }));

      const response = await fetch(`/api/classes/${classId}/attendance/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ attendance: updates }),
      });

      if (response.ok) {
        await loadAttendanceData();
        notifications.show({
          title: 'Successo',
          message: 'Tutti gli studenti sono stati segnati come presenti',
          color: 'green',
        });
      } else {
        throw new Error('Errore nel salvataggio bulk');
      }
    } catch (error) {
      console.error('Error bulk updating:', error);
      notifications.show({
        title: 'Errore',
        message: 'Impossibile aggiornare tutte le presenze',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  // Calculate statistics
  const getAttendanceStats = () => {
    if (!selectedLesson) return null;

    const stats = { present: 0, absent: 0, justified: 0, late: 0 };
    
    students.forEach(student => {
      const key = getAttendanceKey(student.id, selectedLesson);
      const record = attendanceData.get(key);
      if (record) {
        stats[record.status.toLowerCase() as keyof typeof stats]++;
      }
    });

    const total = students.length;
    const marked = Object.values(stats).reduce((sum, count) => sum + count, 0);
    const rate = total > 0 ? Math.round((stats.present / total) * 100) : 0;

    return { ...stats, total, marked, rate };
  };

  const stats = getAttendanceStats();

  // Filter lessons to only completed ones (where attendance can be taken)
  const completedLessons = lessons.filter(lesson => 
    lesson.status === 'COMPLETED' || new Date(lesson.startTime) <= new Date()
  );

  if (completedLessons.length === 0) {
    return (
      <Paper p="xl" withBorder style={{ textAlign: 'center' }}>
        <IconCalendar size={48} color="var(--mantine-color-gray-4)" />
        <Text size="lg" fw={500} mt="md" c="dimmed">
          Nessuna lezione disponibile
        </Text>
        <Text size="sm" c="dimmed">
          Le presenze possono essere registrate solo per lezioni completate o in corso
        </Text>
      </Paper>
    );
  }

  return (
    <Stack gap="md">
      {/* Header with lesson selection and stats */}
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="md">
          <div>
            <Title order={4}>Gestione Presenze</Title>
            <Text size="sm" c="dimmed">
              Seleziona una lezione per gestire le presenze degli studenti
            </Text>
          </div>
          {canEdit && (
            <Group>
              <Button
                variant="outline"
                leftSection={<IconDownload size={16} />}
                disabled={!selectedLesson}
              >
                Export PDF
              </Button>
              <Button
                variant="filled"
                leftSection={<IconCheck size={16} />}
                onClick={markAllPresent}
                disabled={!selectedLesson}
                loading={saving}
              >
                Tutti Presenti
              </Button>
            </Group>
          )}
        </Group>

        <Select
          placeholder="Seleziona una lezione..."
          data={completedLessons.map(lesson => ({
            value: lesson.id,
            label: `${lesson.title || 'Lezione'} - ${new Date(lesson.startTime).toLocaleDateString('it-IT')}`,
          }))}
          value={selectedLesson}
          onChange={(value) => setSelectedLesson(value || '')}
          searchable
          mb="md"
        />

        {/* Statistics */}
        {stats && selectedLesson && (
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card withBorder p="sm">
                <Group justify="space-between">
                  <div>
                    <Text c="dimmed" size="xs">Tasso Presenze</Text>
                    <Text fw={700} size="lg" c="green">{stats.rate}%</Text>
                  </div>
                  <IconChartBar size={24} color="var(--mantine-color-green-6)" />
                </Group>
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card withBorder p="sm">
                <Group justify="space-between">
                  <div>
                    <Text c="dimmed" size="xs">Presenti</Text>
                    <Text fw={700} size="lg">{stats.present}/{stats.total}</Text>
                  </div>
                  <IconCheck size={24} color="var(--mantine-color-green-6)" />
                </Group>
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card withBorder p="sm">
                <Group justify="space-between">
                  <div>
                    <Text c="dimmed" size="xs">Assenti</Text>
                    <Text fw={700} size="lg">{stats.absent}</Text>
                  </div>
                  <IconX size={24} color="var(--mantine-color-red-6)" />
                </Group>
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card withBorder p="sm">
                <Group justify="space-between">
                  <div>
                    <Text c="dimmed" size="xs">Da Registrare</Text>
                    <Text fw={700} size="lg">{stats.total - stats.marked}</Text>
                  </div>
                  <IconUsers size={24} color="var(--mantine-color-gray-6)" />
                </Group>
              </Card>
            </Grid.Col>
          </Grid>
        )}
      </Paper>

      {/* Attendance Table */}
      {selectedLesson ? (
        <Paper p="md" withBorder>
          <LoadingOverlay visible={loading} />
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Studente</Table.Th>
                <Table.Th>Stato</Table.Th>
                {canEdit && <Table.Th>Azioni Rapide</Table.Th>}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {students.map(student => {
                const key = getAttendanceKey(student.id, selectedLesson);
                const record = attendanceData.get(key);
                const status = record?.status;

                return (
                  <Table.Tr key={student.id}>
                    <Table.Td>
                      <Group gap="sm">
                        <Avatar size="sm" color="blue">
                          {student.firstName[0]}{student.lastName[0]}
                        </Avatar>
                        <div>
                          <Text fw={500} size="sm">
                            {student.firstName} {student.lastName}
                          </Text>
                          {student.studentCode && (
                            <Text size="xs" c="dimmed">
                              #{student.studentCode}
                            </Text>
                          )}
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {status ? (
                        <Badge
                          color={ATTENDANCE_STATUS[status].color}
                          leftSection={React.createElement(ATTENDANCE_STATUS[status].icon, { size: 14 })}
                        >
                          {ATTENDANCE_STATUS[status].label}
                        </Badge>
                      ) : (
                        <Badge color="gray">Non registrato</Badge>
                      )}
                    </Table.Td>
                    {canEdit && (
                      <Table.Td>
                        <Group gap="xs">
                          {Object.entries(ATTENDANCE_STATUS).map(([statusKey, config]) => (
                            <Tooltip key={statusKey} label={config.label}>
                              <ActionIcon
                                variant={status === statusKey ? 'filled' : 'outline'}
                                color={config.color}
                                size="sm"
                                onClick={() => updateAttendanceStatus(
                                  student.id, 
                                  selectedLesson, 
                                  statusKey as keyof typeof ATTENDANCE_STATUS
                                )}
                              >
                                {React.createElement(config.icon, { size: 14 })}
                              </ActionIcon>
                            </Tooltip>
                          ))}
                        </Group>
                      </Table.Td>
                    )}
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Paper>
      ) : (
        <Alert icon={<IconInfoCircle />} color="blue">
          Seleziona una lezione per visualizzare e gestire le presenze
        </Alert>
      )}
    </Stack>
  );
}
