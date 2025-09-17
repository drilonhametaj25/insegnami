'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Container,
  Title,
  Paper,
  Button,
  Group,
  Stack,
  Select,
  Text,
  Badge,
  Table,
  Checkbox,
  Textarea,
  Modal,
  Grid,
  Card,
  Alert,
  ActionIcon,
  Tabs,
  LoadingOverlay,
  Skeleton,
  TextInput,
  Progress,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconX,
  IconClock,
  IconCalendar,
  IconUsers,
  IconDownload,
  IconEye,
  IconEdit,
  IconFileText,
  IconSearch,
  IconChartBar,
} from '@tabler/icons-react';
import { DatePickerInput } from '@mantine/dates';
import dayjs from 'dayjs';
import {
  useAttendance,
  useAttendanceStats,
  useLessonAttendance,
  useRecordAttendance,
  useUpdateAttendance,
  useStudentAttendanceStats,
  useClassAttendanceSummary,
  useExportAttendance,
  type AttendanceRecord,
  type AttendanceStats,
  type StudentAttendanceSummary,
  type CreateAttendanceData
} from '@/lib/hooks/useAttendance';
import { useLessons } from '@/lib/hooks/useLessons';
import { useClasses } from '@/lib/hooks/useClasses';

interface AttendanceFormData {
  lessonId: string;
  attendance: {
    studentId: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
    notes?: string;
  }[];
}

