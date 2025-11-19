'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Container,
  Title,
  Text,
  Paper,
  Tabs,
  Group,
  Badge,
  Button,
  Grid,
  Stack,
  LoadingOverlay,
  Alert,
  ActionIcon,
  Card,
  Table,
  Menu,
  Skeleton,
  ScrollArea,
  Divider,
  NumberFormatter,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconBook2,
  IconUsers,
  IconCalendarEvent,
  IconSchool,
  IconEdit,
  IconTrendingUp,
  IconX,
  IconInfoCircle,
  IconClock,
  IconChartBar,
  IconDotsVertical,
  IconTrash,
  IconCheck,
  IconCash,
  IconBriefcase,
  IconLanguage,
} from '@tabler/icons-react';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';
import { ModernModal } from '@/components/modals/ModernModal';
import { CourseForm } from '@/components/forms/CourseForm';

interface CourseDetail {
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
  classes: Array<{
    id: string;
    code: string;
    name: string;
    startDate: string;
    endDate?: string;
    isActive: boolean;
    teacher: {
      id: string;
      firstName: string;
      lastName: string;
    };
    studentCount: number;
  }>;
  classCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const { data: session } = useSession();
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');

  const [editModalOpened, { open: openEditModal, close: closeEditModal }] = useDisclosure(false);
  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [deleting, setDeleting] = useState(false);

  // Resolve params
  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  // Fetch course details
  useEffect(() => {
    if (!resolvedParams?.id) return;

    const fetchCourse = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/courses/${resolvedParams.id}`);
        
        if (!response.ok) {
          throw new Error(t('courses.loadError'));
        }

        const data = await response.json();
        setCourse(data.course);
      } catch (err) {
        console.error('Error fetching course:', err);
        setError(err instanceof Error ? err.message : t('common.error'));
      } finally {
        setLoading(false);
      }
    };

    fetchCourse();
  }, [resolvedParams, t]);

  const handleEdit = () => {
    openEditModal();
  };

  const handleEditSubmit = async (data: any) => {
    try {
      const response = await fetch(`/api/courses/${resolvedParams?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(t('courses.updateError'));
      }

      const result = await response.json();
      setCourse(result.course);
      closeEditModal();
      
      notifications.show({
        title: t('common.success'),
        message: t('courses.updated'),
        color: 'green',
        icon: <IconCheck size={18} />,
      });
    } catch (err) {
      console.error('Error updating course:', err);
      notifications.show({
        title: t('common.error'),
        message: err instanceof Error ? err.message : t('courses.updateError'),
        color: 'red',
        icon: <IconX size={18} />,
      });
    }
  };

  const handleDelete = async () => {
    if (!resolvedParams?.id) return;

    try {
      setDeleting(true);

      const response = await fetch(`/api/courses/${resolvedParams.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(t('courses.deleteError'));
      }

      notifications.show({
        title: t('common.success'),
        message: t('courses.deleted'),
        color: 'green',
        icon: <IconCheck size={18} />,
      });

      router.push(`/${locale}/dashboard/courses`);
    } catch (err) {
      console.error('Error deleting course:', err);
      notifications.show({
        title: t('common.error'),
        message: err instanceof Error ? err.message : t('courses.deleteError'),
        color: 'red',
        icon: <IconX size={18} />,
      });
    } finally {
      setDeleting(false);
      closeDeleteModal();
    }
  };

  const handleToggleStatus = async () => {
    if (!course || !resolvedParams?.id) return;

    try {
      const response = await fetch(`/api/courses/${resolvedParams.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...course,
          isActive: !course.isActive,
        }),
      });

      if (!response.ok) {
        throw new Error(t('courses.updateError'));
      }

      const result = await response.json();
      setCourse(result.course);

