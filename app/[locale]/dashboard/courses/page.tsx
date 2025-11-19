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
  LoadingOverlay,
  Alert,
  ActionIcon,
  TextInput,
  Select,
  Badge,
  Table,
  ScrollArea,
  Avatar,
  Tooltip,
  Menu,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { 
  IconPlus, 
  IconSearch, 
  IconRefresh,
  IconX, 
  IconInfoCircle, 
  IconBook2, 
  IconSchool,
  IconEye,
  IconEdit,
  IconCheck,
  IconDotsVertical,
  IconTrash,
  IconChartBar,
} from '@tabler/icons-react';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';
import { ModernModal } from '@/components/modals/ModernModal';
import { CourseForm } from '@/components/forms/CourseForm';

interface Course {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
  level: string;
  duration?: number;
  maxStudents?: number;
  minStudents?: number;
  price?: number;
  isActive: boolean;
  classCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CoursesResponse {
  courses: Course[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface CoursesStats {
  total: number;
  active: number;
  inactive: number;
  totalClasses: number;
  averagePrice: number;
}

const StatusBadge = ({ status }: { status: boolean }) => (
  <Badge
    color={status ? 'green' : 'red'}
    variant="light"
    size="sm"
  >
    {status ? 'Attivo' : 'Inattivo'}
  </Badge>
);

const LevelBadge = ({ level }: { level: string }) => {
  const colors: Record<string, string> = {
    'A1': 'green',
    'A2': 'teal',
    'B1': 'blue',
    'B2': 'indigo',
    'C1': 'violet',
    'C2': 'grape',
    'Mixed': 'gray',
  };
  
  return (
    <Badge color={colors[level] || 'gray'} variant="light" size="sm">
      {level}
    </Badge>
  );
};

export default function CoursesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('courses');
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<CoursesStats | null>(null);
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
  const [levelFilter, setLevelFilter] = useState('');
  
  const [opened, { open, close }] = useDisclosure(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  // Check permissions
  const canManageCourses = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN';
  const canViewCourses = canManageCourses || session?.user?.role === 'TEACHER';

  // Fetch courses data
  const fetchCourses = async (
    page = 1, 
    search = searchTerm, 
    status = statusFilter,
    level = levelFilter
  ) => {
    if (!canViewCourses) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });
      
      if (search) params.append('search', search);
      if (status) params.append('isActive', status);
      if (level) params.append('level', level);

      const response = await fetch(`/api/courses?${params}`);
      if (!response.ok) throw new Error('Failed to fetch courses');
      
      const data: CoursesResponse = await response.json();
      setCourses(data.courses);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching courses:', error);
      notifications.show({
        id: `fetch-error-${Date.now()}`,
        title: 'Errore',
        message: 'Impossibile caricare i corsi',
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    if (!canViewCourses) return;
    
    try {
      const response = await fetch('/api/courses/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      
      const data: CoursesStats = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching course stats:', error);
    }
  };

  useEffect(() => {
    if (canViewCourses) {
      fetchCourses();
      fetchStats();
    }
  }, [canViewCourses]);

  // Handlers
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    fetchCourses(1, value, statusFilter, levelFilter);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    fetchCourses(1, searchTerm, value, levelFilter);
  };

  const handleLevelFilter = (value: string) => {
    setLevelFilter(value);
    fetchCourses(1, searchTerm, statusFilter, value);
  };

  const handlePageChange = (page: number) => {
    fetchCourses(page, searchTerm, statusFilter, levelFilter);
  };

  const handleCreate = () => {
    setEditingCourse(null);
    open();
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    open();
  };

  const handleView = (course: Course) => {
    router.push(`/${locale}/dashboard/courses/${course.id}`);
  };

  const handleDelete = async (course: Course) => {
    if (!confirm(`Sei sicuro di voler eliminare il corso "${course.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/courses/${course.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete course');
      }

      notifications.show({
        title: 'Successo',
        message: 'Corso eliminato con successo',
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      fetchCourses();
      fetchStats();
    } catch (error: any) {
      notifications.show({
        title: 'Errore',
        message: error.message || 'Impossibile eliminare il corso',
        color: 'red',
        icon: <IconX size={18} />,
      });
    }
  };

  const handleFormSubmit = async (formData: any) => {
    try {
      setSubmitting(true);
      
      const url = editingCourse 
        ? `/api/courses/${editingCourse.id}` 
        : '/api/courses';
      const method = editingCourse ? 'PUT' : 'POST';
      
      notifications.show({
        id: 'saving-course',
        title: editingCourse ? '⏳ Aggiornamento in corso...' : '⏳ Creazione in corso...',
        message: editingCourse ? 'Salvataggio modifiche corso' : 'Creazione nuovo corso',
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

      notifications.hide('saving-course');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save course');
      }

      const responseData = await response.json();

      notifications.show({
        id: `course-success-${Date.now()}`,
        title: '✅ Successo',
        message: responseData.message || `Corso ${editingCourse ? 'aggiornato' : 'creato'} con successo`,
        color: 'green',
        icon: <IconCheck size={18} />,
        autoClose: 4000,
      });

      close();
      fetchCourses();
      fetchStats();
    } catch (error: any) {
      notifications.hide('saving-course');
      
      console.error('Error saving course:', error);
      notifications.show({
        id: `course-error-${Date.now()}`,
        title: '❌ Errore',
        message: error.message || 'Impossibile salvare il corso',
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
      title: 'Corsi Totali',
      value: stats.total.toString(),
      icon: <IconBook2 size={24} />,
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    {
      title: 'Corsi Attivi',
      value: stats.active.toString(),
      icon: <IconSchool size={24} />,
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    },
    {
      title: 'Classi Totali',
      value: stats.totalClasses.toString(),
      icon: <IconSchool size={24} />,
      gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    },
    {
      title: 'Prezzo Medio',
      value: `€${Number(stats.averagePrice).toFixed(0)}`,
      icon: <IconChartBar size={24} />,
      gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    },
  ] : [];

  if (!canViewCourses) {
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
      <LoadingOverlay visible={loading && courses.length === 0} />
      
      {/* Header */}
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2} mb="xs">
            Gestione Corsi
          </Title>
          <Text c="dimmed">
            Gestisci il catalogo dei corsi offerti dalla scuola
          </Text>
        </div>
        {canManageCourses && (
          <Button
            onClick={handleCreate}
            leftSection={<IconPlus size={18} />}
            variant="gradient"
            gradient={{ from: 'indigo', to: 'purple', deg: 45 }}
            radius="lg"
          >
            Nuovo Corso
          </Button>
        )}
      </Group>

      {/* Stats Cards */}
      {stats && (
        <Grid mb="xl">
          {statsCards.map((card, index) => (
            <Grid.Col key={index} span={{ base: 12, sm: 6, lg: 3 }}>
              <ModernStatsCard {...card} />
            </Grid.Col>
          ))}
        </Grid>
      )}

      {/* Filters */}
      <Group mb="md" gap="md">
        <TextInput
          placeholder="Cerca corsi..."
          value={searchTerm}
          onChange={(e) => handleSearch(e.target.value)}
          leftSection={<IconSearch size={16} />}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="Tutti i livelli"
          value={levelFilter}
          onChange={(value) => handleLevelFilter(value || '')}
          data={[
            { value: '', label: 'Tutti i livelli' },
            { value: 'A1', label: 'A1' },
            { value: 'A2', label: 'A2' },
            { value: 'B1', label: 'B1' },
            { value: 'B2', label: 'B2' },
            { value: 'C1', label: 'C1' },
            { value: 'C2', label: 'C2' },
          ]}
          style={{ minWidth: 150 }}
        />
        <Select
          placeholder="Tutti gli stati"
          value={statusFilter}
          onChange={(value) => handleStatusFilter(value || '')}
          data={[
            { value: '', label: 'Tutti gli stati' },
            { value: 'true', label: 'Attivi' },
            { value: 'false', label: 'Inattivi' },
          ]}
          style={{ minWidth: 150 }}
        />
        <Button
          onClick={() => {
            setSearchTerm('');
            setStatusFilter('');
            setLevelFilter('');
            fetchCourses(1, '', '', '');
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
                <Table.Th>Corso</Table.Th>
                <Table.Th>Categoria</Table.Th>
                <Table.Th>Livello</Table.Th>
                <Table.Th>Durata</Table.Th>
                <Table.Th>Prezzo</Table.Th>
                <Table.Th>Classi</Table.Th>
                <Table.Th>Stato</Table.Th>
                <Table.Th>Azioni</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {courses.map((course) => (
                <Table.Tr key={course.id}>
                  <Table.Td>
                    <Group gap="sm">
                      <Avatar size="sm" color="violet" radius="md">
                        {course.code ? course.code.substring(0, 2) : course.name.substring(0, 2)}
                      </Avatar>
                      <div>
                        <Text fw={500} size="sm" c="blue" style={{ cursor: 'pointer' }} onClick={() => handleView(course)}>
                          {course.name}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {course.code}
                        </Text>
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="cyan" size="sm">
                      {course.category}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <LevelBadge level={course.level} />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{course.duration ? `${course.duration} min` : '-'}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {course.price ? `€${Number(course.price).toFixed(0)}` : '-'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="blue" size="sm">
                      {course.classCount}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge status={course.isActive} />
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Tooltip label="Visualizza dettagli">
                        <ActionIcon
                          size="sm"
                          variant="light"
                          color="blue"
                          onClick={() => handleView(course)}
                        >
                          <IconEye size={14} />
                        </ActionIcon>
                      </Tooltip>
                      {canManageCourses && (
                        <>
                          <Tooltip label="Modifica corso">
                            <ActionIcon
                              size="sm"
                              variant="light"
                              color="yellow"
                              onClick={() => handleEdit(course)}
                            >
                              <IconEdit size={14} />
                            </ActionIcon>
                          </Tooltip>
                          <Menu shadow="md" width={200}>
                            <Menu.Target>
                              <ActionIcon size="sm" variant="light">
                                <IconDotsVertical size={14} />
                              </ActionIcon>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <Menu.Item 
                                leftSection={<IconTrash size={14} />} 
                                color="red"
                                onClick={() => handleDelete(course)}
                              >
                                Elimina
                              </Menu.Item>
                            </Menu.Dropdown>
                          </Menu>
                        </>
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
            <Text c="dimmed">Caricamento corsi...</Text>
          </div>
        )}
        
        {!loading && courses.length === 0 && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <IconBook2 size={48} color="var(--mantine-color-gray-4)" />
            <Text size="lg" fw={500} mt="md" c="dimmed">
              Nessun corso trovato
            </Text>
            <Text size="sm" c="dimmed" mb="md">
              {canManageCourses && "Inizia creando il tuo primo corso"}
            </Text>
            {canManageCourses && (
              <Button onClick={handleCreate}>
                Crea Primo Corso
              </Button>
            )}
          </div>
        )}
      </Paper>

      {/* Create/Edit Modal */}
      <ModernModal
        opened={opened}
        onClose={close}
        title={editingCourse ? 'Modifica Corso' : 'Nuovo Corso'}
        size="lg"
      >
        <CourseForm
          opened={opened}
          onClose={close}
          courseData={editingCourse ? {
            id: editingCourse.id,
            name: editingCourse.name,
            code: editingCourse.code,
            description: editingCourse.description,
            category: editingCourse.category,
            level: editingCourse.level,
            duration: editingCourse.duration,
            maxStudents: editingCourse.maxStudents,
            minStudents: editingCourse.minStudents,
            price: editingCourse.price,
            isActive: editingCourse.isActive,
          } : undefined}
          onSave={handleFormSubmit}
          loading={submitting}
        />
      </ModernModal>
    </Container>
  );
}
