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
  ActionIcon,
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
    tenant?: {
      id: string;
      name: string;
    };
  }>;
  // Profili collegati risolti dall'API
  profiles?: {
    studentId: string | null;
    teacherId: string | null;
    children: Array<{
      id: string;
      firstName: string;
      lastName: string;
      studentCode: string;
      status: string;
    }>;
  };
}

// Dati reali per la scheda studente: /api/students/[id], /api/grades/student/[id], /api/payments?studentId=
interface StudentData {
  student: {
    id: string;
    classes?: Array<{
      id: string;
      name: string;
      course?: { name: string; level?: string | null } | null;
      teacher?: { id: string; name: string } | null;
      isActive: boolean;
    }>;
  } | null;
  grades: {
    subjectGrades: Array<{
      subjectId: string;
      subjectName: string;
      grades: Array<{ id: string; value: string | number; date: string }>;
      averages: { overall: number; gradeCount: number };
    }>;
    overallAverage: number;
    totalGrades: number;
  } | null;
  payments: Array<{
    id: string;
    amount: string | number;
    description: string;
    status: string;
    dueDate: string;
    paidDate?: string | null;
  }>;
}

// Dati reali docente: /api/teachers/[id]
interface TeacherData {
  id: string;
  hireDate?: string;
  specializations?: string | null;
  qualifications?: string | null;
  classes?: Array<{
    id: string;
    name: string;
    level?: string;
    schedule?: string;
    status?: string;
    _count?: { students: number };
  }>;
  lessons?: Array<{
    id: string;
    date: string;
    topic: string;
    status: string;
    class?: { id: string; name: string } | null;
  }>;
}

