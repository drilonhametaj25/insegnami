'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Container,
  Title,
  Grid,
  Paper,
  Button,
  Group,
  Stack,
  Tabs,
  Modal,
  Text,
  Badge,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconUsers,
  IconSchool,
  IconCoin,
  IconCalendar,
  IconPlus,
  IconSettings,
  IconDownload,
} from '@tabler/icons-react';

import { AdvancedDataTable, createCellRenderers } from '@/components/tables/AdvancedDataTable';
import { DashboardCharts, KPICards } from '@/components/charts/DashboardCharts';
import { StudentForm } from '@/components/forms/StudentForm';
import { TeacherForm } from '@/components/forms/TeacherForm';
import { ClassForm } from '@/components/forms/ClassForm';
import { PaymentForm } from '@/components/forms/PaymentForm';
import { StatsCard } from '@/components/cards/StatsCard';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  enrollmentDate: string;
  lastActivity?: string;
  dateOfBirth?: Date;
  address?: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  medicalInfo?: string;
  notes?: string;
}

interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  address?: string;
  teacherCode?: string;
  hireDate: Date;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  qualifications?: string;
  specializations?: string;
  biography?: string;
  hourlyRate?: number;
  contractType?: string;
}

interface Class {
  id: string;
  name: string;
  description?: string;
  level: 'BEGINNER' | 'ELEMENTARY' | 'INTERMEDIATE' | 'UPPER_INTERMEDIATE' | 'ADVANCED' | 'PROFICIENCY';
  maxStudents: number;
  currentStudents: number;
  room?: string;
  schedule?: string[];
  startTime?: string;
  endTime?: string;
  duration: number;
  price?: number;
  isActive: boolean;
  teacherIds?: string[];
  teacher: string; // display name
}

interface Payment {
  id: string;
  studentId: string;
  student: string; // display name
  amount: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'CHECK' | 'OTHER';
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED';
  dueDate: Date;
  paidDate?: Date;
  description?: string;
  notes?: string;
  invoiceNumber?: string;
  reference?: string;
  period: string;
}

