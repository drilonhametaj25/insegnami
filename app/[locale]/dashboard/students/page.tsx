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
import { AdvancedStudentForm } from '@/components/forms/AdvancedStudentForm';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  status: string;
  enrollmentDate: string;
  dateOfBirth?: string;
  address?: string;
  studentCode?: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  emergencyContact?: string;
  medicalNotes?: string;
  specialNeeds?: string;
  classes?: Array<{
    id: string;
    name: string;
    level: string;
  }>;
  attendance?: {
    percentage: number;
    present: number;
    absent: number;
  };
}

interface StudentsResponse {
  students: Student[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface StudentsStats {
  totalStudents: number;
  activeStudents: number;
  inactiveStudents: number;
  newStudentsThisMonth: number;
}

export default function StudentsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState<StudentsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [opened, { open, close }] = useDisclosure(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Check if user has permission to manage students
  const canManageStudents = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN' || session?.user?.role === 'TEACHER';

  // Navigate to student detail
  const handleViewStudent = (studentId: string) => {
    router.push(`/${locale}/dashboard/students/${studentId}`);
  };

  // Fetch students
  const fetchStudents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        ...(searchQuery && { search: searchQuery }),
        ...(statusFilter && { status: statusFilter }),
      });

      const response = await fetch(`/api/students?${params}`);
      if (!response.ok) {
        throw new Error('Errore nel caricamento degli studenti');
      }

      const data: StudentsResponse = await response.json();
      setStudents(data.students);
      setPagination(data.pagination);
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: 'Impossibile caricare gli studenti',
        color: 'red',
        icon: <IconX />,
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/students/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    if (canManageStudents) {
      fetchStudents();
      fetchStats();
    }
  }, [pagination.page, searchQuery, statusFilter, canManageStudents]);

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Handle filter
  const handleFilter = (filter: string) => {
    setStatusFilter(filter);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  // Handle create student
  const handleCreate = () => {
    setEditingStudent(null);
    open();
  };

  // Handle edit student
  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    open();
  };

  // Submit student form
  const handleSubmit = async (data: any) => {
    try {
      setSubmitting(true);
      const isEdit = !!editingStudent;
      const url = isEdit ? `/api/students/${editingStudent.id}` : '/api/students';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore durante il salvataggio');
      }

      notifications.show({
        title: 'Successo',
        message: `Studente ${isEdit ? 'aggiornato' : 'creato'} con successo`,
        color: 'green',
        icon: <IconCheck />,
      });

      close();
      fetchStudents();
    } catch (error) {
      notifications.show({
        title: 'Errore',
        message: error instanceof Error ? error.message : 'Errore durante il salvataggio',
        color: 'red',
        icon: <IconX />,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Table columns definition
  const columns = [
    {
      key: 'firstName' as keyof Student,
      title: 'Studente',
      render: (_value: any, student: Student) => (
        <Group gap="sm">
          <UnstyledButton onClick={() => handleViewStudent(student.id)}>
            <Group gap="sm">
              <Avatar size="sm" color="blue">
                {student.firstName[0]}{student.lastName[0]}
              </Avatar>
              <div>
                <Text fw={500} size="sm" c="blue" style={{ cursor: 'pointer' }}>
                  {student.firstName} {student.lastName}
                </Text>
                <Text size="xs" c="dimmed">
                  {student.email}
                </Text>
              </div>
            </Group>
          </UnstyledButton>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconEye size={14} />}
            onClick={() => handleViewStudent(student.id)}
          >
            Dettagli
          </Button>
        </Group>
      ),
    },
    {
      key: 'phone' as keyof Student,
      title: 'Telefono',
      render: (phone: string | null) => phone || '-',
    },
    {
      key: 'status' as keyof Student,
      title: 'Stato',
      render: (status: string) => TableRenderers.status(status),
    },
    {
      key: 'classes' as keyof Student,
      title: 'Classi',
      render: (classes: Student['classes']) => (
        <Text size="sm">
          {classes?.length || 0} classi
        </Text>
      ),
    },
    {
      key: 'enrollmentDate' as keyof Student,
      title: 'Data Iscrizione',
      render: (date: string) => TableRenderers.date(date),
    },
  ];

  if (!canManageStudents) {
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
      <LoadingOverlay visible={loading && students.length === 0} />
      
      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={2}>Gestione Studenti</Title>
          <Group>
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="light"
              onClick={fetchStudents}
              loading={loading}
            >
              Aggiorna
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={handleCreate}
            >
              Nuovo Studente
            </Button>
          </Group>
        </Group>

        {/* Stats Cards */}
        {stats && (
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <ModernStatsCard
                title="Studenti Totali"
                value={stats.totalStudents}
                icon="👥"
                gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <ModernStatsCard
                title="Studenti Attivi"
                value={stats.activeStudents}
                icon="✅"
                gradient="linear-gradient(135deg, #48bb78 0%, #38a169 100%)"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <ModernStatsCard
                title="Studenti Inattivi"
                value={stats.inactiveStudents}
                icon="⏸️"
                gradient="linear-gradient(135deg, #a0aec0 0%, #718096 100%)"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <ModernStatsCard
                title="Nuovi questo Mese"
                value={stats.newStudentsThisMonth}
                icon="🆕"
                gradient="linear-gradient(135deg, #4fd1c7 0%, #3182ce 100%)"
              />
            </Grid.Col>
          </Grid>
        )}

        <DataTable
          data={students}
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
          onCreate={handleCreate}
          createButtonLabel="Nuovo Studente"
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
          pageSize={pagination.limit}
          total={pagination.total}
        />
      </Stack>

      {/* Student Form Modal */}
      <AdvancedStudentForm
        opened={opened}
        onClose={close}
        student={editingStudent ? {
          id: editingStudent.id,
          firstName: editingStudent.firstName,
          lastName: editingStudent.lastName,
          email: editingStudent.email,
          phone: editingStudent.phone || '',
          dateOfBirth: editingStudent.dateOfBirth ? new Date(editingStudent.dateOfBirth) : new Date(),
          address: editingStudent.address || '',
          studentCode: editingStudent.studentCode || '',
          emergencyContact: editingStudent.emergencyContact || '',
          medicalNotes: editingStudent.medicalNotes || '',
          specialNeeds: editingStudent.specialNeeds || '',
          status: editingStudent.status as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
          user: (editingStudent as any).user,
          parentUser: (editingStudent as any).parentUser,
        } : undefined}
        onSave={handleSubmit}
        loading={submitting}
      />
    </Container>
  );
}