      notifications.show({
        title: t('common.success'),
        message: t('courses.statusUpdated'),
        color: 'green',
        icon: <IconCheck size={18} />,
      });
    } catch (err) {
      console.error('Error toggling status:', err);
      notifications.show({
        title: t('common.error'),
        message: err instanceof Error ? err.message : t('courses.updateError'),
        color: 'red',
        icon: <IconX size={18} />,
      });
    }
  };

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <LoadingOverlay visible />
      </Container>
    );
  }

  if (error || !course) {
    return (
      <Container size="xl" py="xl">
        <Alert icon={<IconInfoCircle size={16} />} title={t('common.error')} color="red">
          {error || t('courses.notFound')}
        </Alert>
        <Button
          leftSection={<IconArrowLeft size={16} />}
          variant="light"
          onClick={() => router.push(`/${locale}/dashboard/courses`)}
          mt="md"
        >
          {t('common.back')}
        </Button>
      </Container>
    );
  }

  const activeClasses = course.classes?.filter(c => c.isActive).length || 0;
  const totalStudents = course.classes?.reduce((sum, c) => sum + (c.studentCount || 0), 0) || 0;

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <ActionIcon
              variant="light"
              size="lg"
              onClick={() => router.push(`/${locale}/dashboard/courses`)}
            >
              <IconArrowLeft size={20} />
            </ActionIcon>
            <div>
              <Title order={2}>{course.name}</Title>
              <Text size="sm" c="dimmed">{course.code}</Text>
            </div>
          </Group>

          <Group>
            <Badge
              color={course.isActive ? 'green' : 'red'}
              variant="light"
              size="lg"
            >
              {course.isActive ? t('common.active') : t('common.inactive')}
            </Badge>

            <Menu shadow="md" width={200}>
              <Menu.Target>
                <ActionIcon variant="light" size="lg">
                  <IconDotsVertical size={20} />
                </ActionIcon>
              </Menu.Target>

              <Menu.Dropdown>
                <Menu.Item
                  leftSection={<IconEdit size={16} />}
                  onClick={handleEdit}
                >
                  {t('common.edit')}
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconCheck size={16} />}
                  onClick={handleToggleStatus}
                >
                  {course.isActive ? t('common.deactivate') : t('common.activate')}
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item
                  leftSection={<IconTrash size={16} />}
                  color="red"
                  onClick={openDeleteModal}
                >
                  {t('common.delete')}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        {/* Stats Cards */}
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <ModernStatsCard
              title={t('courses.stats.totalClasses')}
              value={String(course.classCount || 0)}
              icon={<IconSchool size={24} />}
              gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <ModernStatsCard
              title={t('courses.stats.activeClasses')}
              value={String(activeClasses)}
              icon={<IconCheck size={24} />}
              gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <ModernStatsCard
              title={t('courses.stats.totalStudents')}
              value={String(totalStudents)}
              icon={<IconUsers size={24} />}
              gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <ModernStatsCard
              title={t('courses.price')}
              value={`€${course.price ? Number(course.price).toFixed(0) : '0'}`}
              icon={<IconCash size={24} />}
              gradient="linear-gradient(135deg, #fa709a 0%, #fee140 100%)"
            />
          </Grid.Col>
        </Grid>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'overview')}>
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconInfoCircle size={16} />}>
              {t('common.overview')}
            </Tabs.Tab>
            <Tabs.Tab value="classes" leftSection={<IconSchool size={16} />}>
              {t('courses.classes')} ({course.classCount || 0})
            </Tabs.Tab>
          </Tabs.List>

          {/* Overview Tab */}
          <Tabs.Panel value="overview" pt="xl">
            <Grid>
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Paper p="xl" withBorder>
                  <Stack gap="md">
                    <Title order={4}>{t('courses.details')}</Title>
                    <Divider />
                    
                    <Group justify="space-between">
                      <Text fw={500}>{t('courses.code')}:</Text>
                      <Text>{course.code}</Text>
                    </Group>

                    <Group justify="space-between">
                      <Text fw={500}>{t('courses.category')}:</Text>
                      <Badge variant="light" color="blue">
                        {course.category}
                      </Badge>
                    </Group>

                    <Group justify="space-between">
                      <Text fw={500}>{t('courses.level')}:</Text>
                      <Badge variant="light" color="violet">
                        {course.level}
                      </Badge>
                    </Group>

                    {course.duration && (
                      <Group justify="space-between">
                        <Text fw={500}>{t('courses.duration')}:</Text>
                        <Text>{course.duration} {t('courses.hours')}</Text>
                      </Group>
                    )}

                    {course.price && (
                      <Group justify="space-between">
                        <Text fw={500}>{t('courses.price')}:</Text>
                        <Text fw={600}>€{Number(course.price).toFixed(2)}</Text>
                      </Group>
                    )}

                    {course.description && (
                      <>
                        <Divider />
                        <div>
                          <Text fw={500} mb="xs">{t('courses.description')}:</Text>
                          <Text size="sm" c="dimmed">{course.description}</Text>
                        </div>
                      </>
                    )}
                  </Stack>
                </Paper>
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 6 }}>
                <Paper p="xl" withBorder>
                  <Stack gap="md">
                    <Title order={4}>{t('courses.capacity')}</Title>
                    <Divider />

                    {course.minStudents && (
                      <Group justify="space-between">
                        <Text fw={500}>{t('courses.minStudents')}:</Text>
                        <Text>{course.minStudents}</Text>
                      </Group>
                    )}

                    {course.maxStudents && (
                      <Group justify="space-between">
                        <Text fw={500}>{t('courses.maxStudents')}:</Text>
                        <Text>{course.maxStudents}</Text>
                      </Group>
                    )}

                    <Divider />

                    <Group justify="space-between">
                      <Text fw={500}>{t('common.status')}:</Text>
                      <Badge color={course.isActive ? 'green' : 'red'} variant="light">
                        {course.isActive ? t('common.active') : t('common.inactive')}
                      </Badge>
                    </Group>

                    <Group justify="space-between">
                      <Text fw={500}>{t('common.createdAt')}:</Text>
                      <Text size="sm">
                        {new Date(course.createdAt).toLocaleDateString(locale)}
                      </Text>
                    </Group>

                    <Group justify="space-between">
                      <Text fw={500}>{t('common.updatedAt')}:</Text>
                      <Text size="sm">
                        {new Date(course.updatedAt).toLocaleDateString(locale)}
                      </Text>
                    </Group>
                  </Stack>
                </Paper>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>

          {/* Classes Tab */}
          <Tabs.Panel value="classes" pt="xl">
            <Paper p="xl" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Title order={4}>{t('courses.classes')}</Title>
                  <Button
                    leftSection={<IconSchool size={16} />}
                    onClick={() => router.push(`/${locale}/dashboard/classes/new?courseId=${course.id}`)}
                  >
                    {t('classes.new')}
                  </Button>
                </Group>

                {course.classes && course.classes.length > 0 ? (
                  <ScrollArea>
                    <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>{t('classes.code')}</Table.Th>
                          <Table.Th>{t('classes.name')}</Table.Th>
                          <Table.Th>{t('classes.teacher')}</Table.Th>
                          <Table.Th>{t('classes.students')}</Table.Th>
                          <Table.Th>{t('classes.startDate')}</Table.Th>
                          <Table.Th>{t('common.status')}</Table.Th>
                          <Table.Th>{t('common.actions')}</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {course.classes.map((classItem) => (
                          <Table.Tr key={classItem.id}>
                            <Table.Td>
                              <Text size="sm" fw={500}>{classItem.code}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">{classItem.name}</Text>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">
                                {classItem.teacher.firstName} {classItem.teacher.lastName}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge variant="light" color="blue">
                                {classItem.studentCount || 0}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm">
                                {new Date(classItem.startDate).toLocaleDateString(locale)}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                color={classItem.isActive ? 'green' : 'red'}
                                variant="light"
                                size="sm"
                              >
                                {classItem.isActive ? t('common.active') : t('common.inactive')}
                              </Badge>
                            </Table.Td>
                            <Table.Td>
                              <ActionIcon
                                variant="light"
                                color="blue"
                                onClick={() => router.push(`/${locale}/dashboard/classes/${classItem.id}`)}
                              >
                                <IconInfoCircle size={16} />
                              </ActionIcon>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <Alert icon={<IconInfoCircle size={16} />} color="gray">
                    {t('courses.noClasses')}
                  </Alert>
                )}
              </Stack>
            </Paper>
          </Tabs.Panel>
        </Tabs>
      </Stack>

      {/* Edit Modal */}
      <CourseForm
        opened={editModalOpened}
        onClose={closeEditModal}
        courseData={course}
        onSave={handleEditSubmit}
      />

      {/* Delete Confirmation Modal */}
      <ModernModal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title={t('courses.deleteConfirm')}
        size="sm"
      >
        <Stack gap="md">
          <Alert icon={<IconInfoCircle size={16} />} color="red">
            {t('courses.deleteWarning')}
          </Alert>
          <Group justify="flex-end">
            <Button variant="light" onClick={closeDeleteModal}>
              {t('common.cancel')}
            </Button>
            <Button color="red" onClick={handleDelete} loading={deleting}>
              {t('common.delete')}
            </Button>
          </Group>
        </Stack>
      </ModernModal>
    </Container>
  );
}
