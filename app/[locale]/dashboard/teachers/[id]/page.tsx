'use client';

import { useState } from 'react';
import {
  Container,
  Title,
  Grid,
  Card,
  Text,
  Tabs,
  Badge,
  Button,
  Group,
  Stack,
  Avatar,
  ActionIcon,
  Menu,
  Modal,
  LoadingOverlay,
  Alert,
  Table,
} from '@mantine/core';
import {
  IconUser,
  IconCalendar,
  IconCurrency,
  IconBooks,
  IconPhone,
  IconMail,
  IconEdit,
  IconTrash,
  IconDotsVertical,
  IconChartBar,
  IconUsers,
  IconClock,
  IconAlertCircle,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { DataTable } from '@/components/tables/DataTable';
import { StatsCard } from '@/components/cards/StatsCard';
import { useTeacherById } from '@/lib/hooks/useTeachers';

export default function TeacherDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const teacherId = params.id as string;

  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);

  const {
    data: teacher,
    isLoading,
    error,
    refetch,
  } = useTeacherById(teacherId);

  const handleEdit = () => {
    router.push(`/dashboard/teachers/edit/${teacherId}`);
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/teachers/${teacherId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete teacher');
      }

      notifications.show({
        title: t('success'),
        message: t('teacherDetail.deleted'),
        color: 'green',
      });

      router.push('/dashboard/teachers');
    } catch (error) {
      notifications.show({
        title: t('error'),
        message: t('teacherDetail.deleteError'),
        color: 'red',
      });
    } finally {
      closeDeleteModal();
    }
  };

  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <LoadingOverlay visible />
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" py="xl">
        <Alert icon={<IconAlertCircle size="1rem" />} title={t('error')} color="red">
          {t('teacherDetail.loadError')}
        </Alert>
      </Container>
    );
  }

  if (!teacher) {
    return (
      <Container size="xl" py="xl">
        <Alert icon={<IconAlertCircle size="1rem" />} title={t('notFound')} color="yellow">
          {t('teacherDetail.notFound')}
        </Alert>
      </Container>
    );
  }

  // Calculate stats
  const totalClasses = teacher.classes?.length || 0;
  const totalStudents = teacher.classes?.reduce((acc: number, cls: any) => acc + (cls._count?.students || 0), 0) || 0;
  const totalLessons = teacher.lessons?.length || 0;
  const completedLessons = teacher.lessons?.filter((lesson: any) => lesson.status === 'COMPLETED').length || 0;

  return (
    <Container size="xl" py="xl">
      {/* Header */}
      <Group justify="space-between" mb="xl">
        <Group>
          <Avatar
            size="xl"
            src={teacher.avatar}
            alt={`${teacher.firstName} ${teacher.lastName}`}
          >
            <IconUser size="2rem" />
          </Avatar>
          <div>
            <Title order={2}>
              {teacher.firstName} {teacher.lastName}
            </Title>
            <Group gap="xs" mt={4}>
              <Badge color="blue" variant="light">
                {t(`role.${teacher.role?.toLowerCase()}`)}
              </Badge>
              <Badge 
                color={teacher.status === 'ACTIVE' ? 'green' : 'red'}
                variant="light"
              >
                {t(`status.${teacher.status?.toLowerCase()}`)}
              </Badge>
            </Group>
          </div>
        </Group>

        <Menu shadow="md" width={200}>
          <Menu.Target>
            <ActionIcon variant="subtle" size="lg">
              <IconDotsVertical size="1.2rem" />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconEdit size="1rem" />} onClick={handleEdit}>
              {t('edit')}
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item 
              leftSection={<IconTrash size="1rem" />} 
              color="red"
              onClick={openDeleteModal}
            >
              {t('delete')}
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>

      {/* Stats Cards */}
      <Grid mb="xl">
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <StatsCard
            title={t('classes.total')}
            value={totalClasses}
            icon={<IconBooks size="1.5rem" />}
            color="blue"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <StatsCard
            title={t('students.total')}
            value={totalStudents}
            icon={<IconUsers size="1.5rem" />}
            color="green"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <StatsCard
            title={t('lessons.completed')}
            value={completedLessons}
            icon={<IconClock size="1.5rem" />}
            color="orange"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <StatsCard
            title={t('lessons.total')}
            value={totalLessons}
            icon={<IconCalendar size="1.5rem" />}
            color="purple"
          />
        </Grid.Col>
      </Grid>

      {/* Main Content */}
      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconUser size="0.8rem" />}>
            {t('overview')}
          </Tabs.Tab>
          <Tabs.Tab value="classes" leftSection={<IconBooks size="0.8rem" />}>
            {t('classes')} ({totalClasses})
          </Tabs.Tab>
          <Tabs.Tab value="lessons" leftSection={<IconCalendar size="0.8rem" />}>
            {t('lessons')} ({totalLessons})
          </Tabs.Tab>
          <Tabs.Tab value="performance" leftSection={<IconChartBar size="0.8rem" />}>
            {t('performance')}
          </Tabs.Tab>
        </Tabs.List>

        {/* Overview Tab */}
        <Tabs.Panel value="overview">
          <Grid>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card withBorder>
                <Stack gap="md">
                  <Title order={4}>{t('contactInfo')}</Title>
                  
                  <Group>
                    <IconMail size="1rem" />
                    <Text size="sm">{teacher.email}</Text>
                  </Group>

                  {teacher.phone && (
                    <Group>
                      <IconPhone size="1rem" />
                      <Text size="sm">{teacher.phone}</Text>
                    </Group>
                  )}

                  {teacher.address && (
                    <div>
                      <Text fw={500} size="sm" mb={4}>{t('address')}</Text>
                      <Text size="sm" c="dimmed">{teacher.address}</Text>
                    </div>
                  )}
                </Stack>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card withBorder>
                <Stack gap="md">
                  <Title order={4}>{t('teacherInfo')}</Title>
                  
                  <div>
                    <Text fw={500} size="sm">{t('specializations')}</Text>
                    <Group gap="xs" mt={4}>
                      {teacher.specializations?.split(',').map((spec: string, index: number) => (
                        <Badge key={index} variant="light" color="blue">
                          {spec.trim()}
                        </Badge>
                      )) || <Text size="sm" c="dimmed">{t('noSpecializations')}</Text>}
                    </Group>
                  </div>

                  {teacher.experience && (
                    <div>
                      <Text fw={500} size="sm">{t('experience')}</Text>
                      <Text size="sm" c="dimmed">{teacher.experience} {t('years')}</Text>
                    </div>
                  )}

                  <div>
                    <Text fw={500} size="sm">{t('joinedDate')}</Text>
                    <Text size="sm" c="dimmed">
                      {new Date(teacher.createdAt).toLocaleDateString()}
                    </Text>
                  </div>
                </Stack>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card withBorder>
                <Stack gap="md">
                  <Title order={4}>{t('quickStats')}</Title>
                  
                  <div>
                    <Text fw={500} size="sm">{t('activeClasses')}</Text>
                    <Text size="sm" c="dimmed">
                      {teacher.classes?.filter((cls: any) => cls.status === 'ACTIVE').length || 0}
                    </Text>
                  </div>

                  <div>
                    <Text fw={500} size="sm">{t('thisWeekLessons')}</Text>
                    <Text size="sm" c="dimmed">
                      {teacher.lessons?.filter((lesson: any) => {
                        const lessonDate = new Date(lesson.date);
                        const now = new Date();
                        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
                        return lessonDate >= weekStart && lesson.status !== 'CANCELLED';
                      }).length || 0}
                    </Text>
                  </div>

                  <div>
                    <Text fw={500} size="sm">{t('lastActivity')}</Text>
                    <Text size="sm" c="dimmed">
                      {teacher.updatedAt ? 
                        new Date(teacher.updatedAt).toLocaleDateString() : 
                        t('noActivity')
                      }
                    </Text>
                  </div>
                </Stack>
              </Card>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        {/* Classes Tab */}
        <Tabs.Panel value="classes">
          <Card withBorder>
            <Group justify="space-between" mb="md">
              <Title order={4}>{t('assignedClasses')}</Title>
              <Button
                size="sm"
                onClick={() => router.push('/dashboard/classes/new')}
              >
                {t('addClass')}
              </Button>
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('class.name')}</Table.Th>
                  <Table.Th>{t('course')}</Table.Th>
                  <Table.Th>{t('students.count')}</Table.Th>
                  <Table.Th>{t('schedule')}</Table.Th>
                  <Table.Th>{t('status')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {teacher.classes?.map((cls) => (
                  <Table.Tr 
                    key={cls.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/dashboard/classes/${cls.id}`)}
                  >
                    <Table.Td>{cls.name}</Table.Td>
                    <Table.Td>{cls.course.name}</Table.Td>
                    <Table.Td>
                      <Badge variant="light" color="blue">
                        {cls._count?.students || 0}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{cls.schedule || t('noSchedule')}</Table.Td>
                    <Table.Td>
                      <Badge 
                        color={cls.status === 'ACTIVE' ? 'green' : 'gray'}
                      >
                        {t(`status.${cls.status?.toLowerCase()}`)}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        </Tabs.Panel>

        {/* Lessons Tab */}
        <Tabs.Panel value="lessons">
          <Card withBorder>
            <Group justify="space-between" mb="md">
              <Title order={4}>{t('recentLessons')}</Title>
              <Button
                size="sm"
                onClick={() => router.push('/dashboard/lessons/new')}
              >
                {t('addLesson')}
              </Button>
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('date')}</Table.Th>
                  <Table.Th>{t('class')}</Table.Th>
                  <Table.Th>{t('topic')}</Table.Th>
                  <Table.Th>{t('duration')}</Table.Th>
                  <Table.Th>{t('status')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {teacher.lessons?.slice(0, 10).map((lesson) => (
                  <Table.Tr 
                    key={lesson.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/dashboard/lessons/${lesson.id}`)}
                  >
                    <Table.Td>{new Date(lesson.date).toLocaleDateString()}</Table.Td>
                    <Table.Td>{lesson.class.name}</Table.Td>
                    <Table.Td>{lesson.topic || '-'}</Table.Td>
                    <Table.Td>{lesson.duration ? `${lesson.duration} ${t('minutes')}` : '-'}</Table.Td>
                    <Table.Td>
                      <Badge 
                        color={
                          lesson.status === 'COMPLETED' ? 'green' : 
                          lesson.status === 'CANCELLED' ? 'red' : 
                          'blue'
                        }
                      >
                        {t(`lessonStatus.${lesson.status?.toLowerCase()}`)}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        </Tabs.Panel>

        {/* Performance Tab */}
        <Tabs.Panel value="performance">
          <Grid>
            <Grid.Col span={12}>
              <Card withBorder>
                <Title order={4} mb="md">{t('performanceMetrics')}</Title>
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Text fw={500}>{t('completionRate')}</Text>
                    <Text size="lg" c="blue">
                      {totalLessons > 0 ? 
                        `${Math.round((completedLessons / totalLessons) * 100)}%` : 
                        '0%'
                      }
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Text fw={500}>{t('averageStudentsPerClass')}</Text>
                    <Text size="lg" c="green">
                      {totalClasses > 0 ? 
                        Math.round(totalStudents / totalClasses) : 
                        0
                      }
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Text fw={500}>{t('lessonsThisMonth')}</Text>
                    <Text size="lg" c="orange">
                      {teacher.lessons?.filter((lesson: any) => {
                        const lessonDate = new Date(lesson.date);
                        const now = new Date();
                        return lessonDate.getMonth() === now.getMonth() && 
                               lessonDate.getFullYear() === now.getFullYear();
                      }).length || 0}
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Text fw={500}>{t('averageClassSize')}</Text>
                    <Text size="lg" c="purple">
                      {totalClasses > 0 ? 
                        Math.round(totalStudents / totalClasses) : 
                        0
                      } {t('students')}
                    </Text>
                  </Grid.Col>
                </Grid>
              </Card>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>
      </Tabs>

      {/* Delete Confirmation Modal */}
      <Modal
        opened={deleteModalOpened}
        onClose={closeDeleteModal}
        title={t('confirmDelete')}
        centered
      >
        <Text mb="md">
          {t('teacherDetail.deleteConfirmation', { 
            name: `${teacher.firstName} ${teacher.lastName}` 
          })}
        </Text>
        <Group justify="flex-end">
          <Button variant="outline" onClick={closeDeleteModal}>
            {t('cancel')}
          </Button>
          <Button color="red" onClick={handleDelete}>
            {t('delete')}
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