export default function AttendancePage() {
  const t = useTranslations('attendance');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  
  const [activeTab, setActiveTab] = useState('record');
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [attendanceModalOpened, { open: openAttendanceModal, close: closeAttendanceModal }] = useDisclosure(false);
  const [currentPage, setCurrentPage] = useState(1);

  // TanStack Query hooks
  const {
    data: attendanceData,
    isLoading: attendanceLoading,
  } = useAttendance(currentPage, 20);

  const {
    data: stats,
    isLoading: statsLoading,
  } = useAttendanceStats();

  const {
    data: lessonsData,
    isLoading: lessonsLoading,
  } = useLessons();

  const {
    data: classesData,
    isLoading: classesLoading,
  } = useClasses();

  const {
    data: lessonAttendance,
    isLoading: lessonAttendanceLoading,
  } = useLessonAttendance(selectedLessonId);

  const {
    data: classSummary,
    isLoading: classSummaryLoading,
  } = useClassAttendanceSummary(selectedClassId, 'month');

  const recordAttendance = useRecordAttendance();
  const updateAttendance = useUpdateAttendance();
  const exportAttendance = useExportAttendance();

  const attendance = attendanceData?.attendance || [];
  const lessons = lessonsData?.lessons || [];
  const classes = classesData?.classes || [];

  const form = useForm<AttendanceFormData>({
    initialValues: {
      lessonId: '',
      attendance: [],
    },
  });

  const handleRecordAttendance = (values: AttendanceFormData) => {
    const attendanceData: CreateAttendanceData = {
      lessonId: values.lessonId,
      attendance: values.attendance,
    };

    recordAttendance.mutate(attendanceData, {
      onSuccess: () => {
        notifications.show({
          title: 'Successo',
          message: 'Presenze registrate con successo',
          color: 'green',
        });
        closeAttendanceModal();
        form.reset();
      },
      onError: (error) => {
        notifications.show({
          title: 'Errore',
          message: error.message || 'Errore nella registrazione delle presenze',
          color: 'red',
        });
      },
    });
  };

  const handleUpdateAttendanceRecord = (
    recordId: string, 
    status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED',
    notes?: string
  ) => {
    updateAttendance.mutate(
      {
        id: recordId,
        data: { status, notes },
      },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Successo',
            message: 'Presenza aggiornata con successo',
            color: 'green',
          });
        },
        onError: (error) => {
          notifications.show({
            title: 'Errore',
            message: error.message || 'Errore nell\'aggiornamento della presenza',
            color: 'red',
          });
        },
      }
    );
  };

  const handleExportAttendance = (format: 'csv' | 'xlsx' | 'pdf') => {
    exportAttendance.mutate(
      {
        format,
        classId: selectedClassId || undefined,
      },
      {
        onError: (error) => {
          notifications.show({
            title: 'Errore',
            message: error.message || 'Errore nell\'esportazione',
            color: 'red',
          });
        },
      }
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PRESENT': return 'green';
      case 'LATE': return 'yellow';
      case 'ABSENT': return 'red';
      case 'EXCUSED': return 'blue';
      default: return 'gray';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PRESENT': return t('present');
      case 'LATE': return t('late');
      case 'ABSENT': return t('absent');
      case 'EXCUSED': return t('excused');
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PRESENT': return <IconCheck size={16} />;
      case 'LATE': return <IconClock size={16} />;
      case 'ABSENT': return <IconX size={16} />;
      case 'EXCUSED': return <IconFileText size={16} />;
      default: return null;
    }
  };

  const isLoading = attendanceLoading || statsLoading || lessonsLoading || classesLoading;
  const isSaving = recordAttendance.isPending || updateAttendance.isPending;

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Title order={1}>{t('title')}</Title>
          <Group>
            <Button
              variant="light"
              leftSection={<IconDownload size={16} />}
              onClick={() => handleExportAttendance('xlsx')}
            >
              {t('exportExcel')}
            </Button>
            <Button
              leftSection={<IconCalendar size={16} />}
              onClick={openAttendanceModal}
            >
              {t('recordAttendance')}
            </Button>
          </Group>
        </Group>

        {/* Statistics Cards */}
        {statsLoading ? (
          <Grid>
            {[1, 2, 3, 4].map((i) => (
              <Grid.Col key={i} span={{ base: 12, sm: 6, md: 3 }}>
                <Card shadow="sm" padding="lg" radius="md" withBorder>
                  <Skeleton height={20} mb="xs" />
                  <Skeleton height={32} mb="xs" />
                  <Skeleton height={16} />
                </Card>
              </Grid.Col>
            ))}
          </Grid>
        ) : stats ? (
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="sm" c="dimmed">{t('totalRecords')}</Text>
                    <Text size="xl" fw={700}>{stats.totalRecords}</Text>
                  </div>
                  <IconUsers size={32} color="var(--mantine-color-blue-6)" />
                </Group>
              </Card>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="sm" c="dimmed">{t('attendanceRate')}</Text>
                    <Text size="xl" fw={700}>{stats.attendanceRate.toFixed(1)}%</Text>
                    <Progress 
                      value={stats.attendanceRate} 
                      size="xs" 
                      color={stats.attendanceRate > 80 ? 'green' : stats.attendanceRate > 60 ? 'yellow' : 'red'} 
                    />
                  </div>
                  <IconChartBar size={32} color="var(--mantine-color-green-6)" />
                </Group>
              </Card>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="sm" c="dimmed">{t('presentCount')}</Text>
                    <Text size="xl" fw={700} c="green">{stats.presentCount}</Text>
                  </div>
                  <IconCheck size={32} color="var(--mantine-color-green-6)" />
                </Group>
              </Card>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card shadow="sm" padding="lg" radius="md" withBorder>
                <Group justify="space-between">
                  <div>
                    <Text size="sm" c="dimmed">{t('absentCount')}</Text>
                    <Text size="xl" fw={700} c="red">{stats.absentCount}</Text>
                  </div>
                  <IconX size={32} color="var(--mantine-color-red-6)" />
                </Group>
              </Card>
            </Grid.Col>
          </Grid>
        ) : null}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onChange={(value) => value && setActiveTab(value)}>
          <Tabs.List>
            <Tabs.Tab value="record" leftSection={<IconCalendar size={16} />}>
              Registro Presenze
            </Tabs.Tab>
            <Tabs.Tab value="reports" leftSection={<IconChartBar size={16} />}>
              Report Classe
            </Tabs.Tab>
            <Tabs.Tab value="history" leftSection={<IconFileText size={16} />}>
              Storico
            </Tabs.Tab>
          </Tabs.List>

          {/* Attendance Records Tab */}
          <Tabs.Panel value="record" pt="lg">
            <Stack gap="md">
              <Paper p="md" withBorder>
                <Group>
                  <Select
                    placeholder="Seleziona lezione"
                    data={lessons.map(l => ({
                      value: l.id,
                      label: `${l.title} - ${dayjs(l.startTime).format('DD/MM/YYYY HH:mm')}`,
                    }))}
                    value={selectedLessonId}
                    onChange={(value) => setSelectedLessonId(value || '')}
                    style={{ flex: 1 }}
                    searchable
                  />
                  <Button
                    onClick={openAttendanceModal}
                    disabled={!selectedLessonId}
                  >
                    Registra Presenze
                  </Button>
                </Group>
              </Paper>

              {selectedLessonId && (
                <Paper p="lg" withBorder>
                  <LoadingOverlay visible={lessonAttendanceLoading} />
                  <Title order={3} mb="md">
                    Presenze per la Lezione Selezionata
                  </Title>
                  
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Studente</Table.Th>
                        <Table.Th>Stato</Table.Th>
                        <Table.Th>Note</Table.Th>
                        <Table.Th>Registrato il</Table.Th>
                        <Table.Th>Azioni</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {lessonAttendance?.map((record: AttendanceRecord) => (
                        <Table.Tr key={record.id}>
                          <Table.Td>
                            <div>
                              <Text size="sm" fw={500}>
                                {record.student.firstName} {record.student.lastName}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {record.student.email}
                              </Text>
                            </div>
                          </Table.Td>
                          <Table.Td>
                            <Badge
                              color={getStatusColor(record.status)}
                              variant="light"
                              leftSection={getStatusIcon(record.status)}
                            >
                              {getStatusLabel(record.status)}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{record.notes || '-'}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs">
                              {dayjs(record.recordedAt).format('DD/MM/YYYY HH:mm')}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <ActionIcon
                              variant="light"
                              color="blue"
                              size="sm"
                              onClick={() => {
                                // TODO: Implement edit attendance modal
                              }}
                            >
                              <IconEdit size={14} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Paper>
              )}
            </Stack>
          </Tabs.Panel>

          {/* Class Reports Tab */}
          <Tabs.Panel value="reports" pt="lg">
            <Stack gap="md">
              <Paper p="md" withBorder>
                <Group>
                  <Select
                    placeholder="Seleziona classe"
                    data={classes.map(c => ({
                      value: c.id,
                      label: `${c.name} - ${c.course?.name || 'Nessun corso'}`,
                    }))}
                    value={selectedClassId}
                    onChange={(value) => setSelectedClassId(value || '')}
                    style={{ flex: 1 }}
                    searchable
                  />
                  <Button
                    variant="light"
                    leftSection={<IconDownload size={16} />}
                    onClick={() => handleExportAttendance('pdf')}
                    disabled={!selectedClassId}
                  >
                    Esporta Report
                  </Button>
                </Group>
              </Paper>

              {selectedClassId && classSummary && (
                <Paper p="lg" withBorder>
                  <LoadingOverlay visible={classSummaryLoading} />
                  
                  <Title order={3} mb="md">
                    Report Presenze - {classSummary.class.name}
                  </Title>

                  <Grid mb="lg">
                    <Grid.Col span={3}>
                      <Card withBorder>
                        <Text size="sm" c="dimmed">Studenti Totali</Text>
                        <Text size="xl" fw={700}>{classSummary.totalStudents}</Text>
                      </Card>
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <Card withBorder>
                        <Text size="sm" c="dimmed">Lezioni Totali</Text>
                        <Text size="xl" fw={700}>{classSummary.totalLessons}</Text>
                      </Card>
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <Card withBorder>
                        <Text size="sm" c="dimmed">Tasso Medio Presenze</Text>
                        <Text size="xl" fw={700}>
                          {classSummary.averageAttendanceRate.toFixed(1)}%
                        </Text>
                      </Card>
                    </Grid.Col>
                  </Grid>

                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Studente</Table.Th>
                        <Table.Th>Presenze</Table.Th>
                        <Table.Th>Assenze</Table.Th>
                        <Table.Th>Ritardi</Table.Th>
                        <Table.Th>Tasso Presenza</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {classSummary.studentSummaries.map((studentSummary: StudentAttendanceSummary) => (
                        <Table.Tr key={studentSummary.studentId}>
                          <Table.Td>
                            <div>
                              <Text size="sm" fw={500}>
                                {studentSummary.student.firstName} {studentSummary.student.lastName}
                              </Text>
                              <Text size="xs" c="dimmed">
                                {studentSummary.student.registrationNumber}
                              </Text>
                            </div>
                          </Table.Td>
                          <Table.Td>
                            <Badge color="green" variant="light">
                              {studentSummary.presentCount}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge color="red" variant="light">
                              {studentSummary.absentCount}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Badge color="yellow" variant="light">
                              {studentSummary.lateCount}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              <Text size="sm" fw={500}>
                                {studentSummary.attendanceRate.toFixed(1)}%
                              </Text>
                              <Progress
                                value={studentSummary.attendanceRate}
                                size="xs"
                                color={
                                  studentSummary.attendanceRate > 80 ? 'green' :
                                  studentSummary.attendanceRate > 60 ? 'yellow' : 'red'
                                }
                                style={{ width: 60 }}
                              />
                            </Group>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Paper>
              )}
            </Stack>
          </Tabs.Panel>

          {/* Attendance History Tab */}
          <Tabs.Panel value="history" pt="lg">
            <Paper p="lg" withBorder>
              <LoadingOverlay visible={attendanceLoading} />
              
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Data</Table.Th>
                    <Table.Th>Lezione</Table.Th>
                    <Table.Th>Studente</Table.Th>
                    <Table.Th>Stato</Table.Th>
                    <Table.Th>Note</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {attendance.map((record: AttendanceRecord) => (
                    <Table.Tr key={record.id}>
                      <Table.Td>
                        <Text size="sm">
                          {dayjs(record.lesson.startTime).format('DD/MM/YYYY')}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <div>
                          <Text size="sm" fw={500}>
                            {record.lesson.title}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {record.lesson.course.name} - {record.lesson.teacher.firstName} {record.lesson.teacher.lastName}
                          </Text>
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <div>
                          <Text size="sm" fw={500}>
                            {record.student.firstName} {record.student.lastName}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {record.student.email}
                          </Text>
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          color={getStatusColor(record.status)}
                          variant="light"
                          leftSection={getStatusIcon(record.status)}
                        >
                          {getStatusLabel(record.status)}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{record.notes || '-'}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          </Tabs.Panel>
        </Tabs>
      </Stack>

      {/* Attendance Recording Modal */}
      <Modal
        opened={attendanceModalOpened}
        onClose={closeAttendanceModal}
        title="Registra Presenze"
        size="xl"
      >
        <form onSubmit={form.onSubmit(handleRecordAttendance)}>
          <Stack gap="md">
            <Select
              label="Lezione"
              placeholder="Seleziona lezione"
              data={lessons.map(l => ({
                value: l.id,
                label: `${l.title} - ${dayjs(l.startTime).format('DD/MM/YYYY HH:mm')}`,
              }))}
              {...form.getInputProps('lessonId')}
              searchable
            />

            {form.values.lessonId && (
              <Paper p="md" withBorder>
                <Text size="sm" c="dimmed" mb="md">
                  Seleziona lo stato di presenza per ogni studente
                </Text>
                
                {/* TODO: Add students attendance form based on selected lesson */}
                <Alert color="blue">
                  Implementazione del form di presenza per studenti in corso...
                </Alert>
              </Paper>
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="light" onClick={closeAttendanceModal}>
                Annulla
              </Button>
              <Button type="submit" loading={isSaving}>
                Registra Presenze
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
    </Container>
  );
}
