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
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      padding: '24px'
    }}>
      <Container size="xl">
        <Stack gap="lg">
          <Group justify="space-between" align="center">
            <Title 
              order={1}
              style={{ 
                color: 'white',
                fontSize: '2.5rem',
                fontWeight: 700,
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}
            >
              {t('title')}
            </Title>
            <Group>
              <Button
                variant="light"
                leftSection={<IconDownload size={16} />}
                onClick={() => handleExportAttendance('xlsx')}
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  color: '#4ade80',
                  backdropFilter: 'blur(10px)'
                }}
              >
                {t('exportExcel')}
              </Button>
              <Button
                leftSection={<IconCalendar size={16} />}
                onClick={openAttendanceModal}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  border: 'none',
                  boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
                }}
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
                <Card 
                  shadow="lg" 
                  padding="lg" 
                  radius="md"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
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
              <Card 
                shadow="lg" 
                padding="lg" 
                radius="md"
                style={{
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <Group justify="space-between">
                  <div>
                    <Text size="sm" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      {t('totalRecords')}
                    </Text>
                    <Text size="xl" fw={700} style={{ color: 'white' }}>
                      {stats.totalRecords}
                    </Text>
                  </div>
                  <IconUsers size={32} color="#3b82f6" />
                </Group>
              </Card>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card 
                shadow="lg" 
                padding="lg" 
                radius="md"
                style={{
                  background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(21, 128, 61, 0.1) 100%)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <Group justify="space-between">
                  <div>
                    <Text size="sm" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      {t('attendanceRate')}
                    </Text>
                    <Text size="xl" fw={700} style={{ color: 'white' }}>
                      {stats.attendanceRate.toFixed(1)}%
                    </Text>
                    <Progress 
                      value={stats.attendanceRate} 
                      size="xs" 
                      color={stats.attendanceRate > 80 ? 'green' : stats.attendanceRate > 60 ? 'yellow' : 'red'} 
                      style={{ marginTop: '4px' }}
                    />
                  </div>
                  <IconChartBar size={32} color="#22c55e" />
                </Group>
              </Card>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card 
                shadow="lg" 
                padding="lg" 
                radius="md"
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.1) 100%)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <Group justify="space-between">
                  <div>
                    <Text size="sm" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      {t('presentCount')}
                    </Text>
                    <Text size="xl" fw={700} style={{ color: '#10b981' }}>
                      {stats.presentCount}
                    </Text>
                  </div>
                  <IconCheck size={32} color="#10b981" />
                </Group>
              </Card>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <Card 
                shadow="lg" 
                padding="lg" 
                radius="md"
                style={{
                  background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.1) 100%)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <Group justify="space-between">
                  <div>
                    <Text size="sm" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      {t('absentCount')}
                    </Text>
                    <Text size="xl" fw={700} style={{ color: '#ef4444' }}>
                      {stats.absentCount}
                    </Text>
                  </div>
                  <IconX size={32} color="#ef4444" />
                </Group>
              </Card>
            </Grid.Col>
          </Grid>
        ) : null}

        {/* Main Content Tabs */}
        <Tabs 
          value={activeTab} 
          onChange={(value) => value && setActiveTab(value)}
          style={{
            '--mantine-tabs-list-border-color': 'rgba(255, 255, 255, 0.1)',
          }}
        >
          <Tabs.List 
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '4px'
            }}
          >
            <Tabs.Tab 
              value="record" 
              leftSection={<IconCalendar size={16} />}
              style={{
                color: activeTab === 'record' ? 'white' : 'rgba(255, 255, 255, 0.7)',
                backgroundColor: activeTab === 'record' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                borderRadius: '8px',
                border: 'none'
              }}
            >
              Registro Presenze
            </Tabs.Tab>
            <Tabs.Tab 
              value="reports" 
              leftSection={<IconChartBar size={16} />}
              style={{
                color: activeTab === 'reports' ? 'white' : 'rgba(255, 255, 255, 0.7)',
                backgroundColor: activeTab === 'reports' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                borderRadius: '8px',
                border: 'none'
              }}
            >
              Report Classe
            </Tabs.Tab>
            <Tabs.Tab 
              value="history" 
              leftSection={<IconFileText size={16} />}
              style={{
                color: activeTab === 'history' ? 'white' : 'rgba(255, 255, 255, 0.7)',
                backgroundColor: activeTab === 'history' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                borderRadius: '8px',
                border: 'none'
              }}
            >
              Storico
            </Tabs.Tab>
          </Tabs.List>

          {/* Attendance Records Tab */}
          <Tabs.Panel value="record" pt="lg">
            <Stack gap="md">
              <Paper 
                p="md" 
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '12px'
                }}
              >
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
                    styles={{
                      input: {
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        '&::placeholder': { color: 'rgba(255, 255, 255, 0.5)' },
                      },
                      dropdown: {
                        background: '#1e293b',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                      },
                      option: {
                        color: 'white',
                        '&[data-selected]': {
                          background: 'rgba(59, 130, 246, 0.3)',
                        },
                      },
                    }}
                  />
                  <Button
                    onClick={openAttendanceModal}
                    disabled={!selectedLessonId}
                    style={{
                      background: selectedLessonId ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                    }}
                  >
                    Registra Presenze
                  </Button>
                </Group>
              </Paper>

              {selectedLessonId && (
                <Paper 
                  p="lg" 
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                    borderRadius: '16px'
                  }}
                >
                  <LoadingOverlay visible={lessonAttendanceLoading} />
                  <Title order={3} mb="md" style={{ color: 'white' }}>
                    Presenze per la Lezione Selezionata
                  </Title>
                  
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255, 255, 255, 0.1)'
                  }}>
                    <Table 
                      striped 
                      highlightOnHover
                      style={{
                        '--table-hover-color': 'rgba(255, 255, 255, 0.05)',
                        '--table-striped-color': 'rgba(255, 255, 255, 0.02)'
                      }}
                    >
                      <Table.Thead style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
                        <Table.Tr>
                          <Table.Th style={{ color: 'white', fontWeight: 600 }}>Studente</Table.Th>
                          <Table.Th style={{ color: 'white', fontWeight: 600 }}>Stato</Table.Th>
                          <Table.Th style={{ color: 'white', fontWeight: 600 }}>Note</Table.Th>
                          <Table.Th style={{ color: 'white', fontWeight: 600 }}>Registrato il</Table.Th>
                          <Table.Th style={{ color: 'white', fontWeight: 600 }}>Azioni</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {lessonAttendance?.map((record: AttendanceRecord) => (
                          <Table.Tr key={record.id}>
                            <Table.Td>
                              <div>
                                <Text size="sm" fw={500} style={{ color: 'white' }}>
                                  {record.student.firstName} {record.student.lastName}
                                </Text>
                                <Text size="xs" style={{ color: 'rgba(255, 255, 255, 0.6)' }}>
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
                              <Text size="sm" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                                {record.notes || '-'}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="xs" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
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
                  </div>
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
                            {record.lesson.course?.name || 'No Course'} - {record.lesson.teacher?.firstName || 'Unknown'} {record.lesson.teacher?.lastName || 'Teacher'}
                          </Text>
                        </div>
                      </Table.Td>
                      <Table.Td>
                        <div>
                          <Text size="sm" fw={500}>
                            {record.student?.firstName || 'Unknown'} {record.student?.lastName || 'Student'}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {record.student?.email || 'No email'}
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
        styles={{
          content: {
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          },
          header: {
            background: 'transparent',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          },
          title: {
            color: 'white',
            fontSize: '1.25rem',
            fontWeight: 600,
          },
        }}
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
              styles={{
                label: { color: 'white', fontWeight: 500 },
                input: {
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  '&::placeholder': { color: 'rgba(255, 255, 255, 0.5)' },
                },
                dropdown: {
                  background: '#1e293b',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                },
                option: {
                  color: 'white',
                  '&[data-selected]': {
                    background: 'rgba(59, 130, 246, 0.3)',
                  },
                },
              }}
            />

            {form.values.lessonId && (
              <Paper 
                p="md" 
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '12px'
                }}
              >
                <Text size="sm" style={{ color: 'rgba(255, 255, 255, 0.8)' }} mb="md">
                  Seleziona lo stato di presenza per ogni studente
                </Text>
                
                <Alert 
                  color="blue"
                  style={{
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.2)',
                    color: '#60a5fa'
                  }}
                >
                  Implementazione del form di presenza per studenti in corso...
                </Alert>
              </Paper>
            )}

            <Group justify="flex-end" mt="md">
              <Button 
                variant="light" 
                onClick={closeAttendanceModal}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'rgba(255, 255, 255, 0.8)',
                  border: 'none',
                }}
              >
                Annulla
              </Button>
              <Button 
                type="submit" 
                loading={isSaving}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                  border: 'none',
                }}
              >
                Registra Presenze
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>
      </Container>
    </div>
  );
}
