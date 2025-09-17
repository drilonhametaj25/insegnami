'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  Tabs,
  Card,
  Progress,
  ActionIcon,
  Divider,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconArrowLeft,
  IconEdit,
  IconUser,
  IconBook,
  IconCalendar,
  IconCash,
  IconClipboardList,
  IconPhone,
  IconMail,
  IconUsers,
  IconChartBar,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { Role } from '@prisma/client';
import { UserForm, UserFormData } from '@/components/forms/UserForm';

interface UserDetails {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role?: Role; // Keep for compatibility
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  avatar?: string;
  createdAt: string;
  lastLogin?: string;
  // Multi-tenant structure
  tenants?: Array<{
    tenantId: string;
    role: Role;
    tenant: {
      id: string;
      name: string;
    };
  }>;
}

interface StudentData {
  enrollmentDate: string;
  classes: Array<{
    id: string;
    name: string;
    teacher: string;
    level: string;
    progress: number;
  }>;
  attendance: {
    total: number;
    present: number;
    absent: number;
    percentage: number;
  };
  payments: Array<{
    id: string;
    amount: number;
    status: 'PAID' | 'PENDING' | 'OVERDUE';
    dueDate: string;
    period: string;
  }>;
  grades: Array<{
    subject: string;
    grade: number;
    date: string;
  }>;
}

interface TeacherData {
  hireDate: string;
  specializations: string[];
  qualifications: string[];
  classes: Array<{
    id: string;
    name: string;
    students: number;
    level: string;
    schedule: string;
  }>;
  performance: {
    totalStudents: number;
    averageAttendance: number;
    completionRate: number;
  };
  schedule: Array<{
    day: string;
    time: string;
    class: string;
    room: string;
  }>;
}

interface ParentData {
  children: Array<{
    id: string;
    firstName: string;
    lastName: string;
    class: string;
    teacher: string;
    attendance: number;
    lastPayment: string;
  }>;
  payments: Array<{
    id: string;
    childName: string;
    amount: number;
    status: 'PAID' | 'PENDING' | 'OVERDUE';
    dueDate: string;
    period: string;
  }>;
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('users');
  const [user, setUser] = useState<UserDetails | null>(null);
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [teacherData, setTeacherData] = useState<TeacherData | null>(null);
  const [parentData, setParentData] = useState<ParentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [submitting, setSubmitting] = useState(false);

  const userId = params.id as string;

  useEffect(() => {
    loadUserDetails();
  }, [userId]);

