'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Badge,
  Button,
  Grid,
  Avatar,
  Tabs,
  Alert,
  LoadingOverlay,
  Card,
  Divider,
  ActionIcon,
  Tooltip,
  Timeline,
  Progress,
  UnstyledButton,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconEdit,
  IconUser,
  IconBook,
  IconCalendar,
  IconCreditCard,
  IconMail,
  IconPhone,
  IconMapPin,
  IconAlertCircle,
  IconUsers,
  IconChevronRight,
  IconCheck,
  IconX,
  IconClock,
  IconSchool,
  IconChartLine,
  IconChartBar,
  IconCoin,
  IconTrash,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import { StudentForm } from '@/components/forms/StudentForm';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';
import { DataTable, TableRenderers } from '@/components/tables/DataTable';
import { AttendanceChart, PaymentStatusChart } from '@/components/charts/DashboardCharts';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  address?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  enrollmentDate: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  emergencyContact?: string;
  medicalNotes?: string;
  specialNeeds?: string;
  classes?: Array<{
    id: string;
    name: string;
    course: {
      name: string;
    };
  }>;
  payments?: Array<{
    id: string;
    amount: number;
    status: string;
    dueDate: string;
    paidAt?: string;
  }>;
  attendance?: Array<{
    id: string;
    date: string;
    status: string;
    lesson: {
      id: string;
      title: string;
      course: {
        name: string;
      };
    };
  }>;
}

interface StudentStats {
  totalClasses: number;
  activeClasses: number;
  attendanceRate: number;
  totalPayments: number;
  paidPayments: number;
  pendingPayments: number;
  overduePayments: number;
}

