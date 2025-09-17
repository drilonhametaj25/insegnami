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
  Card,
  Alert,
  LoadingOverlay,
  Pagination,
  Menu,
  Avatar,
  Tooltip,
  NumberInput,
  Progress,
} from '@mantine/core';
import {
  IconPlus,
  IconSearch,
  IconFilter,
  IconEdit,
  IconTrash,
  IconEye,
  IconUsers,
  IconChalkboard,
  IconUserCheck,
  IconUserX,
  IconRefresh,
  IconCalendar,
} from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import { notifications } from '@mantine/notifications';
import { useClasses, useClassStats, useCreateClass, useUpdateClass, useDeleteClass } from '@/lib/hooks/useClasses';
import { useTeachers } from '@/lib/hooks/useTeachers';
import { useCourses } from '@/lib/hooks/useCourses';
import { StatsCard } from '@/components/cards/StatsCard';

export default function ClassesPage() {
  const { data: session } = useSession();
  const t = useTranslations('classes');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [modalOpened, setModalOpened] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    level: '',
    description: '',
    schedule: '',
    capacity: 10,
    status: 'ACTIVE' as const,
    startDate: '',
    endDate: '',
    teacherId: '',
    courseId: '',
  });

  // TanStack Query hooks
  const {
    data: classesData,
    isLoading: classesLoading,
    error: classesError,
    refetch: refetchClasses,
  } = useClasses(page, 20, {
    search,
    status: statusFilter,
    teacherId: teacherFilter,
    level: levelFilter,
    sortBy,
    sortOrder,
  });

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useClassStats();

  const { data: teachersData } = useTeachers(1, 100); // Get all teachers for select
  const { data: coursesData } = useCourses(1, 100); // Get all courses for select

  const createClassMutation = useCreateClass();
  const updateClassMutation = useUpdateClass();
  const deleteClassMutation = useDeleteClass();

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingClass) {
        await updateClassMutation.mutateAsync({
          id: editingClass.id,
          data: formData,
        });
        notifications.show({
          title: 'Success',
          message: 'Class updated successfully',
          color: 'green',
        });
      } else {
        await createClassMutation.mutateAsync(formData);
        notifications.show({
          title: 'Success',
          message: 'Class created successfully',
          color: 'green',
        });
      }

      setModalOpened(false);
      resetForm();
    } catch (error: any) {
      notifications.show({
        title: 'Error',
        message: error.message || 'Failed to save class',
        color: 'red',
      });
    }
  };

  // Handle class deletion
  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete ${name}?`)) {
      try {
        await deleteClassMutation.mutateAsync(id);
        notifications.show({
          title: 'Success',
          message: 'Class deleted successfully',
          color: 'green',
        });
      } catch (error: any) {
        notifications.show({
          title: 'Error',
          message: error.message || 'Failed to delete class',
          color: 'red',
        });
      }
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      level: '',
      description: '',
      schedule: '',
      capacity: 10,
      status: 'ACTIVE',
      startDate: '',
      endDate: '',
      teacherId: '',
      courseId: '',
    });
    setEditingClass(null);
  };

  // Handle edit
  const handleEdit = (classItem: any) => {
    setEditingClass(classItem);
    setFormData({
      name: classItem.name,
      level: classItem.level,
      description: classItem.description || '',
      schedule: classItem.schedule || '',
      capacity: classItem.capacity,
      status: classItem.status,
      startDate: classItem.startDate?.split('T')[0] || '',
      endDate: classItem.endDate?.split('T')[0] || '',
      teacherId: classItem.teacher?.id || '',
      courseId: classItem.course?.id || '',
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

  // Calculate capacity usage
  const getCapacityUsage = (studentCount: number, capacity: number) => {
    return (studentCount / capacity) * 100;
  };

  const getCapacityColor = (usage: number) => {
    if (usage >= 90) return 'red';
    if (usage >= 75) return 'orange';
    return 'green';
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
              onClick={() => refetchClasses()}
              loading={classesLoading}
            >
              {tCommon('refresh')}
            </Button>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setModalOpened(true)}
            >
              {t('addClass')}
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
                title={t('totalClasses')}
                value={stats?.totalClasses || 0}
                icon={<IconChalkboard size={20} />}
                color="blue"
                loading={statsLoading}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <StatsCard
                title={t('activeClasses')}
                value={stats?.activeClasses || 0}
                icon={<IconUserCheck size={20} />}
                color="green"
                loading={statsLoading}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <StatsCard
                title={t('totalStudents')}
                value={stats?.totalStudents || 0}
                icon={<IconUsers size={20} />}
                color="teal"
                loading={statsLoading}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <StatsCard
                title={t('avgStudentsPerClass')}
                value={stats?.avgStudentsPerClass?.toFixed(1) || '0'}
                icon={<IconCalendar size={20} />}
                color="violet"
                loading={statsLoading}
              />
            </Grid.Col>
          </Grid>
        )}

        {/* Filters */}
        <Paper p="md" withBorder>
          <Group>
            <TextInput
              placeholder="Search classes..."
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
              placeholder="Filter by level"
              data={[
                { value: '', label: 'All Levels' },
                { value: 'A1', label: 'A1' },
                { value: 'A2', label: 'A2' },
                { value: 'B1', label: 'B1' },
                { value: 'B2', label: 'B2' },
                { value: 'C1', label: 'C1' },
                { value: 'C2', label: 'C2' },
              ]}
              value={levelFilter}
              onChange={(value) => setLevelFilter(value || '')}
              clearable
            />
            <Select
              placeholder="Filter by teacher"
              data={
                teachersData?.teachers.map((teacher) => ({
                  value: teacher.id,
                  label: `${teacher.firstName} ${teacher.lastName}`,
                })) || []
              }
              value={teacherFilter}
              onChange={(value) => setTeacherFilter(value || '')}
              clearable
            />
          </Group>
        </Paper>

        {/* Classes Table */}
        <Paper withBorder>
          <LoadingOverlay visible={classesLoading} />
          
          {classesError ? (
            <Alert color="red" m="md">
              {t('loadError')}: {classesError.message}
            </Alert>
          ) : (
            <>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>{t('class')}</Table.Th>
                    <Table.Th>{t('teacher')}</Table.Th>
                    <Table.Th>{t('course')}</Table.Th>
                    <Table.Th>{t('level')}</Table.Th>
                    <Table.Th>{t('students')}</Table.Th>
                    <Table.Th>{t('capacity')}</Table.Th>
                    <Table.Th>{t('status')}</Table.Th>
                    <Table.Th>{t('startDate')}</Table.Th>
                    <Table.Th>{t('actions')}</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {classesData?.classes.map((classItem) => {
                    const studentCount = classItem._count?.students || 0;
                    const capacityUsage = getCapacityUsage(studentCount, classItem.maxStudents);
                    
                    return (
                      <Table.Tr key={classItem.id}>
                        <Table.Td>
                          <div>
                            <Text size="sm" fw={500}>
                              {classItem.name}
                            </Text>
                            {classItem.schedule && (
                              <Text size="xs" c="dimmed">
                                {classItem.schedule}
                              </Text>
                            )}
                          </div>
                        </Table.Td>
                        <Table.Td>
                          <Group>
                            <Avatar size="sm" color="blue">
                              {classItem.teacher?.firstName?.[0]}{classItem.teacher?.lastName?.[0]}
                            </Avatar>
                            <div>
                              <Text size="sm">
                                {classItem.teacher?.firstName} {classItem.teacher?.lastName}
                              </Text>
                            </div>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{classItem.course?.name}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="outline" size="sm">
                            {classItem.course?.level || t('noLevel')}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{studentCount}</Text>
                        </Table.Td>
                        <Table.Td>
                          <div>
                            <Group gap="xs">
                              <Text size="sm">{classItem.maxStudents}</Text>
                              <Progress
                                value={capacityUsage}
                                color={getCapacityColor(capacityUsage)}
                                size="sm"
                                w={50}
                              />
                            </Group>
                            <Text size="xs" c="dimmed">
                              {capacityUsage.toFixed(0)}% full
                            </Text>
                          </div>
                        </Table.Td>
                        <Table.Td>
                          <Badge color={getStatusColor(classItem.isActive ? 'ACTIVE' : 'INACTIVE')} size="sm">
                            {classItem.isActive ? t('active') : t('inactive')}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">
                            {new Date(classItem.startDate).toLocaleDateString()}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap="xs">
                            <Tooltip label="Edit">
                              <ActionIcon
                                variant="subtle"
                                onClick={() => handleEdit(classItem)}
                              >
                                <IconEdit size={16} />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Delete">
                              <ActionIcon
                                variant="subtle"
                                color="red"
                                onClick={() => handleDelete(classItem.id, classItem.name)}
                                loading={deleteClassMutation.isPending}
                              >
                                <IconTrash size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>

              {/* Pagination */}
              {classesData?.pagination && classesData.pagination.totalPages > 1 && (
                <Group justify="center" p="md">
                  <Pagination
                    value={page}
                    onChange={setPage}
                    total={classesData.pagination.totalPages}
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
          title={editingClass ? 'Edit Class' : 'Add New Class'}
          size="lg"
        >
          <form onSubmit={handleSubmit}>
            <Stack>
              <Group grow>
                <TextInput
                  label="Class Name"
                  placeholder="Enter class name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
                <Select
                  label="Level"
                  placeholder="Select level"
                  data={[
                    { value: 'A1', label: 'A1 - Beginner' },
                    { value: 'A2', label: 'A2 - Elementary' },
                    { value: 'B1', label: 'B1 - Intermediate' },
                    { value: 'B2', label: 'B2 - Upper Intermediate' },
                    { value: 'C1', label: 'C1 - Advanced' },
                    { value: 'C2', label: 'C2 - Proficient' },
                  ]}
                  value={formData.level}
                  onChange={(value) =>
                    setFormData({ ...formData, level: value || '' })
                  }
                  required
                />
              </Group>

              <Group grow>
                <Select
                  label="Teacher"
                  placeholder="Select teacher"
                  data={
                    teachersData?.teachers.map((teacher) => ({
                      value: teacher.id,
                      label: `${teacher.firstName} ${teacher.lastName}`,
                    })) || []
                  }
                  value={formData.teacherId}
                  onChange={(value) =>
                    setFormData({ ...formData, teacherId: value || '' })
                  }
                  required
                />
                <Select
                  label="Course"
                  placeholder="Select course"
                  data={
                    coursesData?.courses.map((course) => ({
                      value: course.id,
                      label: course.name,
                    })) || []
                  }
                  value={formData.courseId}
                  onChange={(value) =>
                    setFormData({ ...formData, courseId: value || '' })
                  }
                  required
                />
              </Group>

              <Textarea
                label="Description"
                placeholder="Enter class description..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />

              <Group grow>
                <TextInput
                  label="Schedule"
                  placeholder="e.g., Mon/Wed/Fri 10:00-12:00"
                  value={formData.schedule}
                  onChange={(e) =>
                    setFormData({ ...formData, schedule: e.target.value })
                  }
                />
                <NumberInput
                  label="Capacity"
                  placeholder="Enter max students"
                  value={formData.capacity}
                  onChange={(value) =>
                    setFormData({ ...formData, capacity: Number(value) || 10 })
                  }
                  min={1}
                  max={50}
                />
              </Group>

              <Group grow>
                <TextInput
                  label="Start Date"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  required
                />
                <TextInput
                  label="End Date"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                />
              </Group>

              <Select
                label="Status"
                data={[
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'INACTIVE', label: 'Inactive' },
                  { value: 'SUSPENDED', label: 'Suspended' },
                ]}
                value={formData.status}
                onChange={(value) =>
                  setFormData({ ...formData, status: value as any })
                }
                required
              />

              <Group justify="flex-end" mt="md">
                <Button
                  variant="subtle"
                  onClick={() => {
                    setModalOpened(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={
                    createClassMutation.isPending || 
                    updateClassMutation.isPending
                  }
                >
                  {editingClass ? 'Update Class' : 'Create Class'}
                </Button>
              </Group>
            </Stack>
          </form>
        </Modal>
      </Stack>
    </Container>
  );
}