  const loadUserDetails = async () => {
    try {
      setLoading(true);
      
      // Load basic user data
      const userResponse = await fetch(`/api/users/${userId}`);
      if (!userResponse.ok) throw new Error('Failed to load user');
      const data = await userResponse.json();
      
      // Extract user from response (API returns { user: ... })
      const userData = data.user || data;
      setUser(userData);

      // Load role-specific data based on user role
      const userRole = userData.tenants?.[0]?.role || userData.role;
      switch (userRole) {
        case 'STUDENT':
          await loadStudentData();
          break;
        case 'TEACHER':
          await loadTeacherData();
          break;
        case 'PARENT':
          await loadParentData();
          break;
      }
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: 'Impossibile caricare i dettagli utente',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStudentData = async () => {
    // Mock data - replace with actual API calls
    setStudentData({
      enrollmentDate: '2024-01-15',
      classes: [
        { id: '1', name: 'Inglese A1', teacher: 'Sarah Johnson', level: 'Principiante', progress: 75 },
        { id: '2', name: 'Conversazione', teacher: 'John Smith', level: 'Intermedio', progress: 60 },
      ],
      attendance: {
        total: 40,
        present: 35,
        absent: 5,
        percentage: 87.5,
      },
      payments: [
        { id: '1', amount: 120, status: 'PAID', dueDate: '2024-01-01', period: 'Gennaio 2024' },
        { id: '2', amount: 120, status: 'PENDING', dueDate: '2024-02-01', period: 'Febbraio 2024' },
      ],
      grades: [
        { subject: 'Inglese A1', grade: 8.5, date: '2024-01-20' },
        { subject: 'Conversazione', grade: 7.8, date: '2024-01-25' },
      ],
    });
  };

  const loadTeacherData = async () => {
    // Mock data - replace with actual API calls
    setTeacherData({
      hireDate: '2023-09-01',
      specializations: ['Inglese', 'Conversazione', 'Business English'],
      qualifications: ['CELTA', 'Laurea in Lingue'],
      classes: [
        { id: '1', name: 'Inglese A1', students: 15, level: 'Principiante', schedule: 'Lun/Mer/Ven 10:00' },
        { id: '2', name: 'Business English', students: 8, level: 'Avanzato', schedule: 'Mar/Gio 18:00' },
      ],
      performance: {
        totalStudents: 23,
        averageAttendance: 89.2,
        completionRate: 94.5,
      },
      schedule: [
        { day: 'Lunedì', time: '10:00-11:30', class: 'Inglese A1', room: 'Aula 1' },
        { day: 'Mercoledì', time: '10:00-11:30', class: 'Inglese A1', room: 'Aula 1' },
        { day: 'Venerdì', time: '10:00-11:30', class: 'Inglese A1', room: 'Aula 1' },
      ],
    });
  };

  const loadParentData = async () => {
    // Mock data - replace with actual API calls
    setParentData({
      children: [
        {
          id: '1',
          firstName: 'Marco',
          lastName: 'Rossi',
          class: 'Inglese A1',
          teacher: 'Sarah Johnson',
          attendance: 92,
          lastPayment: '2024-01-30',
        },
        {
          id: '2',
          firstName: 'Elena',
          lastName: 'Rossi',
          class: 'Inglese A2',
          teacher: 'John Smith',
          attendance: 88,
          lastPayment: '2024-01-30',
        },
      ],
      payments: [
        { id: '1', childName: 'Marco Rossi', amount: 120, status: 'PAID', dueDate: '2024-01-01', period: 'Gennaio 2024' },
        { id: '2', childName: 'Elena Rossi', amount: 120, status: 'PAID', dueDate: '2024-01-01', period: 'Gennaio 2024' },
        { id: '3', childName: 'Marco Rossi', amount: 120, status: 'PENDING', dueDate: '2024-02-01', period: 'Febbraio 2024' },
      ],
    });
  };

  if (loading || !user) {
    return <div>Caricamento...</div>;
  }

  // Get user role from tenants or fallback to direct role
  const userRole = user.tenants?.[0]?.role || user.role;
  if (!userRole) {
    return <div>Errore: ruolo utente non trovato</div>;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'green';
      case 'INACTIVE': return 'gray';
      case 'SUSPENDED': return 'red';
      default: return 'gray';
    }
  };

  const getRoleColor = (role: Role) => {
    switch (role) {
      case 'SUPERADMIN': return 'violet';
      case 'ADMIN': return 'red';
      case 'TEACHER': return 'blue';
      case 'STUDENT': return 'green';
      case 'PARENT': return 'orange';
      default: return 'gray';
    }
  };

  // Handle user update
  const handleUpdateUser = async (data: UserFormData) => {
    try {
      setSubmitting(true);
      
      const response = await fetch(`/api/users/${userId}`, {
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

      const result = await response.json();
      
      // Update local user data
      const updatedUser = result.user || result;
      setUser(updatedUser);

      notifications.show({
        title: 'Successo',
        message: 'Utente aggiornato con successo',
        color: 'green',
      });

      closeEditModal();
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

  const renderStudentTabs = () => (
    <>
      <Tabs.Tab value="classes" leftSection={<IconBook size={16} />}>
        Corsi
      </Tabs.Tab>
      <Tabs.Tab value="attendance" leftSection={<IconClipboardList size={16} />}>
        Presenze
      </Tabs.Tab>
      <Tabs.Tab value="payments" leftSection={<IconCash size={16} />}>
        Pagamenti
      </Tabs.Tab>
      <Tabs.Tab value="grades" leftSection={<IconChartBar size={16} />}>
        Valutazioni
      </Tabs.Tab>
    </>
  );

  const renderTeacherTabs = () => (
    <>
      <Tabs.Tab value="classes" leftSection={<IconBook size={16} />}>
        Classi
      </Tabs.Tab>
      <Tabs.Tab value="schedule" leftSection={<IconCalendar size={16} />}>
        Orario
      </Tabs.Tab>
      <Tabs.Tab value="performance" leftSection={<IconChartBar size={16} />}>
        Performance
      </Tabs.Tab>
    </>
  );

  const renderParentTabs = () => (
    <>
      <Tabs.Tab value="children" leftSection={<IconUsers size={16} />}>
        Figli
      </Tabs.Tab>
      <Tabs.Tab value="payments" leftSection={<IconCash size={16} />}>
        Pagamenti
      </Tabs.Tab>
    </>
  );

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <ActionIcon
              variant="light"
              size="lg"
              onClick={() => router.push(`/${locale}/dashboard/admin/users`)}
            >
              <IconArrowLeft size={18} />
            </ActionIcon>
            <div>
              <Title order={1}>
                {user.firstName} {user.lastName}
              </Title>
              <Group gap="xs" mt="xs">
                <Badge color={getRoleColor(userRole)} variant="light">
                  {userRole}
                </Badge>
                <Badge color={getStatusColor(user.status)} variant="light">
                  {user.status}
                </Badge>
              </Group>
            </div>
          </Group>
          <Button leftSection={<IconEdit size={16} />} variant="light" onClick={openEditModal}>
            Modifica
          </Button>
        </Group>

        {/* User Info Card */}
        <Card withBorder radius="md" p="lg">
          <Grid>
            <Grid.Col span={{ base: 12, md: 3 }}>
              <Stack align="center">
                <Avatar 
                  size={120} 
                  src={user.avatar}
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  }}
                >
                  {user.firstName[0]}{user.lastName[0]}
                </Avatar>
                <Stack align="center" gap={4}>
                  <Text fw={600} size="lg">
                    {user.firstName} {user.lastName}
                  </Text>
                  <Badge color={getRoleColor(userRole)} size="lg">
                    {userRole}
                  </Badge>
                </Stack>
              </Stack>
            </Grid.Col>
            
            <Grid.Col span={{ base: 12, md: 9 }}>
              <Grid>
                <Grid.Col span={6}>
                  <Group gap="xs" mb="md">
                    <IconMail size={16} />
                    <div>
                      <Text size="sm" c="dimmed">Email</Text>
                      <Text fw={500}>{user.email}</Text>
                    </div>
                  </Group>
                  
                  <Group gap="xs" mb="md">
                    <IconPhone size={16} />
                    <div>
                      <Text size="sm" c="dimmed">Telefono</Text>
                      <Text fw={500}>{user.phone || 'Non fornito'}</Text>
                    </div>
                  </Group>
                </Grid.Col>
                
                <Grid.Col span={6}>
                  <Group gap="xs" mb="md">
                    <IconCalendar size={16} />
                    <div>
                      <Text size="sm" c="dimmed">Registrato il</Text>
                      <Text fw={500}>
                        {new Date(user.createdAt).toLocaleDateString('it-IT')}
                      </Text>
                    </div>
                  </Group>
                  
                  {user.lastLogin && (
                    <Group gap="xs" mb="md">
                      <IconUser size={16} />
                      <div>
                        <Text size="sm" c="dimmed">Ultimo accesso</Text>
                        <Text fw={500}>
                          {new Date(user.lastLogin).toLocaleDateString('it-IT')}
                        </Text>
                      </div>
                    </Group>
                  )}
                </Grid.Col>
              </Grid>
            </Grid.Col>
          </Grid>
        </Card>

        {/* Role-specific content */}
        <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'overview')}>
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconUser size={16} />}>
              Panoramica
            </Tabs.Tab>
            {userRole === 'STUDENT' && renderStudentTabs()}
            {userRole === 'TEACHER' && renderTeacherTabs()}
            {userRole === 'PARENT' && renderParentTabs()}
          </Tabs.List>