// Dati reali genitore: figli da /api/users/[id] (profiles.children) + pagamenti per figlio
interface ParentData {
  children: Array<{
    id: string;
    firstName: string;
    lastName: string;
    studentCode: string;
    status: string;
  }>;
  payments: Array<{
    id: string;
    amount: string | number;
    description: string;
    status: string;
    dueDate: string;
    paidDate?: string | null;
    student?: { id: string; firstName: string; lastName: string } | null;
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
      const userData: UserDetails = data.user || data;
      setUser(userData);

      // Load role-specific data based on user role, via profili collegati
      const userRole = userData.tenants?.[0]?.role || userData.role;
      const profiles = userData.profiles;
      switch (userRole) {
        case 'STUDENT':
          if (profiles?.studentId) {
            await loadStudentData(profiles.studentId);
          }
          break;
        case 'TEACHER':
          if (profiles?.teacherId) {
            await loadTeacherData(profiles.teacherId);
          }
          break;
        case 'PARENT':
          await loadParentData(profiles?.children || []);
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

  const loadStudentData = async (studentId: string) => {
    const [studentRes, gradesRes, paymentsRes] = await Promise.all([
      fetch(`/api/students/${studentId}`),
      fetch(`/api/grades/student/${studentId}`),
      fetch(`/api/payments?studentId=${studentId}&limit=50`),
    ]);

    setStudentData({
      student: studentRes.ok ? (await studentRes.json()).student : null,
      grades: gradesRes.ok ? await gradesRes.json() : null,
      payments: paymentsRes.ok ? (await paymentsRes.json()).payments || [] : [],
    });
  };

  const loadTeacherData = async (teacherId: string) => {
    const res = await fetch(`/api/teachers/${teacherId}`);
    if (res.ok) {
      setTeacherData(await res.json());
    }
  };

  const loadParentData = async (
    children: NonNullable<UserDetails['profiles']>['children']
  ) => {
    const paymentsResults = await Promise.all(
      children.map((child) =>
        fetch(`/api/payments?studentId=${child.id}&limit=20`).then((r) =>
          r.ok ? r.json() : { payments: [] }
        )
      )
    );

    setParentData({
      children,
      payments: paymentsResults.flatMap((r) => r.payments || []),
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
      <Tabs.Tab value="lessons" leftSection={<IconCalendar size={16} />}>
        Lezioni Recenti
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
          <Button leftSection={<IconEdit size={16} />} variant="light" onClick={openEditModal} data-testid="users-modifica">
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
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)',
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
            {userRole === 'STUDENT' && studentData && renderStudentTabs()}
            {userRole === 'TEACHER' && teacherData && renderTeacherTabs()}
            {userRole === 'PARENT' && parentData && renderParentTabs()}
          </Tabs.List>

          <Tabs.Panel value="overview" pt="lg">
            <Card withBorder radius="md" p="lg">
              <Title order={3} mb="md">Panoramica Generale</Title>
              <Text c="dimmed">
                Informazioni di base per {user.firstName} {user.lastName} ({userRole.toLowerCase()})
              </Text>
              {userRole === 'STUDENT' && user.profiles?.studentId && (
                <Button
                  mt="md"
                  variant="light"
                  onClick={() => router.push(`/${locale}/dashboard/students/${user.profiles!.studentId}`)}
                  data-testid="users-profilo-studente"
                >
                  Apri Profilo Studente
                </Button>
              )}
              {userRole === 'TEACHER' && user.profiles?.teacherId && (
                <Button
                  mt="md"
                  variant="light"
                  onClick={() => router.push(`/${locale}/dashboard/teachers/${user.profiles!.teacherId}`)}
                  data-testid="users-profilo-docente"
                >
                  Apri Profilo Docente
                </Button>
              )}
            </Card>
          </Tabs.Panel>

          {/* Student-specific panels (dati reali) */}
          {userRole === 'STUDENT' && studentData && (
            <>
              <Tabs.Panel value="classes" pt="lg">
                <Stack gap="md">
                  {(studentData.student?.classes || []).map((cls) => (
                    <Card key={cls.id} withBorder radius="md" p="lg">
                      <Group justify="space-between">
                        <div>
                          <UnstyledButton
                            onClick={() => router.push(`/${locale}/dashboard/classes/${cls.id}`)}
                          >
                            <Text fw={600} c="blue" size="lg" style={{ cursor: 'pointer' }}>
                              {cls.name}
                            </Text>
                          </UnstyledButton>
                          <Text size="sm" c="dimmed">
                            Corso: {cls.course?.name || '-'}
                            {cls.teacher ? ` • Docente: ${cls.teacher.name}` : ''}
                          </Text>
                        </div>
                        <Group>
                          {cls.course?.level && <Badge variant="light">{cls.course.level}</Badge>}
                          <Badge color={cls.isActive ? 'green' : 'gray'} variant="light">
                            {cls.isActive ? 'Attiva' : 'Chiusa'}
                          </Badge>
                          <Button
                            size="sm"
                            variant="light"
                            onClick={() => router.push(`/${locale}/dashboard/classes/${cls.id}`)}
                          >
                            Vedi Classe
                          </Button>
                        </Group>
                      </Group>
                    </Card>
                  ))}
                  {(studentData.student?.classes || []).length === 0 && (
                    <Text c="dimmed" ta="center" py="xl">
                      Nessuna classe associata
                    </Text>
                  )}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="payments" pt="lg">
                <Stack gap="md">
                  {studentData.payments.map((payment) => (
                    <Card key={payment.id} withBorder radius="md" p="lg">
                      <Group justify="space-between">
                        <div>
                          <Text fw={600}>{payment.description}</Text>
                          <Text size="sm" c="dimmed">
                            Scadenza: {new Date(payment.dueDate).toLocaleDateString('it-IT')}
                            {payment.paidDate
                              ? ` • Pagato il: ${new Date(payment.paidDate).toLocaleDateString('it-IT')}`
                              : ''}
                          </Text>
                        </div>
                        <Group>
                          <Text fw={600}>€{Number(payment.amount).toFixed(2)}</Text>
                          <Badge color={payment.status === 'PAID' ? 'green' : payment.status === 'PENDING' ? 'yellow' : 'red'}>
                            {payment.status}
                          </Badge>
                        </Group>
                      </Group>
                    </Card>
                  ))}
                  {studentData.payments.length === 0 && (
                    <Text c="dimmed" ta="center" py="xl">
                      Nessun pagamento registrato
                    </Text>
                  )}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="grades" pt="lg">
                <Stack gap="md">
                  {studentData.grades && studentData.grades.subjectGrades.length > 0 && (
                    <Card withBorder radius="md" p="lg">
                      <Group justify="space-between">
                        <Text fw={600}>Media Generale</Text>
                        <Badge
                          size="lg"
                          color={
                            studentData.grades.overallAverage >= 8
                              ? 'green'
                              : studentData.grades.overallAverage >= 6
                              ? 'yellow'
                              : 'red'
                          }
                        >
                          {studentData.grades.overallAverage}/10
                        </Badge>
                      </Group>
                    </Card>
                  )}
                  {(studentData.grades?.subjectGrades || []).map((subject) => (
                    <Card key={subject.subjectId} withBorder radius="md" p="lg">
                      <Group justify="space-between">
                        <div>
                          <Text fw={600}>{subject.subjectName}</Text>
                          <Text size="sm" c="dimmed">
                            {subject.averages.gradeCount} voti registrati
                          </Text>
                        </div>
                        <Badge
                          size="lg"
                          color={
                            subject.averages.overall >= 8
                              ? 'green'
                              : subject.averages.overall >= 6
                              ? 'yellow'
                              : 'red'
                          }
                        >
                          {subject.averages.overall}/10
                        </Badge>
                      </Group>
                    </Card>
                  ))}
                  {(!studentData.grades || studentData.grades.subjectGrades.length === 0) && (
                    <Text c="dimmed" ta="center" py="xl">
                      Nessuna valutazione registrata
                    </Text>
                  )}
                </Stack>
              </Tabs.Panel>
            </>
          )}

          {/* Teacher-specific panels (dati reali) */}
          {userRole === 'TEACHER' && teacherData && (
            <>
              <Tabs.Panel value="classes" pt="lg">
                <Stack gap="md">
                  {(teacherData.classes || []).map((classItem) => (
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
                          {classItem.level && (
                            <Text size="sm" c="dimmed">
                              Corso: {classItem.level}
                            </Text>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          {classItem.status && <Badge variant="light">{classItem.status}</Badge>}
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
                          <strong>{classItem._count?.students ?? 0}</strong> studenti
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
                  {(teacherData.classes || []).length === 0 && (
                    <Text c="dimmed" ta="center" py="xl">
                      Nessuna classe assegnata
                    </Text>
                  )}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="lessons" pt="lg">
                <Stack gap="md">
                  {(teacherData.lessons || []).slice(0, 15).map((lesson) => (
                    <Card key={lesson.id} withBorder radius="md" p="lg">
                      <Group justify="space-between">
                        <div>
                          <Text fw={600}>{lesson.topic}</Text>
                          <Text size="sm" c="dimmed">
                            {new Date(lesson.date).toLocaleString('it-IT')}
                            {lesson.class ? ` • ${lesson.class.name}` : ''}
                          </Text>
                        </div>
                        <Badge
                          variant="light"
                          color={
                            lesson.status === 'COMPLETED'
                              ? 'green'
                              : lesson.status === 'CANCELLED'
                              ? 'red'
                              : 'blue'
                          }
                        >
                          {lesson.status}
                        </Badge>
                      </Group>
                    </Card>
                  ))}
                  {(teacherData.lessons || []).length === 0 && (
                    <Text c="dimmed" ta="center" py="xl">
                      Nessuna lezione registrata
                    </Text>
                  )}
                </Stack>
              </Tabs.Panel>
            </>
          )}

          {/* Parent-specific panels (dati reali) */}
          {userRole === 'PARENT' && parentData && (
            <>
              <Tabs.Panel value="children" pt="lg">
                <Stack gap="md">
                  {parentData.children.map((child) => (
                    <Card key={child.id} withBorder radius="md" p="lg">
                      <Group justify="space-between">
                        <Group>
                          <Avatar size="md" color="blue">
                            {child.firstName[0]}{child.lastName[0]}
                          </Avatar>
                          <div>
                            <UnstyledButton
                              onClick={() => router.push(`/${locale}/dashboard/students/${child.id}`)}
                            >
                              <Text fw={600} c="blue" style={{ cursor: 'pointer' }}>
                                {child.firstName} {child.lastName}
                              </Text>
                            </UnstyledButton>
                            <Text size="sm" c="dimmed">Codice: {child.studentCode}</Text>
                          </div>
                        </Group>
                        <Group>
                          <Badge color={child.status === 'ACTIVE' ? 'green' : 'gray'} variant="light">
                            {child.status}
                          </Badge>
                          <Button
                            size="xs"
                            variant="light"
                            onClick={() => router.push(`/${locale}/dashboard/students/${child.id}`)}
                            data-testid="users-figlio-profilo"
                          >
                            Profilo Studente
                          </Button>
                        </Group>
                      </Group>
                    </Card>
                  ))}
                  {parentData.children.length === 0 && (
                    <Text c="dimmed" ta="center" py="xl">
                      Nessun figlio collegato a questo account
                    </Text>
                  )}
                </Stack>
              </Tabs.Panel>

              <Tabs.Panel value="payments" pt="lg">
                <Stack gap="md">
                  {parentData.payments.map((payment) => (
                    <Card key={payment.id} withBorder radius="md" p="lg">
                      <Group justify="space-between">
                        <div>
                          <Text fw={600}>
                            {payment.student
                              ? `${payment.student.firstName} ${payment.student.lastName}`
                              : '-'}
                          </Text>
                          <Text size="sm" c="dimmed">{payment.description}</Text>
                          <Text size="sm" c="dimmed">
                            Scadenza: {new Date(payment.dueDate).toLocaleDateString('it-IT')}
                          </Text>
                        </div>
                        <Group>
                          <Text fw={600}>€{Number(payment.amount).toFixed(2)}</Text>
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
                  {parentData.payments.length === 0 && (
                    <Text c="dimmed" ta="center" py="xl">
                      Nessun pagamento registrato
                    </Text>
                  )}
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
