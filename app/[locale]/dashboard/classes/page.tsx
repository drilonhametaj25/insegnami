'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
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
  TextInput,
  Select,
  Badge,
  Divider,
  Box,
  Flex,
  Table,
  ScrollArea,
  UnstyledButton,
  Avatar,
  Progress,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { 
  IconPlus, 
  IconSearch, 
  IconFilter, 
  IconX, 
  IconInfoCircle, 
  IconSchool, 
  IconUsers, 
  IconCalendar, 
  IconChartBar, 
  IconTrendingUp,
  IconRefresh,
  IconEye,
  IconEdit,
  IconBook2,
  IconCheck,
} from '@tabler/icons-react';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';
import { ModernModal } from '@/components/modals/ModernModal';
import { ClassForm } from '@/components/forms/ClassForm';

interface Class {
  id: string;
  code: string;
  name: string;
  maxStudents: number;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  course: {
    id: string;
    name: string;
    level: string;
    category?: string;
  };
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  _count: {
    students: number;
    lessons: number;
  };
  students?: Array<{
    student: {
      id: string;
      firstName: string;
      lastName: string;
    };
  }>;
  lessons?: Array<{
    id: string;
    title: string;
    startTime: string;
    status: string;
  }>;
}

interface ClassesResponse {
  classes: Class[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ClassesStats {
  total: number;
  active: number;
  inactive: number;
  totalStudents: number;
  averageStudentsPerClass: number;
  classesNearCapacity: number;
}

const StatusBadge = ({ status }: { status: boolean }) => (
  <Badge
    color={status ? 'green' : 'red'}
    variant="light"
    size="sm"
  >
    {status ? 'Attiva' : 'Inattiva'}
  </Badge>
);

export default function ClassesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('classes');
  
  const [classes, setClasses] = useState<Class[]>([]);
  const [stats, setStats] = useState<ClassesStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  
  const [opened, { open, close }] = useDisclosure(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);

  // Check permissions
  const canManageClasses = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN';
  const canViewClasses = canManageClasses || session?.user?.role === 'TEACHER';

  // Fetch classes data
  const fetchClasses = async (
    page = 1, 
    search = searchTerm, 
    status = statusFilter,
    course = courseFilter
  ) => {
    if (!canViewClasses) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        include: 'students,lessons',
      });
      
      if (search) params.append('search', search);
      if (status) params.append('isActive', status);
      if (course) params.append('courseId', course);

      const response = await fetch(`/api/classes?${params}`);
      if (!response.ok) throw new Error('Failed to fetch classes');
      