          <Tabs.Panel value="overview" pt="lg">
            <Card withBorder radius="md" p="lg">
              <Title order={3} mb="md">Panoramica Generale</Title>
              <Text c="dimmed">
                Informazioni di base per {user.firstName} {user.lastName} ({userRole.toLowerCase()})
              </Text>
            </Card>
          </Tabs.Panel>

          {/* Student-specific panels */}
          {userRole === 'STUDENT' && studentData && (
            <>
              <Tabs.Panel value="classes" pt="lg">
                <Stack gap="md">
                  {studentData.classes.map((course) => (
                    <Card key={course.id} withBorder radius="md" p="lg">
                      <Group justify="space-between" mb="md">
                        <div>
                          <Text fw={600}>{course.name}</Text>
                          <Text size="sm" c="dimmed">Docente: {course.teacher}</Text>
                        </div>
                        <Badge variant="light">{course.level}</Badge>
                      </Group>
                      <div>
                        <Group justify="space-between" mb="xs">
                          <Text size="sm">Progresso</Text>
                          <Text size="sm">{course.progress}%</Text>
                        </Group>
                        <Progress value={course.progress} color="blue" />
                      </div>
                    </Card>
                  ))}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="attendance" pt="lg">
                <Card withBorder radius="md" p="lg">
                  <Title order={3} mb="md">Statistiche Presenze</Title>
                  <Grid>
                    <Grid.Col span={3}>
                      <Stack align="center">
                        <Text size="2xl" fw={700} c="blue">{studentData.attendance.present}</Text>
                        <Text size="sm" c="dimmed">Presenti</Text>
                      </Stack>
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <Stack align="center">
                        <Text size="2xl" fw={700} c="red">{studentData.attendance.absent}</Text>
                        <Text size="sm" c="dimmed">Assenti</Text>
                      </Stack>
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <Stack align="center">
                        <Text size="2xl" fw={700}>{studentData.attendance.total}</Text>
                        <Text size="sm" c="dimmed">Totale</Text>
                      </Stack>
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <Stack align="center">
                        <Text size="2xl" fw={700} c="green">{studentData.attendance.percentage}%</Text>
                        <Text size="sm" c="dimmed">Percentuale</Text>
                      </Stack>
                    </Grid.Col>
                  </Grid>
                </Card>
              </Tabs.Panel>

              <Tabs.Panel value="payments" pt="lg">
                <Stack gap="md">
                  {studentData.payments.map((payment) => (
                    <Card key={payment.id} withBorder radius="md" p="lg">
                      <Group justify="space-between">
                        <div>
                          <Text fw={600}>{payment.period}</Text>
                          <Text size="sm" c="dimmed">Scadenza: {new Date(payment.dueDate).toLocaleDateString('it-IT')}</Text>
                        </div>
                        <Group>
                          <Text fw={600}>€{payment.amount}</Text>
                          <Badge color={payment.status === 'PAID' ? 'green' : payment.status === 'PENDING' ? 'yellow' : 'red'}>
                            {payment.status}
                          </Badge>
                        </Group>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </Tabs.Panel>
            </>
          )}

          {/* Teacher-specific panels */}
          {userRole === 'TEACHER' && teacherData && (
            <>
              <Tabs.Panel value="classes" pt="lg">
                <Stack gap="md">
                  {teacherData.classes.map((classItem) => (
                    <Card key={classItem.id} withBorder radius="md" p="lg">
                      <Group justify="space-between" mb="md">
                        <div>
                          <UnstyledButton 
                            onClick={() => router.push(`/${locale}/dashboard/classes/${classItem.id}`)}
                          >
                            <Text fw={600} c="blue" size="lg" style={{ cursor: 'pointer' }}>
                              {classItem.name}
                            </Text>
                          </UnstyledButton>
                          <Text size="sm" c="dimmed">
                            Orario: {classItem.schedule}
                          </Text>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <Badge variant="light">{classItem.level}</Badge>
                          <Button
                            size="sm"
                            variant="light"
                            onClick={() => router.push(`/${locale}/dashboard/classes/${classItem.id}`)}
                          >
                            Vedi Classe
                          </Button>
                        </div>
                      </Group>
                      <Group>
                        <Text size="sm">
                          <strong>{classItem.students}</strong> studenti
                        </Text>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => router.push(`/${locale}/dashboard/students?class=${classItem.id}`)}
                        >
                          Lista Studenti
                        </Button>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="schedule" pt="lg">
                <Stack gap="md">
                  {teacherData.schedule.map((scheduleItem, index) => (
                    <Card key={index} withBorder radius="md" p="lg">
                      <Group justify="space-between">
                        <div>
                          <Text fw={600}>{scheduleItem.day}</Text>
                          <Text size="sm" c="dimmed">{scheduleItem.time}</Text>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <UnstyledButton 
                            onClick={() => {
                              const classItem = teacherData.classes.find(c => c.name === scheduleItem.class);
                              if (classItem) {
                                router.push(`/${locale}/dashboard/classes/${classItem.id}`);
                              }
                            }}
                          >
                            <Text fw={500} c="blue" style={{ cursor: 'pointer' }}>
                              {scheduleItem.class}
                            </Text>
                          </UnstyledButton>
                          <Text size="sm" c="dimmed">{scheduleItem.room}</Text>
                          <Group gap="xs" mt="xs">
                            <Button
                              size="xs"
                              variant="light"
                              onClick={() => router.push(`/${locale}/dashboard/attendance?class=${scheduleItem.class}&date=${new Date().toISOString().split('T')[0]}`)}
                            >
                              Presenze Oggi
                            </Button>
                          </Group>
                        </div>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="performance" pt="lg">
                <Grid>
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <Card withBorder radius="md" p="lg" h="100%">
                      <Stack align="center">
                        <Text size="2xl" fw={700} c="blue">
                          {teacherData.performance.totalStudents}
                        </Text>
                        <Text size="sm" c="dimmed" ta="center">
                          Studenti Totali
                        </Text>
                        <Button
                          size="xs"
                          variant="light"
                          mt="xs"
                          onClick={() => router.push(`/${locale}/dashboard/students?teacher=${user.id}`)}
                        >
                          Vedi Lista
                        </Button>
                      </Stack>
                    </Card>
                  </Grid.Col>
                  
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <Card withBorder radius="md" p="lg" h="100%">
                      <Stack align="center">
                        <Text size="2xl" fw={700} c="green">
                          {teacherData.performance.averageAttendance}%
                        </Text>
                        <Text size="sm" c="dimmed" ta="center">
                          Presenze Medie
                        </Text>
                        <Button
                          size="xs"
                          variant="light"
                          mt="xs"
                          onClick={() => router.push(`/${locale}/dashboard/attendance?teacher=${user.id}`)}
                        >
                          Report Completo
                        </Button>
                      </Stack>
                    </Card>
                  </Grid.Col>
                  
                  <Grid.Col span={{ base: 12, md: 4 }}>
                    <Card withBorder radius="md" p="lg" h="100%">
                      <Stack align="center">
                        <Text size="2xl" fw={700} c="orange">
                          {teacherData.performance.completionRate}%
                        </Text>
                        <Text size="sm" c="dimmed" ta="center">
                          Tasso Completamento
                        </Text>
                      </Stack>
                    </Card>
                  </Grid.Col>
                </Grid>
              </Tabs.Panel>
            </>
          )}

          {/* Student-specific panels */}
          {userRole === 'STUDENT' && studentData && (
            <>
              <Tabs.Panel value="classes" pt="lg">
                <Stack gap="md">
                  {studentData.classes.map((course) => (
                    <Card key={course.id} withBorder radius="md" p="lg">
                      <Group justify="space-between" mb="md">
                        <div>
                          <UnstyledButton
                            onClick={() => router.push(`/${locale}/dashboard/classes/${course.id}`)}
                          >
                            <Text fw={600} c="blue" size="lg" style={{ cursor: 'pointer' }}>
                              {course.name}
                            </Text>
                          </UnstyledButton>
                          <Text size="sm" c="dimmed">Docente: {course.teacher}</Text>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <Badge variant="light">{course.level}</Badge>
                          <Button
                            size="sm"
                            variant="light"
                            onClick={() => router.push(`/${locale}/dashboard/classes/${course.id}`)}
                          >
                            Vedi Classe
                          </Button>
                        </div>
                      </Group>
                      <div>
                        <Group justify="space-between" mb="xs">
                          <Text size="sm">Progresso</Text>
                          <Text size="sm">{course.progress}%</Text>
                        </Group>
                        <Progress value={course.progress} color="blue" />
                      </div>
                    </Card>
                  ))}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="attendance" pt="lg">
                <Card withBorder radius="md" p="lg" mb="lg">
                  <Title order={3} mb="md">Statistiche Presenze</Title>
                  <Grid>
                    <Grid.Col span={3}>
                      <Stack align="center">
                        <Text size="2xl" fw={700} c="blue">{studentData.attendance.present}</Text>
                        <Text size="sm" c="dimmed">Presenti</Text>
                      </Stack>
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <Stack align="center">
                        <Text size="2xl" fw={700} c="red">{studentData.attendance.absent}</Text>
                        <Text size="sm" c="dimmed">Assenti</Text>
                      </Stack>
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <Stack align="center">
                        <Text size="2xl" fw={700}>{studentData.attendance.total}</Text>
                        <Text size="sm" c="dimmed">Totale</Text>
                      </Stack>
                    </Grid.Col>
                    <Grid.Col span={3}>
                      <Stack align="center">
                        <Text size="2xl" fw={700} c="green">{studentData.attendance.percentage}%</Text>
                        <Text size="sm" c="dimmed">Percentuale</Text>
                        <Button
                          size="xs"
                          variant="light"
                          mt="xs"
                          onClick={() => router.push(`/${locale}/dashboard/attendance?student=${user.id}`)}
                        >
                          Report Dettagli
                        </Button>
                      </Stack>
                    </Grid.Col>
                  </Grid>
                </Card>
                
                {/* Recent attendance with clickable links */}
                <Card withBorder radius="md" p="lg">
                  <Title order={4} mb="md">Presenze Recenti</Title>
                  <Stack gap="xs">
                    <Paper p="sm" withBorder radius="sm">
                      <Group justify="space-between">
                        <div>
                          <Text size="sm" fw={500}>Inglese A1 - Lezione del 15/01/2024</Text>
                          <Text size="xs" c="dimmed">Presente</Text>
                        </div>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => router.push(`/${locale}/dashboard/attendance/lesson/1?date=2024-01-15`)}
                        >
                          Vedi Chi C'era
                        </Button>
                      </Group>
                    </Paper>
                    <Paper p="sm" withBorder radius="sm">
                      <Group justify="space-between">
                        <div>
                          <Text size="sm" fw={500}>Conversazione - Lezione del 14/01/2024</Text>
                          <Text size="xs" c="dimmed">Presente</Text>
                        </div>
                        <Button
                          size="xs"
                          variant="light"
                          onClick={() => router.push(`/${locale}/dashboard/attendance/lesson/2?date=2024-01-14`)}
                        >
                          Vedi Chi C'era
                        </Button>
                      </Group>
                    </Paper>
                  </Stack>
                </Card>
              </Tabs.Panel>

              <Tabs.Panel value="payments" pt="lg">
                <Stack gap="md">
                  {studentData.payments.map((payment) => (
                    <Card key={payment.id} withBorder radius="md" p="lg">
                      <Group justify="space-between">
                        <div>
                          <Text fw={600}>{payment.period}</Text>
                          <Text size="sm" c="dimmed">Scadenza: {new Date(payment.dueDate).toLocaleDateString('it-IT')}</Text>
                        </div>
                        <Group>
                          <Text fw={600}>€{payment.amount}</Text>
                          <Badge color={payment.status === 'PAID' ? 'green' : payment.status === 'PENDING' ? 'yellow' : 'red'}>
                            {payment.status}
                          </Badge>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => router.push(`/${locale}/dashboard/payments/${payment.id}`)}
                          >
                            Dettagli
                          </Button>
                        </Group>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="grades" pt="lg">
                <Stack gap="md">
                  {studentData.grades.map((grade, index) => (
                    <Card key={index} withBorder radius="md" p="lg">
                      <Group justify="space-between">
                        <div>
                          <UnstyledButton
                            onClick={() => {
                              const courseId = studentData.classes.find(c => c.name === grade.subject)?.id;
                              if (courseId) {
                                router.push(`/${locale}/dashboard/classes/${courseId}`);
                              }
                            }}
                          >
                            <Text fw={600} c="blue" style={{ cursor: 'pointer' }}>
                              {grade.subject}
                            </Text>
                          </UnstyledButton>
                          <Text size="sm" c="dimmed">
                            {new Date(grade.date).toLocaleDateString('it-IT')}
                          </Text>
                        </div>
                        <Badge 
                          size="lg"
                          color={grade.grade >= 8 ? 'green' : grade.grade >= 6 ? 'yellow' : 'red'}
                        >
                          {grade.grade}/10
                        </Badge>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </Tabs.Panel>
            </>
          )}

          {/* Parent-specific panels */}
          {userRole === 'PARENT' && parentData && (
            <>
              <Tabs.Panel value="children" pt="lg">
                <Stack gap="md">
                  {parentData.children.map((child) => (
                    <Card key={child.id} withBorder radius="md" p="lg">
                      <Grid>
                        <Grid.Col span={{ base: 12, md: 8 }}>
                          <Group mb="sm">
                            <Avatar size="md" color="blue">
                              {child.firstName[0]}{child.lastName[0]}
                            </Avatar>
                            <div>
                              <UnstyledButton
                                onClick={() => router.push(`/${locale}/dashboard/users/${child.id}`)}
                              >
                                <Text fw={600} c="blue" style={{ cursor: 'pointer' }}>
                                  {child.firstName} {child.lastName}
                                </Text>
                              </UnstyledButton>
                              <UnstyledButton
                                onClick={() => router.push(`/${locale}/dashboard/classes/${child.class}`)}
                              >
                                <Text size="sm" c="blue" style={{ cursor: 'pointer' }}>
                                  Classe: {child.class}
                                </Text>
                              </UnstyledButton>
                              <Text size="sm" c="dimmed">Docente: {child.teacher}</Text>
                            </div>
                          </Group>
                        </Grid.Col>
                        
                        <Grid.Col span={{ base: 12, md: 4 }}>
                          <Stack gap="xs">
                            <Group justify="space-between">
                              <Text size="sm">Presenze</Text>
                              <Badge color={child.attendance >= 90 ? 'green' : child.attendance >= 75 ? 'yellow' : 'red'}>
                                {child.attendance}%
                              </Badge>
                            </Group>
                            <Text size="xs" c="dimmed">
                              Ultimo pagamento: {new Date(child.lastPayment).toLocaleDateString('it-IT')}
                            </Text>
                            <Group gap="xs" mt="xs">
                              <Button
                                size="xs"
                                variant="light"
                                onClick={() => router.push(`/${locale}/dashboard/attendance?student=${child.id}`)}
                              >
                                Presenze
                              </Button>
                              <Button
                                size="xs"
                                variant="outline"
                                onClick={() => router.push(`/${locale}/dashboard/payments?student=${child.id}`)}
                              >
                                Pagamenti
                              </Button>
                            </Group>
                          </Stack>
                        </Grid.Col>
                      </Grid>
                    </Card>
                  ))}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="payments" pt="lg">
                <Stack gap="md">
                  {parentData.payments.map((payment) => (
                    <Card key={payment.id} withBorder radius="md" p="lg">
                      <Group justify="space-between">
                        <div>
                          <Text fw={600}>{payment.childName}</Text>
                          <Text size="sm" c="dimmed">{payment.period}</Text>
                          <Text size="sm" c="dimmed">
                            Scadenza: {new Date(payment.dueDate).toLocaleDateString('it-IT')}
                          </Text>
                        </div>
                        <Group>
                          <Text fw={600}>€{payment.amount}</Text>
                          <Badge color={
                            payment.status === 'PAID' ? 'green' : 
                            payment.status === 'PENDING' ? 'yellow' : 'red'
                          }>
                            {payment.status}
                          </Badge>
                        </Group>
                      </Group>
                    </Card>
                  ))}
                </Stack>
              </Tabs.Panel>
            </>
          )}
        </Tabs>
      </Stack>

      {/* Edit User Modal */}
      <UserForm
        opened={editModalOpened}
        onClose={closeEditModal}
        initialData={{
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone || '',
          role: userRole,
        }}
        onSubmit={handleUpdateUser}
        loading={submitting}
        isEdit={true}
      />
    </Container>
  );
}