export default function AdminDashboard() {
  const t = useTranslations('admin');
  const tc = useTranslations('common');
  const [activeTab, setActiveTab] = useState('overview');
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  // Modal states
  const [studentModalOpened, { open: openStudentModal, close: closeStudentModal }] = useDisclosure(false);
  const [teacherModalOpened, { open: openTeacherModal, close: closeTeacherModal }] = useDisclosure(false);
  const [classModalOpened, { open: openClassModal, close: closeClassModal }] = useDisclosure(false);
  const [paymentModalOpened, { open: openPaymentModal, close: closePaymentModal }] = useDisclosure(false);

  const [editingStudent, setEditingStudent] = useState<Student | undefined>();
  const [editingTeacher, setEditingTeacher] = useState<Teacher | undefined>();
  const [editingClass, setEditingClass] = useState<Class | undefined>();
  const [editingPayment, setEditingPayment] = useState<Payment | undefined>();

  // Load data
  useEffect(() => {
    loadData();
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [statsResponse, activitiesResponse] = await Promise.all([
        fetch('/api/dashboard/admin/stats'),
        fetch('/api/dashboard/admin/activities')
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setDashboardStats(statsData);
      }

      if (activitiesResponse.ok) {
        const activitiesData = await activitiesResponse.json();
        setRecentActivities(activitiesData);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      notifications.show({
        title: 'Errore',
        message: 'Errore nel caricamento delle statistiche',
        color: 'red',
      });
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Mock data - replace with actual API calls
      setStudents([
        {
          id: '1',
          firstName: 'Marco',
          lastName: 'Rossi',
          email: 'marco.rossi@email.com',
          phone: '+39 123 456 7890',
          status: 'ACTIVE',
          enrollmentDate: '2024-01-15',
          lastActivity: '2024-02-01',
        },
        {
          id: '2',
          firstName: 'Anna',
          lastName: 'Bianchi',
          email: 'anna.bianchi@email.com',
          status: 'ACTIVE',
          enrollmentDate: '2024-02-01',
          lastActivity: '2024-02-05',
        },
      ]);

      setTeachers([
        {
          id: '1',
          firstName: 'Sarah',
          lastName: 'Johnson',
          email: 'sarah.johnson@school.com',
          status: 'ACTIVE',
          hireDate: new Date('2023-09-01'),
          specializations: 'Inglese, Conversazione',
        },
      ]);

      setClasses([
        {
          id: '1',
          name: 'Inglese A1 - Principianti',
          level: 'BEGINNER',
          maxStudents: 15,
          currentStudents: 12,
          teacher: 'Sarah Johnson',
          schedule: ['monday', 'wednesday', 'friday'],
          duration: 90,
          isActive: true,
        },
      ]);

      setPayments([
        {
          id: '1',
          studentId: '1',
          student: 'Marco Rossi',
          amount: 120,
          paymentMethod: 'CASH',
          status: 'PAID',
          dueDate: new Date('2024-02-01'),
          paidDate: new Date('2024-01-30'),
          period: 'Febbraio 2024',
        },
        {
          id: '2',
          studentId: '2',
          student: 'Anna Bianchi',
          amount: 120,
          paymentMethod: 'BANK_TRANSFER',
          status: 'PENDING',
          dueDate: new Date('2024-02-01'),
          period: 'Febbraio 2024',
        },
      ]);
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: 'Errore nel caricamento dei dati',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  // Table columns
  const studentColumns = [
    {
      accessorKey: 'firstName',
      header: 'Nome',
      cell: ({ row }: any) => `${row.original.firstName} ${row.original.lastName}`,
    },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'phone', header: 'Telefono' },
    createCellRenderers.badge('status', {
      ACTIVE: 'green',
      INACTIVE: 'red',
      SUSPENDED: 'yellow',
    }),
    createCellRenderers.date('enrollmentDate'),
  ];

  const teacherColumns = [
    {
      accessorKey: 'firstName',
      header: 'Nome',
      cell: ({ row }: any) => `${row.original.firstName} ${row.original.lastName}`,
    },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'specializations', header: 'Specializzazioni' },
    createCellRenderers.badge('status', {
      ACTIVE: 'green',
      INACTIVE: 'red',
      SUSPENDED: 'yellow',
    }),
    createCellRenderers.date('hireDate'),
  ];

  const classColumns = [
    { accessorKey: 'name', header: 'Nome Classe' },
    { accessorKey: 'level', header: 'Livello' },
    {
      accessorKey: 'currentStudents',
      header: 'Studenti',
      cell: ({ row }: any) => `${row.original.currentStudents}/${row.original.maxStudents}`,
    },
    { accessorKey: 'teacher', header: 'Docente' },
    { accessorKey: 'schedule', header: 'Orario' },
    createCellRenderers.badge('isActive', {
      true: 'green',
      false: 'red',
    }),
  ];

  const paymentColumns = [
    { accessorKey: 'student', header: 'Studente' },
    { accessorKey: 'period', header: 'Periodo' },
    createCellRenderers.currency('amount'),
    createCellRenderers.badge('status', {
      PAID: 'green',
      PENDING: 'yellow',
      OVERDUE: 'red',
      CANCELLED: 'gray',
    }),
    createCellRenderers.date('dueDate'),
    createCellRenderers.date('paidDate'),
  ];

  // Handlers
  const handleEditStudent = (student: Student) => {
    setEditingStudent(student);
    openStudentModal();
  };

  const handleEditTeacher = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    openTeacherModal();
  };

  const handleEditClass = (classData: Class) => {
    setEditingClass(classData);
    openClassModal();
  };

  const handleEditPayment = (payment: Payment) => {
    setEditingPayment(payment);
    openPaymentModal();
  };

  const handleSaveStudent = async (studentData: any) => {
    // API call to save student
    notifications.show({
      title: t('notifications.success'),
      message: t('notifications.studentSaved'),
      color: 'green',
    });
    await loadData();
  };

  const handleSaveTeacher = async (teacherData: any) => {
    // API call to save teacher
    notifications.show({
      title: t('notifications.success'),
      message: t('notifications.teacherSaved'),
      color: 'green',
    });
    await loadData();
  };

  const handleSaveClass = async (classData: any) => {
    // API call to save class
    notifications.show({
      title: t('notifications.success'),
      message: t('notifications.classSaved'),
      color: 'green',
    });
    await loadData();
  };

  const handleSavePayment = async (paymentData: any) => {
    // API call to save payment
    notifications.show({
      title: t('notifications.success'),
      message: t('notifications.paymentSaved'),
      color: 'green',
    });
    await loadData();
  };

  // Export functions
  const handleExportStudents = async () => {
    try {
      const response = await fetch('/api/students/export?format=csv');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `students-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        notifications.show({
          title: 'Export Completato',
          message: 'File degli studenti scaricato con successo',
          color: 'green',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Errore Export',
        message: 'Errore durante l\'export degli studenti',
        color: 'red',
      });
    }
  };

  const handleExportPayments = async () => {
    try {
      const response = await fetch('/api/payments/export?format=csv');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `payments-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        notifications.show({
          title: 'Export Completato',
          message: 'File dei pagamenti scaricato con successo',
          color: 'green',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Errore Export',
        message: 'Errore durante l\'export dei pagamenti',
        color: 'red',
      });
    }
  };

  const handleExportAttendance = async () => {
    try {
      const response = await fetch('/api/attendance/export?format=csv');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        notifications.show({
          title: 'Export Completato',
          message: 'File delle presenze scaricato con successo',
          color: 'green',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Errore Export',
        message: 'Errore durante l\'export delle presenze',
        color: 'red',
      });
    }
  };

  const handleExportCompleteReport = async () => {
    try {
      const response = await fetch('/api/reports/export?type=overview&format=csv');
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `complete-report-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        notifications.show({
          title: 'Export Completato',
          message: 'Report completo scaricato con successo',
          color: 'green',
        });
      }
    } catch (error) {
      notifications.show({
        title: 'Errore Export',
        message: 'Errore durante l\'export del report',
        color: 'red',
      });
    }
  };

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Title order={1}>{t('title')}</Title>
          <Button leftSection={<IconSettings size={16} />} variant="light">
            {t('settings')}
          </Button>
        </Group>

        <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'overview')}>
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconSchool size={16} />}>
              {t('tabs.overview')}
            </Tabs.Tab>
            <Tabs.Tab value="students" leftSection={<IconUsers size={16} />}>
              {t('tabs.students')}
            </Tabs.Tab>
            <Tabs.Tab value="teachers" leftSection={<IconUsers size={16} />}>
              {t('tabs.teachers')}
            </Tabs.Tab>
            <Tabs.Tab value="classes" leftSection={<IconCalendar size={16} />}>
              {t('tabs.classes')}
            </Tabs.Tab>
            <Tabs.Tab value="payments" leftSection={<IconCoin size={16} />}>
              {t('tabs.payments')}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" pt="lg">
            <Stack gap="lg">
              <Group justify="space-between">
                <Title order={2}>Dashboard Panoramica</Title>
                <Button
                  variant="outline"
                  leftSection={<IconDownload size={16} />}
                  onClick={handleExportCompleteReport}
                >
                  Esporta Report Completo
                </Button>
              </Group>
              <KPICards stats={dashboardStats} />
              <DashboardCharts />
              
              {/* Recent Activities Section */}
              {recentActivities.length > 0 && (
                <Paper p="lg" withBorder>
                  <Group justify="space-between" mb="md">
                    <Title order={3}>Attività Recenti</Title>
                    <Badge variant="light">Live</Badge>
                  </Group>
                  <Stack gap="xs">
                    {recentActivities.slice(0, 5).map((activity) => (
                      <Paper key={activity.id} p="sm" withBorder radius="sm">
                        <Group justify="space-between">
                          <Group>
                            <Text size="lg">{activity.icon}</Text>
                            <div>
                              <Text size="sm" fw={500}>{activity.description}</Text>
                              <Text size="xs" c="dimmed">
                                {new Date(activity.timestamp).toLocaleString('it-IT')}
                              </Text>
                            </div>
                          </Group>
                          <Badge size="sm" variant="light">
                            {activity.type}
                          </Badge>
                        </Group>
                      </Paper>
                    ))}
                  </Stack>
                </Paper>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="students" pt="lg">
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={2}>Gestione Studenti</Title>
                <Group gap="sm">
                  <Button
                    variant="outline"
                    leftSection={<IconDownload size={16} />}
                    onClick={handleExportStudents}
                  >
                    Esporta CSV
                  </Button>
                  <Button
                    leftSection={<IconPlus size={16} />}
                    onClick={() => {
                      setEditingStudent(undefined);
                      openStudentModal();
                    }}
                  >
                    Nuovo Studente
                  </Button>
                </Group>
              </Group>
              <AdvancedDataTable
                data={students}
                columns={studentColumns}
                loading={loading}
                onEdit={handleEditStudent}
                onRefresh={loadData}
                searchPlaceholder="Cerca studenti..."
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="teachers" pt="lg">
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={2}>Gestione Docenti</Title>
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={() => {
                    setEditingTeacher(undefined);
                    openTeacherModal();
                  }}
                >
                  Nuovo Docente
                </Button>
              </Group>
              <AdvancedDataTable
                data={teachers}
                columns={teacherColumns}
                loading={loading}
                onEdit={handleEditTeacher}
                onRefresh={loadData}
                searchPlaceholder="Cerca docenti..."
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="classes" pt="lg">
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={2}>Gestione Classi</Title>
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={() => {
                    setEditingClass(undefined);
                    openClassModal();
                  }}
                >
                  Nuova Classe
                </Button>
              </Group>
              <AdvancedDataTable
                data={classes}
                columns={classColumns}
                loading={loading}
                onEdit={handleEditClass}
                onRefresh={loadData}
                searchPlaceholder="Cerca classi..."
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="payments" pt="lg">
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={2}>Gestione Pagamenti</Title>
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={() => {
                    setEditingPayment(undefined);
                    openPaymentModal();
                  }}
                >
                  Nuovo Pagamento
                </Button>
              </Group>
              <AdvancedDataTable
                data={payments}
                columns={paymentColumns}
                loading={loading}
                onEdit={handleEditPayment}
                onRefresh={loadData}
                searchPlaceholder="Cerca pagamenti..."
              />
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Stack>

      {/* Modals */}
      <StudentForm
        opened={studentModalOpened}
        onClose={() => {
          closeStudentModal();
          setEditingStudent(undefined);
        }}
        student={editingStudent}
        onSave={handleSaveStudent}
      />

      <TeacherForm
        opened={teacherModalOpened}
        onClose={() => {
          closeTeacherModal();
          setEditingTeacher(undefined);
        }}
        teacher={editingTeacher}
        onSave={handleSaveTeacher}
      />

      <ClassForm
        opened={classModalOpened}
        onClose={() => {
          closeClassModal();
          setEditingClass(undefined);
        }}
        classData={editingClass}
        onSave={handleSaveClass}
        teachers={teachers.map(t => ({ id: t.id, name: `${t.firstName} ${t.lastName}` }))}
      />

      <PaymentForm
        opened={paymentModalOpened}
        onClose={() => {
          closePaymentModal();
          setEditingPayment(undefined);
        }}
        payment={editingPayment}
        onSave={handleSavePayment}
        students={students.map(s => ({ id: s.id, name: `${s.firstName} ${s.lastName}` }))}
      />
    </Container>
  );
}
