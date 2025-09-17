'use client';

import { useState } from 'react';
import {
  Container,
  Title,
  Paper,
  Button,
  Group,
  Stack,
  Modal,
  TextInput,
  Select,
  Textarea,
  Badge,
  Table,
  ActionIcon,
  Text,
  Grid,
  Card,
  Alert,
  LoadingOverlay,
  Pagination,
  Menu,
  Avatar,
  Tooltip,
} from '@mantine/core';
import {
  IconPlus,
  IconSearch,
  IconFilter,
  IconEdit,
  IconTrash,
  IconEye,
  IconDownload,
  IconUpload,
  IconUsers,
  IconUserCheck,
  IconUserX,
  IconUserPlus,
  IconChevronDown,
  IconRefresh,
} from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { useStudents, useStudentStats, useCreateStudent, useUpdateStudent, useDeleteStudent } from '@/lib/hooks/useStudents';
import { StatsCard } from '@/components/cards/StatsCard';

export default function StudentsPage() {
  const { data: session } = useSession();
  const t = useTranslations('students');
  const tCommon = useTranslations('common');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('lastName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [modalOpened, setModalOpened] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    enrollmentDate: '',
    status: 'ACTIVE' as const,
    notes: '',
  });

  // TanStack Query hooks
  const {
    data: studentsData,
    isLoading: studentsLoading,
    error: studentsError,
    refetch: refetchStudents,
  } = useStudents(page, 20, {
    search,
    status: statusFilter,
    sortBy,
    sortOrder,
  });

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useStudentStats();

  const createStudentMutation = useCreateStudent();
  const updateStudentMutation = useUpdateStudent();
  const deleteStudentMutation = useDeleteStudent();

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingStudent) {
        await updateStudentMutation.mutateAsync({
          id: editingStudent.id,
          data: formData,
        });
        notifications.show({
          title: 'Success',
          message: 'Student updated successfully',
          color: 'green',
        });
      } else {
        await createStudentMutation.mutateAsync(formData);
        notifications.show({
          title: 'Success',
          message: 'Student created successfully',
          color: 'green',
        });
      }

      setModalOpened(false);
      resetForm();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to save student',
        color: 'red',
      });
    }
  };

  // Handle student deletion
  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      try {
        await deleteStudentMutation.mutateAsync(id);
        notifications.show({
          title: 'Success',
          message: 'Student deleted successfully',
          color: 'green',
        });
      } catch (error: any) {
        notifications.show({
          title: 'Error',
          message: error.message || 'Failed to delete student',
          color: 'red',
        });
      }
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      dateOfBirth: '',
      enrollmentDate: '',
      status: 'ACTIVE',
      notes: '',
    });
    setEditingStudent(null);
  };

  // Handle edit
  const handleEdit = (student: any) => {
    setEditingStudent(student);
    setFormData({
      firstName: student.firstName,
      lastName: student.lastName,
      email: student.email,
      phone: student.phone || '',
      dateOfBirth: student.dateOfBirth?.split('T')[0] || '',
      enrollmentDate: student.enrollmentDate?.split('T')[0] || '',
      status: student.status,
      notes: student.notes || '',
    });
    setModalOpened(true);
  };

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'green';
      case 'INACTIVE':
        return 'gray';
      case 'SUSPENDED':
        return 'red';
      default:
        return 'gray';
    }
  };

  if (!session?.user) {
    return (
      <Container>
        <Alert color="red">You must be logged in to view this page.</Alert>
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Title order={1}>{t('title')}</Title>
          <Group>
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="light"
              onClick={() => refetchStudents()}
              loading={studentsLoading}
            >
              {tCommon('refresh')}
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setModalOpened(true)}
            >
              {t('addStudent')}
            </Button>
          </Group>
        </Group>

        {/* Stats Cards */}
        {statsError ? (
          <Alert color="red">{t('statsError')}</Alert>
        ) : (
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <StatsCard
                title={t('totalStudents')}
                value={stats?.totalStudents || 0}
                icon={<IconUsers size={20} />}
                color="blue"
                loading={statsLoading}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <StatsCard
                title={t('activeStudents')}
                value={stats?.activeStudents || 0}
                icon={<IconUserCheck size={20} />}
                color="green"
                loading={statsLoading}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <StatsCard
                title="Inactive Students"
                value={stats?.inactiveStudents || 0}
                icon={<IconUserX size={20} />}
                color="gray"
                loading={statsLoading}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <StatsCard
                title="New This Month"
                value={stats?.newStudentsThisMonth || 0}
                icon={<IconUserPlus size={20} />}
                color="teal"
                loading={statsLoading}
              />
            </Grid.Col>
          </Grid>
        )}

        {/* Filters */}
        <Paper p="md" withBorder>
          <Group>
            <TextInput
              placeholder="Search students..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ flex: 1 }}
            />
            <Select
              placeholder="Filter by status"
              data={[
                { value: '', label: 'All Status' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
                { value: 'SUSPENDED', label: 'Suspended' },
              ]}
              value={statusFilter}
              onChange={(value) => setStatusFilter(value || '')}
              clearable
            />
            <Select
              placeholder="Sort by"
              data={[
                { value: 'lastName', label: 'Last Name' },
                { value: 'firstName', label: 'First Name' },
                { value: 'email', label: 'Email' },
                { value: 'enrollmentDate', label: 'Enrollment Date' },
              ]}
              value={sortBy}
              onChange={(value) => setSortBy(value || 'lastName')}
            />
            <Select
              data={[
                { value: 'asc', label: t('ascending') },
                { value: 'desc', label: t('descending') },
              ]}
              value={sortOrder}
              onChange={(value) => setSortOrder(value as 'asc' | 'desc')}
            />
          </Group>
        </Paper>

        {/* Students Table */}
        <Paper withBorder>
          <LoadingOverlay visible={studentsLoading} />
          
          {studentsError ? (
            <Alert color="red" m="md">
              {t('loadError')}: {studentsError.message}
            </Alert>
          ) : (
            <>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('student')}</Table.Th>
                    <Table.Th>{t('email')}</Table.Th>
                    <Table.Th>{t('phone')}</Table.Th>
                    <Table.Th>{t('status')}</Table.Th>
                    <Table.Th>{t('classes')}</Table.Th>
                    <Table.Th>{t('enrollmentDate')}</Table.Th>
                    <Table.Th>{t('actions')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {studentsData?.students.map((student) => (
                    <Table.Tr key={student.id}>
                      <Table.Td>
                        <Group>
                          <Avatar size="sm" color="blue">
                            {student.firstName[0]}{student.lastName[0]}
                          </Avatar>
                          <div>
                            <Text size="sm" fw={500}>
                              {student.firstName} {student.lastName}
                            </Text>
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{student.email}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{student.phone || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={getStatusColor(student.status)} size="sm">
                          {student.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {student.classes?.length || 0} classes
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {new Date(student.enrollmentDate).toLocaleDateString()}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Tooltip label="Edit">
                            <ActionIcon
                              variant="subtle"
                              onClick={() => handleEdit(student)}
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => handleDelete(student.id, `${student.firstName} ${student.lastName}`)}
                              loading={deleteStudentMutation.isPending}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              {/* Pagination */}
              {studentsData?.pagination && studentsData.pagination.totalPages > 1 && (
                <Group justify="center" p="md">
                  <Pagination
                    value={page}
                    onChange={setPage}
                    total={studentsData.pagination.totalPages}
                  />
                </Group>
              )}
            </>
          )}
        </Paper>

        {/* Create/Edit Modal */}
        <Modal
          opened={modalOpened}
          onClose={() => {
            setModalOpened(false);
            resetForm();
          }}
          title={editingStudent ? t('editStudent') : t('addStudent')}
          size="md"
        >
          <form onSubmit={handleSubmit}>
            <Stack>
              <Group grow>
                <TextInput
                  label={t('firstName')}
                  placeholder={`${tCommon('enter')} ${t('firstName').toLowerCase()}`}
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  required
                />
                <TextInput
                  label={t('lastName')}
                  placeholder={`${tCommon('enter')} ${t('lastName').toLowerCase()}`}
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  required
                />
              </Group>

              <TextInput
                label={t('email')}
                placeholder={`${tCommon('enter')} ${t('email').toLowerCase()}`}
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                required
              />

              <TextInput
                label={t('phone')}
                placeholder={`${tCommon('enter')} ${t('phone').toLowerCase()}`}
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />

              <Group grow>
                <TextInput
                  label={t('dateOfBirth')}
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) =>
                    setFormData({ ...formData, dateOfBirth: e.target.value })
                  }
                />
                <TextInput
                  label={t('enrollmentDate')}
                  type="date"
                  value={formData.enrollmentDate}
                  onChange={(e) =>
                    setFormData({ ...formData, enrollmentDate: e.target.value })
                  }
                  required
                />
              </Group>

              <Select
                label={t('status')}
                data={[
                  { value: 'ACTIVE', label: t('active') },
                  { value: 'INACTIVE', label: t('inactive') },
                  { value: 'SUSPENDED', label: t('suspended') },
                ]}
                value={formData.status}
                onChange={(value) =>
                  setFormData({ ...formData, status: value as any })
                }
                required
              />

              <Textarea
                label={t('notes')}
                placeholder={t('notesPlaceholder')}
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
              />

              <Group justify="flex-end" mt="md">
                <Button
                  variant="subtle"
                  onClick={() => {
                    setModalOpened(false);
                    resetForm();
                  }}
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="submit"
                  loading={
                    createStudentMutation.isPending || 
                    updateStudentMutation.isPending
                  }
                >
                  {editingStudent ? t('updateStudent') : t('createStudent')}
                </Button>
              </Group>
            </Stack>
          </form>
        </Modal>
      </Stack>
    </Container>
  );
}