      const data: ClassesResponse = await response.json();
      setClasses(data.classes);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching classes:', error);
      notifications.show({
        id: `fetch-error-${Date.now()}`,
        title: 'Errore',
        message: 'Impossibile caricare le classi',
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    if (!canViewClasses) return;
    
    try {
      const response = await fetch('/api/classes/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      
      const data: ClassesStats = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching class stats:', error);
    }
  };

  useEffect(() => {
    if (canViewClasses) {
      fetchClasses();
      fetchStats();
    }
  }, [canViewClasses]);

  // Handlers
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    fetchClasses(1, value, statusFilter, courseFilter);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    fetchClasses(1, searchTerm, value, courseFilter);
  };

  const handleCourseFilter = (value: string) => {
    setCourseFilter(value);
    fetchClasses(1, searchTerm, statusFilter, value);
  };

  const handlePageChange = (page: number) => {
    fetchClasses(page, searchTerm, statusFilter, courseFilter);
  };

  const handleCreate = () => {
    setEditingClass(null);
    open();
  };

  const handleEdit = (classItem: Class) => {
    setEditingClass(classItem);
    open();
  };

  const handleView = (classItem: Class) => {
    router.push(`/${locale}/dashboard/classes/${classItem.id}`);
  };

  const handleFormSubmit = async (formData: any) => {
    try {
      setSubmitting(true);
      
      const url = editingClass 
        ? `/api/classes/${editingClass.id}` 
        : '/api/classes';
      const method = editingClass ? 'PUT' : 'POST';
      
      // Show loading notification
      notifications.show({
        id: 'saving-class',
        title: editingClass ? '⏳ Aggiornamento in corso...' : '⏳ Creazione in corso...',
        message: editingClass ? 'Salvataggio modifiche classe' : 'Creazione nuova classe',
        loading: true,
        autoClose: false,
        withCloseButton: false,
      });
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      // Hide loading notification
      notifications.hide('saving-class');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save class');
      }

      const responseData = await response.json();

      notifications.show({
        id: `class-success-${Date.now()}`,
        title: '✅ Successo',
        message: responseData.message || `Classe ${editingClass ? 'aggiornata' : 'creata'} con successo`,
        color: 'green',
        icon: <IconCheck size={18} />,
        autoClose: 4000,
      });

      close();
      fetchClasses();
      fetchStats();
    } catch (error: any) {
      notifications.hide('saving-class');
      
      console.error('Error saving class:', error);
      notifications.show({
        id: `class-error-${Date.now()}`,
        title: '❌ Errore',
        message: error.message || 'Impossibile salvare la classe',
        color: 'red',
        icon: <IconX size={18} />,
        autoClose: 6000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Stats cards
  const statsCards = stats ? [
    {
      title: 'Classi Totali',
      value: stats.total.toString(),
      icon: <IconBook2 size={24} />,
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      change: {
        value: 12,
        type: 'increase' as const,
        period: 'rispetto al mese scorso',
      },
    },
    {
      title: 'Classi Attive',
      value: stats.active.toString(),
      icon: <IconUsers size={24} />,
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      change: {
        value: 8,
        type: 'increase' as const,
        period: 'rispetto al mese scorso',
      },
    },
    {
      title: 'Studenti Totali',
      value: stats.totalStudents.toString(),
      icon: <IconUsers size={24} />,
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      change: {
        value: 15,
        type: 'increase' as const,
        period: 'rispetto al mese scorso',
      },
    },
    {
      title: 'Classi Quasi Piene',
      value: stats.classesNearCapacity.toString(),
      icon: <IconTrendingUp size={24} />,
      gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      badge: {
        text: '≥90%',
        color: 'orange',
      },
    },
    {
      title: 'Media Studenti/Classe',
      value: stats.averageStudentsPerClass.toFixed(1),
      icon: <IconCalendar size={24} />,
      gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      progress: {
        value: Math.round((stats.averageStudentsPerClass / 20) * 100), // Assuming max 20 students per class
        label: 'Capacità media',
        color: 'blue',
      },
    },
  ] : [];

  if (!canViewClasses) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconInfoCircle />} color="red">
          Non hai i permessi per accedere a questa pagina
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={loading && classes.length === 0} />
      
      {/* Header */}
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2} mb="xs">
            Gestione Classi
          </Title>
          <Text c="dimmed">
            Organizza e monitora tutte le classi della scuola
          </Text>
        </div>
        {canManageClasses && (
          <Button
            onClick={handleCreate}
            leftSection={<IconPlus size={18} />}
            variant="gradient"
            gradient={{ from: 'indigo', to: 'purple', deg: 45 }}
            radius="lg"
          >
            Nuova Classe
          </Button>
        )}
      </Group>

      {/* Stats Cards */}
      {stats && (
        <Grid mb="xl">
          {statsCards.map((card, index) => (
            <Grid.Col key={index} span={{ base: 12, sm: 6, lg: 2.4 }}>
              <ModernStatsCard {...card} />
            </Grid.Col>
          ))}
        </Grid>
      )}

      {/* Filters */}
      <Group mb="md" gap="md">
        <TextInput
          placeholder="Cerca classi..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          leftSection={<IconSearch size={16} />}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="Tutti gli stati"
          value={statusFilter}
          onChange={(value) => handleStatusFilter(value || '')}
          data={[
            { value: '', label: 'Tutti gli stati' },
            { value: 'true', label: 'Attive' },
            { value: 'false', label: 'Inattive' },
          ]}
          style={{ minWidth: 150 }}
        />
        <Button
          onClick={() => {
            setSearchTerm('');
            setStatusFilter('');
            setCourseFilter('');
            fetchClasses(1, '', '', '');
          }}
          variant="light"
          leftSection={<IconRefresh size={16} />}
        >
          Reset
        </Button>
      </Group>

      {/* Data Table */}
      <Paper shadow="sm" radius="lg" p="md" mb="md">
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Classe</Table.Th>
                <Table.Th>Corso</Table.Th>
                <Table.Th>Docente</Table.Th>
                <Table.Th>Studenti</Table.Th>
                <Table.Th>Prossima Lezione</Table.Th>
                <Table.Th>Stato</Table.Th>
                <Table.Th>Azioni</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {classes.map((classItem) => (
                <Table.Tr key={classItem.id}>
                  <Table.Td>
                    <UnstyledButton onClick={() => handleView(classItem)}>
                      <Group gap="sm">
                        <Avatar size="sm" color="blue" radius="md">
                          {classItem.code.substring(0, 2)}
                        </Avatar>
                        <div>
                          <Text fw={500} size="sm" c="blue" style={{ cursor: 'pointer' }}>
                            {classItem.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {classItem.code}
                          </Text>
                        </div>
                      </Group>
                    </UnstyledButton>
                  </Table.Td>
                  <Table.Td>
                    <div>
                      <Text fw={500} size="sm">
                        {classItem.course.name}
                      </Text>
                      <Badge size="xs" variant="light" color="teal">
                        {classItem.course.level}
                      </Badge>
                    </div>
                  </Table.Td>
                  <Table.Td>
                    <UnstyledButton 
                      onClick={() => router.push(`/${locale}/dashboard/teachers/${classItem.teacher.id}`)}
                    >
                      <Group gap="sm">
                        <Avatar size="sm" color="indigo">
                          {classItem.teacher.firstName[0]}{classItem.teacher.lastName[0]}
                        </Avatar>
                        <div>
                          <Text fw={500} size="sm" c="indigo" style={{ cursor: 'pointer' }}>
                            {classItem.teacher.firstName} {classItem.teacher.lastName}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {classItem.teacher.email}
                          </Text>
                        </div>
                      </Group>
                    </UnstyledButton>
                  </Table.Td>
                  <Table.Td>
                    <div style={{ minWidth: '120px' }}>
                      <Group justify="space-between" mb={4}>
                        <Text size="sm" fw={500}>
                          {classItem._count?.students || 0}/{classItem.maxStudents}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {Math.round(((classItem._count?.students || 0) / classItem.maxStudents) * 100)}%
                        </Text>
                      </Group>
                      <Progress 
                        value={Math.round(((classItem._count?.students || 0) / classItem.maxStudents) * 100)} 
                        size="xs" 
                        color={
                          Math.round(((classItem._count?.students || 0) / classItem.maxStudents) * 100) >= 90 
                            ? 'red' 
                            : Math.round(((classItem._count?.students || 0) / classItem.maxStudents) * 100) >= 70 
                              ? 'yellow' 
                              : 'green'
                        }
                      />
                    </div>
                  </Table.Td>
                  <Table.Td>
                    {(() => {
                      const nextLesson = classItem.lessons?.find(l => l.status === 'SCHEDULED');
                      if (nextLesson) {
                        return (
                          <div>
                            <Text size="sm" fw={500}>
                              {nextLesson.title}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {new Date(nextLesson.startTime).toLocaleDateString('it-IT', {
                                weekday: 'short',
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                          </div>
                        );
                      }
                      return <Text size="sm" c="dimmed">Nessuna lezione programmata</Text>;
                    })()}
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge status={classItem.isActive} />
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Tooltip label="Visualizza dettagli">
                        <ActionIcon
                          size="sm"
                          variant="light"
                          color="blue"
                          onClick={() => handleView(classItem)}
                        >
                          <IconEye size={14} />
                        </ActionIcon>
                      </Tooltip>
                      {canManageClasses && (
                        <Tooltip label="Modifica classe">
                          <ActionIcon
                            size="sm"
                            variant="light"
                            color="yellow"
                            onClick={() => handleEdit(classItem)}
                          >
                            <IconEdit size={14} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
        
        {loading && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Text c="dimmed">Caricamento classi...</Text>
          </div>
        )}
        
        {!loading && classes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Text c="dimmed">Nessuna classe trovata</Text>
          </div>
        )}
      </Paper>

      {/* Create/Edit Modal */}
      <ModernModal
        opened={opened}
        onClose={close}
        title={editingClass ? 'Modifica Classe' : 'Nuova Classe'}
        size="lg"
      >
        <ClassForm
          opened={opened}
          onClose={close}
          classData={editingClass || undefined}
          onSave={handleFormSubmit}
          loading={submitting}
        />
      </ModernModal>
    </Container>
  );
}
