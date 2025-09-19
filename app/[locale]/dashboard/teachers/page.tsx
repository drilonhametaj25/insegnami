'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Container,
  Stack,
  Title,
  Button,
  Group,
  Text,
  Alert,
  LoadingOverlay,
  Avatar,
  UnstyledButton,
  Grid,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconX, IconInfoCircle, IconEye, IconPlus, IconRefresh } from '@tabler/icons-react';
import { DataTable, TableRenderers } from '@/components/tables/DataTable';
import { TeacherForm } from '@/components/forms/TeacherForm';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';

interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  hireDate: string;
  specializations?: string;
  hourlyRate?: number;
  subjects?: string[];
  classes?: Array<{
    id: string;
    name: string;
    level: string;
  }>;
}

interface TeachersResponse {
  teachers: Teacher[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface TeachersStats {
  total: number;
  active: number;
  inactive: number;
  totalHours: number;
}

export default function TeachersPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const locale = useLocale();
  const [opened, { open, close }] = useDisclosure(false);

  // State
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [stats, setStats] = useState<TeachersStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  // Search and filter
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Permission check
  const canManageTeachers = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN';

  // Fetch data
  const fetchTeachers = async (page = 1, search = '', status = '') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
      });
      
      if (search) params.append('search', search);
      if (status) params.append('status', status);

      const response = await fetch(`/api/teachers?${params}`);
      if (!response.ok) throw new Error('Failed to fetch teachers');
      
      const data: TeachersResponse = await response.json();
      setTeachers(data.teachers);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching teachers:', error);
      notifications.show({
        title: 'Errore',
        message: 'Impossibile caricare i docenti',
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/teachers/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      
      const data: TeachersStats = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching teacher stats:', error);
    }
  };

  useEffect(() => {
    if (canManageTeachers) {
      fetchTeachers();
      fetchStats();
    }
  }, [canManageTeachers]);

  // Handlers
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    fetchTeachers(1, value, statusFilter);
  };

  const handleFilter = (value: string) => {
    setStatusFilter(value);
    fetchTeachers(1, searchTerm, value);
  };

  const handlePageChange = (page: number) => {
    fetchTeachers(page, searchTerm, statusFilter);
  };

  const handleCreate = () => {
    setEditingTeacher(null);
    open();
  };

  const handleEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    open();
  };

  const handleViewTeacher = (teacherId: string) => {
    router.push(`/${locale}/dashboard/teachers/${teacherId}`);
  };

  const handleFormSubmit = async (formData: any) => {
    try {
      setSubmitting(true);
      const url = editingTeacher 
        ? `/api/teachers/${editingTeacher.id}` 
        : '/api/teachers';
      
      const method = editingTeacher ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save teacher');
      }

      notifications.show({
        title: 'Successo',
        message: `Docente ${editingTeacher ? 'aggiornato' : 'creato'} con successo`,
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      close();
      fetchTeachers();
      fetchStats();
    } catch (error: any) {
      notifications.show({
        title: 'Errore',
        message: error.message,
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Table columns definition
  const columns = [
    {
      key: 'firstName' as keyof Teacher,
      title: 'Docente',
      render: (_value: any, teacher: Teacher) => (
        <UnstyledButton onClick={() => handleViewTeacher(teacher.id)}>
          <Group gap="sm">
            <Avatar size="sm" color="teal">
              {teacher.firstName[0]}{teacher.lastName[0]}
            </Avatar>
            <div>
              <Text fw={500} size="sm" c="blue" style={{ cursor: 'pointer' }}>
                {teacher.firstName} {teacher.lastName}
              </Text>
              <Text size="xs" c="dimmed">
                {teacher.email}
              </Text>
            </div>
          </Group>
        </UnstyledButton>
      ),
    },
    {
      key: 'phone' as keyof Teacher,
      title: 'Telefono',
      render: (phone: string | null) => phone || '-',
    },
    {
      key: 'specializations' as keyof Teacher,
      title: 'Specializzazione',
      render: (specializations: string | undefined) => specializations || '-',
    },
    {
      key: 'status' as keyof Teacher,
      title: 'Stato',
      render: (status: string) => TableRenderers.status(status),
    },
    {
      key: 'classes' as keyof Teacher,
      title: 'Classi',
      render: (classes: Teacher['classes']) => (
        <Text size="sm">
          {classes?.length || 0} classi
        </Text>
      ),
    },
    {
      key: 'hireDate' as keyof Teacher,
      title: 'Data Assunzione',
      render: (date: string) => TableRenderers.date(date),
    },
  ];

  if (!canManageTeachers) {
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
      <LoadingOverlay visible={loading && teachers.length === 0} />
      
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={2}>Gestione Docenti</Title>
          <Group>
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="light"
              onClick={() => fetchTeachers()}
              loading={loading}
            >
              Aggiorna
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={handleCreate}
            >
              Nuovo Docente
            </Button>
          </Group>
        </Group>

        {/* Stats Cards */}
        {stats && (
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <ModernStatsCard
                title="Docenti Totali"
                value={stats?.total?.toString() || '0'}
                icon="👨‍🏫"
                gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <ModernStatsCard
                title="Docenti Attivi"
                value={stats?.active?.toString() || '0'}
                icon="✅"
                gradient="linear-gradient(135deg, #11998e 0%, #38ef7d 100%)"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <ModernStatsCard
                title="Docenti Inattivi"
                value={stats?.inactive?.toString() || '0'}
                icon="⏸️"
                gradient="linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <ModernStatsCard
                title="Ore Totali/Mese"
                value={stats?.totalHours?.toString() || '0'}
                icon="⏰"
                gradient="linear-gradient(135deg, #4fd1c7 0%, #3182ce 100%)"
              />
            </Grid.Col>
          </Grid>
        )}

        <DataTable
          data={teachers}
          columns={columns}
          loading={loading}
          searchPlaceholder="Cerca per nome, cognome o email..."
          onSearch={handleSearch}
          filterable
          filterOptions={[
            { value: 'ACTIVE', label: 'Attivo' },
            { value: 'INACTIVE', label: 'Inattivo' },
            { value: 'SUSPENDED', label: 'Sospeso' },
          ]}
          filterLabel="Filtra per stato"
          onFilter={handleFilter}
          onEdit={handleEdit}
          onView={(teacher) => handleViewTeacher(teacher.id)}
          onCreate={handleCreate}
          createButtonLabel="Nuovo Docente"
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
          pageSize={pagination.limit}
          total={pagination.total}
        />
      </Stack>

      {/* Teacher Form Modal */}
      <TeacherForm
        opened={opened}
        onClose={close}
        teacher={editingTeacher ? {
          id: editingTeacher.id,
          firstName: editingTeacher.firstName,
          lastName: editingTeacher.lastName,
          email: editingTeacher.email,
          phone: editingTeacher.phone || '',
          hireDate: new Date(editingTeacher.hireDate),
          specializations: editingTeacher.specializations || '',
          hourlyRate: editingTeacher.hourlyRate || 0,
          status: editingTeacher.status as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
        } : undefined}
        onSave={handleFormSubmit}
        loading={submitting}
      />
    </Container>
  );
}
