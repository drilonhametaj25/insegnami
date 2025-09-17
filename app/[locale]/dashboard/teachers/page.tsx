'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
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
  Alert,
  LoadingOverlay,
  Pagination,
  Avatar,
  Tooltip,
} from '@mantine/core';
import {
  IconPlus,
  IconSearch,
  IconEdit,
  IconTrash,
  IconUsers,
  IconChalkboard,
  IconUserCheck,
  IconUserX,
  IconRefresh,
  IconCalendar,
} from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import { notifications } from '@mantine/notifications';
import { useTeachers, useTeacherStats, useCreateTeacher, useUpdateTeacher, useDeleteTeacher } from '@/lib/hooks/useTeachers';
import { StatsCard } from '@/components/cards/StatsCard';

export default function TeachersPage() {
  const { data: session } = useSession();
  const t = useTranslations('teachers');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('lastName');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [modalOpened, setModalOpened] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<any>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    qualifications: '',
    specializations: '',
    hireDate: '',
    status: 'ACTIVE' as const,
    notes: '',
  });

  // TanStack Query hooks
  const {
    data: teachersData,
    isLoading: teachersLoading,
    error: teachersError,
    refetch: refetchTeachers,
  } = useTeachers(page, 20, {
    search,
    status: statusFilter,
    sortBy,
    sortOrder,
  });

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useTeacherStats();

  const createTeacherMutation = useCreateTeacher();
  const updateTeacherMutation = useUpdateTeacher();
  const deleteTeacherMutation = useDeleteTeacher();

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingTeacher) {
        await updateTeacherMutation.mutateAsync({
          id: editingTeacher.id,
          data: formData,
        });
        notifications.show({
          title: tCommon('success'),
          message: t('updateSuccess'),
          color: 'green',
        });
      } else {
        await createTeacherMutation.mutateAsync(formData);
        notifications.show({
          title: tCommon('success'),
          message: t('createSuccess'),
          color: 'green',
        });
      }

      setModalOpened(false);
      resetForm();
    } catch (error: any) {
      notifications.show({
        title: tCommon('error'),
        message: error.message || t('saveError'),
        color: 'red',
      });
    }
  };

  // Handle teacher deletion
  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`${t('confirmDelete')} ${name}?`)) {
      try {
        await deleteTeacherMutation.mutateAsync(id);
        notifications.show({
          title: tCommon('success'),
          message: t('deleteSuccess'),
          color: 'green',
        });
      } catch (error: any) {
        notifications.show({
          title: tCommon('error'),
          message: error.message || t('deleteError'),
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
      qualifications: '',
      specializations: '',
      hireDate: '',
      status: 'ACTIVE',
      notes: '',
    });
    setEditingTeacher(null);
  };

  // Handle edit
  const handleEdit = (teacher: any) => {
    setEditingTeacher(teacher);
    setFormData({
      firstName: teacher.firstName,
      lastName: teacher.lastName,
      email: teacher.email,
      phone: teacher.phone || '',
      qualifications: teacher.qualifications || '',
      specializations: teacher.specializations || '',
      hireDate: teacher.hireDate?.split('T')[0] || '',
      status: teacher.status,
      notes: teacher.notes || '',
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
              onClick={() => refetchTeachers()}
              loading={teachersLoading}
            >
              {tCommon('refresh')}
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setModalOpened(true)}
            >
              {t('addTeacher')}
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
                title={t('totalTeachers')}
                value={stats?.totalTeachers || 0}
                icon={<IconUsers size={20} />}
                color="blue"
                loading={statsLoading}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <StatsCard
                title={t('activeTeachers')}
                value={stats?.activeTeachers || 0}
                icon={<IconUserCheck size={20} />}
                color="green"
                loading={statsLoading}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <StatsCard
                title={t('inactiveTeachers')}
                value={stats?.inactiveTeachers || 0}
                icon={<IconUserX size={20} />}
                color="gray"
                loading={statsLoading}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <StatsCard
                title="Avg Classes/Teacher"
                value={stats?.avgClassesPerTeacher?.toFixed(1) || '0'}
                icon={<IconChalkboard size={20} />}
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
              placeholder="Search teachers..."
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
                { value: 'hireDate', label: 'Hire Date' },
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

        {/* Teachers Table */}
        <Paper withBorder>
          <LoadingOverlay visible={teachersLoading} />
          
          {teachersError ? (
            <Alert color="red" m="md">
              {t('loadError')}: {teachersError.message}
            </Alert>
          ) : (
            <>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('teacher')}</Table.Th>
                    <Table.Th>{t('email')}</Table.Th>
                    <Table.Th>{t('phone')}</Table.Th>
                    <Table.Th>{t('status')}</Table.Th>
                    <Table.Th>{t('classes')}</Table.Th>
                    <Table.Th>{t('specializations')}</Table.Th>
                    <Table.Th>{t('hireDate')}</Table.Th>
                    <Table.Th>{t('actions')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {teachersData?.teachers.map((teacher) => (
                    <Table.Tr key={teacher.id}>
                      <Table.Td>
                        <Group>
                          <Avatar size="sm" color="blue">
                            {teacher.firstName[0]}{teacher.lastName[0]}
                          </Avatar>
                          <div>
                            <Text size="sm" fw={500}>
                              {teacher.firstName} {teacher.lastName}
                            </Text>
                            {teacher.qualifications && (
                              <Text size="xs" c="dimmed">
                                {teacher.qualifications}
                              </Text>
                            )}
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{teacher.email}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{teacher.phone || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={getStatusColor(teacher.status)} size="sm">
                          {teacher.status}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {teacher.classes?.length || 0} classes
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={1}>
                          {teacher.specializations || '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">
                          {new Date(teacher.hireDate).toLocaleDateString()}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Tooltip label="Edit">
                            <ActionIcon
                              variant="subtle"
                              onClick={() => handleEdit(teacher)}
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Delete">
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => handleDelete(teacher.id, `${teacher.firstName} ${teacher.lastName}`)}
                              loading={deleteTeacherMutation.isPending}
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
              {teachersData?.pagination && teachersData.pagination.totalPages > 1 && (
                <Group justify="center" p="md">
                  <Pagination
                    value={page}
                    onChange={setPage}
                    total={teachersData.pagination.totalPages}
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
          title={editingTeacher ? t('editTeacher') : t('addTeacher')}
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

              <TextInput
                label={t('qualifications')}
                placeholder={t('qualificationsPlaceholder')}
                value={formData.qualifications}
                onChange={(e) =>
                  setFormData({ ...formData, qualifications: e.target.value })
                }
              />

              <TextInput
                label={t('specializations')}
                placeholder={t('specializationsPlaceholder')}
                value={formData.specializations}
                onChange={(e) =>
                  setFormData({ ...formData, specializations: e.target.value })
                }
              />

              <Group grow>
                <TextInput
                  label="Hire Date"
                  type="date"
                  value={formData.hireDate}
                  onChange={(e) =>
                    setFormData({ ...formData, hireDate: e.target.value })
                  }
                  required
                />
                <Select
                  label={t('status')}
                  data={[
                    { value: 'ACTIVE', label: t('active') },
                    { value: 'INACTIVE', label: t('inactive') },
                    { value: 'SUSPENDED', label: 'Sospeso' },
                  ]}
                  value={formData.status}
                  onChange={(value) =>
                    setFormData({ ...formData, status: value as any })
                  }
                  required
                />
              </Group>

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
                    createTeacherMutation.isPending || 
                    updateTeacherMutation.isPending
                  }
                >
                  {editingTeacher ? t('updateTeacher') : t('createTeacher')}
                </Button>
              </Group>
            </Stack>
          </form>
        </Modal>
      </Stack>
    </Container>
  );
}