export default function StudentDetailPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const locale = useLocale();
  const t = useTranslations('students');
  
  const [student, setStudent] = useState<Student | null>(null);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  
  const [opened, { open, close }] = useDisclosure(false);

  const studentId = params.id as string;

  // Check permissions
  const canManageStudents = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN' || session?.user?.role === 'TEACHER';
  const canViewStudent = canManageStudents || session?.user?.id === studentId;

  // Fetch student data
  const fetchStudent = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/students/${studentId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Studente non trovato');
        }
        throw new Error('Errore nel caricamento del profilo');
      }

      const data = await response.json();
      setStudent(data.student);
      setStats(data.stats);
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canViewStudent && studentId) {
      fetchStudent();
    }
  }, [studentId, canViewStudent]);

  // Navigate to class detail
  const handleViewClass = (classId: string) => {
    router.push(`/${locale}/dashboard/classes/${classId}`);
  };

  // Navigate to lesson detail
  const handleViewLesson = (lessonId: string) => {
    router.push(`/${locale}/dashboard/attendance/lesson/${lessonId}`);
  };

  // Handle edit student
  const handleEdit = () => {
    open();
  };

  // Handle student update
  const handleUpdate = async (data: any) => {
    try {
      setSubmitting(true);
      const response = await fetch(`/api/students/${studentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore durante l\'aggiornamento');
      }

      notifications.show({
        title: 'Successo',
        message: 'Studente aggiornato con successo',
        color: 'green',
      });

      close();
      fetchStudent(); // Refresh data
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: error instanceof Error ? error.message : 'Errore durante l\'aggiornamento',
        color: 'red',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'green';
      case 'INACTIVE': return 'gray';
      case 'SUSPENDED': return 'red';
      default: return 'gray';
    }
  };

  if (!canViewStudent) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconAlertCircle />} color="red">
          Non hai i permessi per visualizzare questo profilo studente
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container size="xl" py="md">
        <LoadingOverlay visible={true} />
      </Container>
    );
  }

  if (!student) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconAlertCircle />} color="red">
          Studente non trovato
        </Alert>
      </Container>
    );
  }

  // Table columns for classes
  const classColumns = [
    {
      key: 'name',
      title: 'Classe',
      render: (_value: any, cls: any) => (
        <Group gap="sm">
          <UnstyledButton onClick={() => handleViewClass(cls.id)}>
            <Text fw={500} c="blue" style={{ cursor: 'pointer' }}>
              {cls.name}
            </Text>
          </UnstyledButton>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconChevronRight size={12} />}
            onClick={() => handleViewClass(cls.id)}
          >
            Vai
          </Button>
        </Group>
      ),
    },
    {
      key: 'course',
      title: 'Corso',
      render: (course: any) => course?.name || '-',
    },
  ];

  // Table columns for payments
  const paymentColumns = [
    {
      key: 'amount',
      title: 'Importo',
      render: (amount: any) => TableRenderers.currency(amount),
    },
    {
      key: 'status',
      title: 'Stato',
      render: (status: string) => TableRenderers.status(status),
    },
    {
      key: 'dueDate',
      title: 'Scadenza',
      render: (date: string) => TableRenderers.date(date),
    },
    {
      key: 'paidAt',
      title: 'Pagato il',
      render: (date: string | null) => date ? TableRenderers.date(date) : '-',
    },
  ];

  // Table columns for attendance
  const attendanceColumns = [
    {
      key: 'date',
      title: 'Data',
      render: (date: string) => TableRenderers.date(date),
    },
    {
      key: 'lesson',
      title: 'Lezione',
      render: (_value: any, attendance: any) => (
        <Group gap="sm">
          <UnstyledButton onClick={() => handleViewLesson(attendance.lesson.id)}>
            <Text fw={500} c="blue" style={{ cursor: 'pointer' }}>
              {attendance.lesson.title}
            </Text>
          </UnstyledButton>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconChevronRight size={12} />}
            onClick={() => handleViewLesson(attendance.lesson.id)}
          >
            Vai
          </Button>
        </Group>
      ),
    },
    {
      key: 'status',
      title: 'Presenza',
      render: (status: string) => TableRenderers.status(status),
    },
  ];

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => router.push(`/${locale}/dashboard/students`)}
            >
              Torna agli Studenti
            </Button>
            <Title order={2}>Profilo Studente</Title>
          </Group>
          {canManageStudents && (
            <Button
              leftSection={<IconEdit size={16} />}
              onClick={handleEdit}
            >
              Modifica
            </Button>
          )}
        </Group>

        {/* Student Profile Card */}
        <Paper
          shadow="sm"
          radius="lg"
          p="xl"
          withBorder
        >
          <Group align="flex-start">
            <Avatar size="xl" color="blue" radius="lg">
              {student.firstName[0]}{student.lastName[0]}
            </Avatar>
            <div style={{ flex: 1 }}>
              <Group justify="space-between" align="flex-start">
                <div>
                  <Title order={3} mb="sm">
                    {student.firstName} {student.lastName}
                  </Title>
                  <Text c="dimmed" size="sm" mb="xs">{student.email}</Text>
                  <Badge 
                    color={getStatusColor(student.status)} 
                    size="lg"
                    variant="light"
                  >
                    {student.status}
                  </Badge>
                </div>
              </Group>
            </div>
          </Group>
        </Paper>

        {/* Stats Cards */}
        {stats && (
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <ModernStatsCard
                title="Classi Totali"
                value={stats.totalClasses}
                icon="📚"
                gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <ModernStatsCard
                title="Tasso Presenza"
                value={`${stats.attendanceRate}%`}
                icon="📊"
                gradient="linear-gradient(135deg, #48bb78 0%, #38a169 100%)"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <ModernStatsCard
                title="Pagamenti Pagati"
                value={stats.paidPayments}
                icon="💰"
                gradient="linear-gradient(135deg, #4fd1c7 0%, #3182ce 100%)"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <ModernStatsCard
                title="Pagamenti Scaduti"
                value={stats.overduePayments}
                icon="⚠️"
                gradient="linear-gradient(135deg, #f56565 0%, #e53e3e 100%)"
              />
            </Grid.Col>
          </Grid>
        )}

        {/* Tabs */}
        <Paper
          radius="lg"
          shadow="sm"
          withBorder
        >
          <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'profile')} variant="pills" p="md">
            <Tabs.List grow>
              <Tabs.Tab value="profile" leftSection={<IconUser size={16} />}>
                Profilo
              </Tabs.Tab>
              <Tabs.Tab value="statistics" leftSection={<IconChartLine size={16} />}>
                Statistiche
              </Tabs.Tab>
              <Tabs.Tab value="classes" leftSection={<IconBook size={16} />}>
                Classi ({student.classes?.length || 0})
              </Tabs.Tab>
              <Tabs.Tab value="attendance" leftSection={<IconCalendar size={16} />}>
                Presenze ({student.attendance?.length || 0})
              </Tabs.Tab>
              <Tabs.Tab value="payments" leftSection={<IconCreditCard size={16} />}>
                Pagamenti ({student.payments?.length || 0})
              </Tabs.Tab>
            </Tabs.List>

            {/* Profile Tab */}
            <Tabs.Panel value="profile" pt="lg">
              <Grid>
                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Card shadow="sm" radius="lg" p="lg">
                    <Title order={4} mb="md">Informazioni Personali</Title>
                    <Stack gap="sm">
                      <Group>
                        <IconUser size={16} />
                        <Text size="sm" fw={500}>Nome Completo:</Text>
                        <Text size="sm">{student.firstName} {student.lastName}</Text>
                      </Group>
                      <Group>
                        <IconMail size={16} />
                        <Text size="sm" fw={500}>Email:</Text>
                        <Text size="sm">{student.email}</Text>
                      </Group>
                      {student.phone && (
                        <Group>
                          <IconPhone size={16} />
                          <Text size="sm" fw={500}>Telefono:</Text>
                          <Text size="sm">{student.phone}</Text>
                        </Group>
                      )}
                      {student.address && (
                        <Group>
                          <IconMapPin size={16} />
                          <Text size="sm" fw={500}>Indirizzo:</Text>
                          <Text size="sm">{student.address}</Text>
                        </Group>
                      )}
                      {student.dateOfBirth && (
                        <Group>
                          <IconCalendar size={16} />
                          <Text size="sm" fw={500}>Data di Nascita:</Text>
                          <Text size="sm">{new Date(student.dateOfBirth).toLocaleDateString()}</Text>
                        </Group>
                      )}
                    </Stack>
                  </Card>
                </Grid.Col>

                <Grid.Col span={{ base: 12, md: 6 }}>
                  <Card shadow="sm" radius="lg" p="lg">
                    <Title order={4} mb="md">Contatti Genitore</Title>
                    <Stack gap="sm">
                      {student.parentName && (
                        <Group>
                          <IconUsers size={16} />
                          <Text size="sm" fw={500}>Nome Genitore:</Text>
                          <Text size="sm">{student.parentName}</Text>
                        </Group>
                      )}
                      {student.parentEmail && (
                        <Group>
                          <IconMail size={16} />
                          <Text size="sm" fw={500}>Email Genitore:</Text>
                          <Text size="sm">{student.parentEmail}</Text>
                        </Group>
                      )}
                      {student.parentPhone && (
                        <Group>
                          <IconPhone size={16} />
                          <Text size="sm" fw={500}>Telefono Genitore:</Text>
                          <Text size="sm">{student.parentPhone}</Text>
                        </Group>
                      )}
                      {student.emergencyContact && (
                        <Group>
                          <IconAlertCircle size={16} />
                          <Text size="sm" fw={500}>Contatto Emergenza:</Text>
                          <Text size="sm">{student.emergencyContact}</Text>
                        </Group>
                      )}
                    </Stack>
                  </Card>
                </Grid.Col>

                {(student.medicalNotes || student.specialNeeds) && (
                  <Grid.Col span={12}>
                    <Card shadow="sm" radius="lg" p="lg">
                      <Title order={4} mb="md">Note Speciali</Title>
                      <Stack gap="md">
                        {student.medicalNotes && (
                          <div>
                            <Text size="sm" fw={500} mb="xs">Note Mediche:</Text>
                            <Text size="sm" c="dimmed">{student.medicalNotes}</Text>
                          </div>
                        )}
                        {student.specialNeeds && (
                          <div>
                            <Text size="sm" fw={500} mb="xs">Bisogni Speciali:</Text>
                            <Text size="sm" c="dimmed">{student.specialNeeds}</Text>
                          </div>
                        )}
                      </Stack>
                    </Card>
                  </Grid.Col>
                )}
              </Grid>
            </Tabs.Panel>

            {/* Statistics Tab */}
            <Tabs.Panel value="statistics" pt="lg">
              <Stack gap="lg">
                <Grid>
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <AttendanceChart 
                      data={{
                        labels: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven'],
                        attendanceRates: student.attendance ? 
                          (() => {
                            // Raggruppa presenze per giorno della settimana
                            const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven'];
                            const dailyAttendance = weekDays.map((_, dayIndex) => {
                              const dayAttendance = student.attendance!.filter(a => {
                                const date = new Date(a.date);
                                return date.getDay() === dayIndex + 1; // 1 = Lunedì
                              });
                              const presentCount = dayAttendance.filter(a => a.status === 'PRESENT').length;
                              return dayAttendance.length > 0 ? Math.round((presentCount / dayAttendance.length) * 100) : 0;
                            });
                            return dailyAttendance;
                          })()
                        : [0, 0, 0, 0, 0]
                      }}
                      title="Presenze per Giorno della Settimana"
                    />
                  </Grid.Col>
                  
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <PaymentStatusChart 
                      data={{
                        paid: student.payments ? student.payments.filter(p => p.status === 'PAID').length : 0,
                        pending: student.payments ? student.payments.filter(p => p.status === 'PENDING').length : 0,
                        overdue: student.payments ? student.payments.filter(p => p.status === 'OVERDUE').length : 0,
                      }}
                      title="Status Pagamenti"
                    />
                  </Grid.Col>
                </Grid>

                {/* Additional Statistics Cards */}
                <Grid>
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <Card shadow="sm" radius="lg" p="lg" withBorder>
                      <Stack gap="sm" align="center">
                        <IconCalendar size={32} color="var(--mantine-color-blue-6)" />
                        <Title order={4}>Frequenza Media</Title>
                        <Text size="xl" fw={700} c="blue">
                          {stats?.attendanceRate || 0}%
                        </Text>
                        <Text size="sm" c="dimmed" ta="center">
                          Basata su {student.attendance?.length || 0} lezioni
                        </Text>
                      </Stack>
                    </Card>
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <Card shadow="sm" radius="lg" p="lg" withBorder>
                      <Stack gap="sm" align="center">
                        <IconCoin size={32} color="var(--mantine-color-green-6)" />
                        <Title order={4}>Pagamenti Totali</Title>
                        <Text size="xl" fw={700} c="green">
                          €{student.payments ? 
                            student.payments.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2) 
                            : '0.00'
                          }
                        </Text>
                        <Text size="sm" c="dimmed" ta="center">
                          {stats?.paidPayments || 0} pagamenti completati
                        </Text>
                      </Stack>
                    </Card>
                  </Grid.Col>

                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <Card shadow="sm" radius="lg" p="lg" withBorder>
                      <Stack gap="sm" align="center">
                        <IconBook size={32} color="var(--mantine-color-violet-6)" />
                        <Title order={4}>Classi Attive</Title>
                        <Text size="xl" fw={700} c="violet">
                          {stats?.activeClasses || 0}
                        </Text>
                        <Text size="sm" c="dimmed" ta="center">
                          Su {stats?.totalClasses || 0} classi totali
                        </Text>
                      </Stack>
                    </Card>
                  </Grid.Col>
                </Grid>

                {/* Recent Activity Timeline */}
                <Card shadow="sm" radius="lg" p="lg" withBorder>
                  <Title order={4} mb="md">Attività Recenti</Title>
                  <Timeline active={-1} bulletSize={24} lineWidth={2}>
                    {student.attendance?.slice(-5).reverse().map((attendance, index) => (
                      <Timeline.Item
                        key={attendance.id}
                        bullet={attendance.status === 'PRESENT' ? <IconCheck size={12} /> : <IconX size={12} />}
                        title={`Lezione: ${attendance.lesson.title}`}
                        color={attendance.status === 'PRESENT' ? 'green' : 'red'}
                      >
                        <Text c="dimmed" size="sm">
                          {new Date(attendance.date).toLocaleDateString('it-IT')} - {attendance.status}
                        </Text>
                        <Text size="xs" mt={4}>
                          Corso: {attendance.lesson.course?.name}
                        </Text>
                      </Timeline.Item>
                    ))}
                    {(!student.attendance || student.attendance.length === 0) && (
                      <Timeline.Item
                        bullet={<IconClock size={12} />}
                        title="Nessuna attività recente"
                        color="gray"
                      >
                        <Text c="dimmed" size="sm">
                          Non ci sono ancora registrazioni di presenza
                        </Text>
                      </Timeline.Item>
                    )}
                  </Timeline>
                </Card>
              </Stack>
            </Tabs.Panel>

            {/* Classes Tab */}
            <Tabs.Panel value="classes" pt="lg">
              <DataTable
                data={student.classes || []}
                columns={classColumns as any}
                loading={false}
                searchable={false}
                filterable={false}
              />
            </Tabs.Panel>

            {/* Attendance Tab */}
            <Tabs.Panel value="attendance" pt="lg">
              <DataTable
                data={student.attendance || []}
                columns={attendanceColumns as any}
                loading={false}
                searchable={false}
                filterable={false}
              />
            </Tabs.Panel>

            {/* Payments Tab */}
            <Tabs.Panel value="payments" pt="lg">
              <DataTable
                data={student.payments || []}
                columns={paymentColumns as any}
                loading={false}
                searchable={false}
                filterable={false}
              />
            </Tabs.Panel>
          </Tabs>
        </Paper>
      </Stack>

      {/* Edit Student Modal */}
      <StudentForm
        opened={opened}
        onClose={close}
        student={student ? {
          ...student,
          dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth) : undefined,
        } : undefined}
        onSave={handleUpdate}
        loading={submitting}
      />
    </Container>
  );
}
