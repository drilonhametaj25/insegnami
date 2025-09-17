'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Container,
  Title,
  Grid,
  Paper,
  Text,
  Badge,
  Button,
  Group,
  Stack,
  Tabs,
  Avatar,
  Card,
  Progress,
  Timeline,
  ActionIcon,
  Tooltip,
  LoadingOverlay,
  Divider,
  Alert,
} from '@mantine/core';
import {
  IconUser,
  IconPhone,
  IconMail,
  IconCalendar,
  IconMapPin,
  IconSchool,
  IconCoin,
  IconChartLine,
  IconEdit,
  IconTrash,
  IconArrowLeft,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconClock,
  IconBook,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useStudents, useStudentById, useUpdateStudent } from '@/lib/hooks/useStudents';
import { useAttendance } from '@/lib/hooks/useAttendance';
import { usePayments } from '@/lib/hooks/usePayments';
import { AdvancedDataTable, createCellRenderers } from '@/components/tables/AdvancedDataTable';
import { DashboardCharts } from '@/components/charts/DashboardCharts';
import { StudentForm } from '@/components/forms/StudentForm';
import { useDisclosure } from '@mantine/hooks';

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslations('students');
  const tc = useTranslations('common');
  const ta = useTranslations('attendance');
  const tp = useTranslations('payments');
  
  const studentId = params.id as string;
  const [activeTab, setActiveTab] = useState('overview');
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);

  // Fetch student data
  const { data: student, isLoading: studentLoading, error: studentError } = useStudentById(studentId);
  
  // Fetch related data
  const { data: attendanceData, isLoading: attendanceLoading } = useAttendance(1, 50, {
    studentId,
    sortBy: 'date',
    sortOrder: 'desc'
  });
  
  const { data: paymentsData, isLoading: paymentsLoading } = usePayments(1, 50, {
    studentId,
    sortBy: 'dueDate',
    sortOrder: 'desc'
  });

  const { mutateAsync: updateStudent } = useUpdateStudent();

  if (studentLoading) {
    return (
      <Container size="xl" py="md">
        <LoadingOverlay visible />
      </Container>
    );
  }

  if (studentError || !student) {
    return (
      <Container size="xl" py="md">
        <Alert icon={<IconAlertCircle size={16} />} title={tc('error')} color="red">
          {t('studentNotFound')}
        </Alert>
      </Container>
    );
  }

  const handleEdit = () => {
    openEditModal();
  };

  const handleDelete = () => {
    modals.openConfirmModal({
      title: t('confirmDelete'),
      children: (
        <Text size="sm">
          {t('confirmDeleteMessage', { name: `${student.firstName} ${student.lastName}` })}
        </Text>
      ),
      labels: { confirm: tc('delete'), cancel: tc('cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          // API call to delete student
          notifications.show({
            title: tc('success'),
            message: t('deleteSuccess'),
            color: 'green',
          });
          router.push('/dashboard/students');
        } catch (error) {
          notifications.show({
            title: tc('error'),
            message: t('deleteError'),
            color: 'red',
          });
        }
      },
    });
  };

  const handleSaveStudent = async (studentData: any) => {
    try {
      await updateStudent({ id: studentId, data: studentData });
      notifications.show({
        title: tc('success'),
        message: t('updateSuccess'),
        color: 'green',
      });
      closeEditModal();
    } catch (error) {
      notifications.show({
        title: tc('error'),
        message: t('updateError'),
        color: 'red',
      });
    }
  };

  // Calculate statistics
  const totalLessons = attendanceData?.attendance?.length || 0;
  const presentCount = attendanceData?.attendance?.filter(a => a.status === 'PRESENT').length || 0;
  const attendanceRate = totalLessons > 0 ? (presentCount / totalLessons) * 100 : 0;
  
  const totalPayments = paymentsData?.payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const paidAmount = paymentsData?.payments?.filter(p => p.status === 'PAID')
    .reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const pendingAmount = totalPayments - paidAmount;

  // Table columns
  const attendanceColumns = [
    {
      accessorKey: 'createdAt',
      header: ta('date'),
      cell: ({ getValue }: any) => {
        const value = getValue();
        return value ? new Date(value).toLocaleDateString() : '-';
      },
    },
    {
      accessorKey: 'lesson',
      header: ta('lesson'),
      cell: ({ getValue }: any) => {
        const value = getValue();
        return value?.title || 'N/A';
      },
    },
    {
      ...createCellRenderers.badge('status', {
        PRESENT: 'green',
        ABSENT: 'red',
        LATE: 'yellow',
        EXCUSED: 'blue',
      }),
      header: ta('status'),
    },
    {
      accessorKey: 'arrivedAt',
      header: ta('arrivedAt'),
      cell: ({ getValue }: any) => {
        const value = getValue();
        return value ? new Date(value).toLocaleTimeString() : '-';
      },
    },
    {
      accessorKey: 'leftAt',
      header: ta('leftAt'),
      cell: ({ getValue }: any) => {
        const value = getValue();
        return value ? new Date(value).toLocaleTimeString() : '-';
      },
    },
    {
      accessorKey: 'notes',
      header: ta('notes'),
      cell: ({ getValue }: any) => getValue() || '-',
    },
  ];

  const paymentColumns = [
    {
      ...createCellRenderers.date('dueDate'),
      header: tp('dueDate'),
    },
    {
      ...createCellRenderers.currency('amount'),
      header: tp('amount'),
    },
    {
      ...createCellRenderers.badge('status', {
        PAID: 'green',
        PENDING: 'yellow',
        OVERDUE: 'red',
        CANCELLED: 'gray',
      }),
      header: tp('status'),
    },
    {
      ...createCellRenderers.date('paidDate'),
      header: tp('paidDate'),
    },
    {
      accessorKey: 'notes',
      header: tp('notes'),
      cell: ({ getValue }: any) => getValue() || '-',
    },
  ];

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <ActionIcon variant="subtle" onClick={() => router.back()}>
              <IconArrowLeft size={20} />
            </ActionIcon>
            <Title order={2}>{t('studentDetails')}</Title>
          </Group>
          <Group>
            <Button leftSection={<IconEdit size={16} />} onClick={handleEdit}>
              {tc('edit')}
            </Button>
            <Button
              leftSection={<IconTrash size={16} />}
              color="red"
              variant="light"
              onClick={handleDelete}
            >
              {tc('delete')}
            </Button>
          </Group>
        </Group>

        {/* Student Profile Card */}
        <Paper p="lg" withBorder>
          <Grid>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Stack align="center" gap="sm">
                <Avatar size={120} radius="md">
                  {student.firstName[0]}{student.lastName[0]}
                </Avatar>
                <Stack gap={4} align="center">
                  <Title order={3}>{student.firstName} {student.lastName}</Title>
                  <Badge color={student.status === 'ACTIVE' ? 'green' : 'gray'}>
                    {t(`status.${student.status.toLowerCase()}`)}
                  </Badge>
                  <Text size="sm" c="dimmed">
                    {t('studentCode')}: {student.studentCode || 'N/A'}
                  </Text>
                </Stack>
              </Stack>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Stack gap="md">
                <Title order={4}>{t('personalInfo')}</Title>
                <Grid>
                  <Grid.Col span={6}>
                    <Group gap="sm">
                      <IconMail size={16} color="gray" />
                      <Text size="sm">{student.email || 'N/A'}</Text>
                    </Group>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Group gap="sm">
                      <IconPhone size={16} color="gray" />
                      <Text size="sm">{student.phone || 'N/A'}</Text>
                    </Group>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Group gap="sm">
                      <IconCalendar size={16} color="gray" />
                      <Text size="sm">
                        {student.dateOfBirth 
                          ? new Date(student.dateOfBirth).toLocaleDateString()
                          : 'N/A'
                        }
                      </Text>
                    </Group>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Group gap="sm">
                      <IconMapPin size={16} color="gray" />
                      <Text size="sm">{student.address || 'N/A'}</Text>
                    </Group>
                  </Grid.Col>
                </Grid>

                {student.parentName && (
                  <>
                    <Divider mt="md" />
                    <Title order={5}>{t('parentInfo')}</Title>
                    <Grid>
                      <Grid.Col span={6}>
                        <Group gap="sm">
                          <IconUser size={16} color="gray" />
                          <Text size="sm">{student.parentName}</Text>
                        </Group>
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Group gap="sm">
                          <IconMail size={16} color="gray" />
                          <Text size="sm">{student.parentEmail || 'N/A'}</Text>
                        </Group>
                      </Grid.Col>
                      <Grid.Col span={6}>
                        <Group gap="sm">
                          <IconPhone size={16} color="gray" />
                          <Text size="sm">{student.parentPhone || 'N/A'}</Text>
                        </Group>
                      </Grid.Col>
                    </Grid>
                  </>
                )}
              </Stack>
            </Grid.Col>
          </Grid>
        </Paper>

        {/* Statistics Cards */}
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card withBorder p="md">
              <Group justify="space-between">
                <Stack gap={4}>
                  <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                    {ta('attendanceRate')}
                  </Text>
                  <Text fw={700} size="xl">
                    {attendanceRate.toFixed(1)}%
                  </Text>
                </Stack>
                <IconChartLine size={32} color="blue" />
              </Group>
              <Progress value={attendanceRate} mt="md" />
            </Card>
          </Grid.Col>
          
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card withBorder p="md">
              <Group justify="space-between">
                <Stack gap={4}>
                  <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                    {ta('totalLessons')}
                  </Text>
                  <Text fw={700} size="xl">
                    {totalLessons}
                  </Text>
                </Stack>
                <IconBook size={32} color="green" />
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card withBorder p="md">
              <Group justify="space-between">
                <Stack gap={4}>
                  <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                    {tp('totalAmount')}
                  </Text>
                  <Text fw={700} size="xl">
                    €{totalPayments.toFixed(2)}
                  </Text>
                </Stack>
                <IconCoin size={32} color="yellow" />
              </Group>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card withBorder p="md">
              <Group justify="space-between">
                <Stack gap={4}>
                  <Text size="xs" tt="uppercase" fw={700} c="dimmed">
                    {tp('pendingAmount')}
                  </Text>
                  <Text fw={700} size="xl" c={pendingAmount > 0 ? 'red' : 'green'}>
                    €{pendingAmount.toFixed(2)}
                  </Text>
                </Stack>
                <IconAlertCircle size={32} color={pendingAmount > 0 ? 'red' : 'green'} />
              </Group>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'overview')}>
          <Tabs.List>
            <Tabs.Tab value="overview">
              {t('overview')}
            </Tabs.Tab>
            <Tabs.Tab value="attendance">
              {ta('title')}
            </Tabs.Tab>
            <Tabs.Tab value="payments">
              {tp('title')}
            </Tabs.Tab>
            <Tabs.Tab value="classes">
              {t('classes')}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" mt="md">
            <Grid>
              <Grid.Col span={{ base: 12, lg: 8 }}>
                <Paper p="md" withBorder>
                  <Title order={4} mb="md">{ta('recentAttendance')}</Title>
                  <Timeline active={-1} bulletSize={24} lineWidth={2}>
                    {attendanceData?.attendance?.slice(0, 5).map((record, index) => (
                      <Timeline.Item
                        key={record.id}
                        bullet={record.status === 'PRESENT' ? <IconCheck size={12} /> : <IconX size={12} />}
                        title={record.lesson?.title || 'N/A'}
                        color={record.status === 'PRESENT' ? 'green' : 'red'}
                      >
                        <Text c="dimmed" size="sm">
                          {new Date(record.createdAt).toLocaleDateString()} - {record.status}
                        </Text>
                        {record.notes && (
                          <Text size="xs" mt={4}>{record.notes}</Text>
                        )}
                      </Timeline.Item>
                    ))}
                  </Timeline>
                </Paper>
              </Grid.Col>
              
              <Grid.Col span={{ base: 12, lg: 4 }}>
                <Paper p="md" withBorder>
                  <Title order={4} mb="md">{t('enrolledClasses')}</Title>
                  <Stack gap="sm">
                    {student.classes?.map((classItem) => (
                      <Card key={classItem.id} p="sm" withBorder>
                        <Stack gap={4}>
                          <Group justify="space-between">
                            <Text fw={500}>{classItem.name}</Text>
                            <Badge size="sm" variant="light">
                              {classItem.course?.name}
                            </Badge>
                          </Group>
                          <Text size="xs" c="dimmed">
                            {t('teacher')}: {classItem.teacher?.firstName} {classItem.teacher?.lastName}
                          </Text>
                        </Stack>
                      </Card>
                    ))}
                    {(!student.classes || student.classes.length === 0) && (
                      <Text c="dimmed" ta="center">{t('noClassesEnrolled')}</Text>
                    )}
                  </Stack>
                </Paper>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>

          <Tabs.Panel value="attendance" mt="md">
            <Paper p="md" withBorder>
              <Title order={4} mb="md">{ta('attendanceHistory')}</Title>
              <AdvancedDataTable
                data={attendanceData?.attendance || []}
                columns={attendanceColumns}
                loading={attendanceLoading}
                searchPlaceholder={ta('searchPlaceholder')}
                onRefresh={() => {}}
              />
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="payments" mt="md">
            <Paper p="md" withBorder>
              <Title order={4} mb="md">{tp('paymentHistory')}</Title>
              <AdvancedDataTable
                data={paymentsData?.payments || []}
                columns={paymentColumns}
                loading={paymentsLoading}
                searchPlaceholder={tp('searchPlaceholder')}
                onRefresh={() => {}}
              />
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="classes" mt="md">
            <Paper p="md" withBorder>
              <Title order={4} mb="md">{t('classDetails')}</Title>
              <Grid>
                {student.classes?.map((classItem) => (
                  <Grid.Col key={classItem.id} span={{ base: 12, md: 6 }}>
                    <Card withBorder p="md">
                      <Stack gap="sm">
                        <Group justify="space-between">
                          <Title order={5}>{classItem.name}</Title>
                          <Badge variant="light">{classItem.status}</Badge>
                        </Group>
                        <Text size="sm" c="dimmed">{classItem.description}</Text>
                        <Divider />
                        <Group>
                          <Text size="sm">
                            <strong>{t('course')}:</strong> {classItem.course?.name}
                          </Text>
                        </Group>
                        <Group>
                          <Text size="sm">
                            <strong>{t('teacher')}:</strong> {classItem.teacher?.firstName} {classItem.teacher?.lastName}
                          </Text>
                        </Group>
                        <Group>
                          <Text size="sm">
                            <strong>{t('schedule')}:</strong> {classItem.schedule || 'N/A'}
                          </Text>
                        </Group>
                        <Group>
                          <Text size="sm">
                            <strong>{t('enrollmentDate')}:</strong> {
                              classItem.enrolledAt 
                                ? new Date(classItem.enrolledAt).toLocaleDateString()
                                : 'N/A'
                            }
                          </Text>
                        </Group>
                      </Stack>
                    </Card>
                  </Grid.Col>
                ))}
              </Grid>
            </Paper>
          </Tabs.Panel>
        </Tabs>
      </Stack>

      {/* Edit Student Modal */}
      <StudentForm
        opened={editModalOpened}
        onClose={closeEditModal}
        student={student}
        onSave={handleSaveStudent}
      />
    </Container>
  );
}
