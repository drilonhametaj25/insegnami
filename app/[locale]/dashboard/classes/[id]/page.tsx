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
  ActionIcon,
  Menu,
  Modal,
  LoadingOverlay,
  Alert,
  Table,
  Progress,
} from '@mantine/core';
import {
  IconUsers,
  IconCalendar,
  IconCurrency,
  IconBooks,
  IconPhone,
  IconMail,
  IconEdit,
  IconTrash,
  IconDotsVertical,
  IconChartBar,
  IconClock,
  IconAlertCircle,
  IconUser,
  IconSchool,
  IconMapPin,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { StatsCard } from '@/components/cards/StatsCard';
import { useClassById } from '@/lib/hooks/useClasses';

export default function ClassDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const classId = params.id as string;

  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);

  const {
    data: classData,
    isLoading,
    error,
    refetch,
  } = useClassById(classId);

  const handleEdit = () => {
    router.push(`/dashboard/classes/edit/${classId}`);
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/classes/${classId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete class');
      }

      notifications.show({
        title: t('success'),
        message: t('classDetail.deleted'),
        color: 'green',
      });

      router.push('/dashboard/classes');
    } catch (error) {
      notifications.show({
        title: t('error'),
        message: t('classDetail.deleteError'),
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
          {t('classDetail.loadError')}
        </Alert>
      </Container>
    );
  }

  if (!classData) {
    return (
      <Container size="xl" py="xl">
        <Alert icon={<IconAlertCircle size="1rem" />} title={t('notFound')} color="yellow">
          {t('classDetail.notFound')}
        </Alert>
      </Container>
    );
  }

  // Calculate stats
  const totalStudents = classData.students?.length || 0;
  const maxStudents = classData.maxStudents || 0;
  const totalLessons = classData.lessons?.length || 0;
  const completedLessons = classData.lessons?.filter((lesson: any) => lesson.status === 'COMPLETED').length || 0;
  const occupancyRate = maxStudents > 0 ? Math.round((totalStudents / maxStudents) * 100) : 0;

  return (
    <Container size="xl" py="xl">
      {/* Header */}
      <Group justify="space-between" mb="xl">
        <div>
          <Group align="center" gap="md">
            <IconSchool size="2rem" color="var(--mantine-color-blue-6)" />
            <div>
              <Title order={2}>{classData.name}</Title>
              <Group gap="xs" mt={4}>
                <Badge color="blue" variant="light">
                  {classData.code}
                </Badge>
                <Badge 
                  color={classData.isActive ? 'green' : 'red'}
                  variant="light"
                >
                  {classData.isActive ? t('status.active') : t('status.inactive')}
                </Badge>
              </Group>
            </div>
          </Group>
        </div>

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
            title={t('students.enrolled')}
            value={`${totalStudents}/${maxStudents}`}
            icon={<IconUsers size="1.5rem" />}
            color="blue"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <StatsCard
            title={t('lessons.total')}
            value={totalLessons}
            icon={<IconCalendar size="1.5rem" />}
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
            title={t('occupancy')}
            value={`${occupancyRate}%`}
            icon={<IconChartBar size="1.5rem" />}
            color="purple"
          />
        </Grid.Col>
      </Grid>

      {/* Main Content */}
      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconBooks size="0.8rem" />}>
            {t('overview')}
          </Tabs.Tab>
          <Tabs.Tab value="students" leftSection={<IconUsers size="0.8rem" />}>
            {t('students')} ({totalStudents})
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
                  <Title order={4}>{t('classInfo')}</Title>
                  
                  <div>
                    <Text fw={500} size="sm">{t('course')}</Text>
                    <Text size="sm" c="dimmed">{classData.course?.name || t('noCourse')}</Text>
                  </div>

                  <div>
                    <Text fw={500} size="sm">{t('teacher')}</Text>
                    <Group gap="xs">
                      <IconUser size="1rem" />
                      <Text 
                        size="sm" 
                        c="dimmed"
                        style={{ cursor: 'pointer' }}
                        onClick={() => router.push(`/dashboard/teachers/${classData.teacherId}`)}
                      >
                        {classData.teacher ? 
                          `${classData.teacher.firstName} ${classData.teacher.lastName}` : 
                          t('noTeacher')
                        }
                      </Text>
                    </Group>
                  </div>

                  <div>
                    <Text fw={500} size="sm">{t('schedule')}</Text>
                    <Group gap="xs">
                      <IconCalendar size="1rem" />
                      <div>
                        <Text size="sm" c="dimmed">
                          {t('startDate')}: {new Date(classData.startDate).toLocaleDateString()}
                        </Text>
                        {classData.endDate && (
                          <Text size="sm" c="dimmed">
                            {t('endDate')}: {new Date(classData.endDate).toLocaleDateString()}
                          </Text>
                        )}
                      </div>
                    </Group>
                  </div>
                </Stack>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card withBorder>
                <Stack gap="md">
                  <Title order={4}>{t('capacity')}</Title>
                  
                  <div>
                    <Group justify="space-between" mb={4}>
                      <Text size="sm">{t('enrolled')}</Text>
                      <Text size="sm">{totalStudents}/{maxStudents}</Text>
                    </Group>
                    <Progress 
                      value={occupancyRate} 
                      color={occupancyRate > 90 ? 'red' : occupancyRate > 70 ? 'yellow' : 'green'}
                      size="lg"
                    />
                    <Text size="xs" c="dimmed" mt={4}>
                      {occupancyRate}% {t('occupied')}
                    </Text>
                  </div>

                  <div>
                    <Text fw={500} size="sm">{t('availableSpots')}</Text>
                    <Text size="sm" c="dimmed">{maxStudents - totalStudents} {t('spots')}</Text>
                  </div>

                  <div>
                    <Text fw={500} size="sm">{t('classStatus')}</Text>
                    <Badge 
                      color={classData.isActive ? 'green' : 'red'}
                      variant="light"
                    >
                      {classData.isActive ? t('active') : t('inactive')}
                    </Badge>
                  </div>
                </Stack>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card withBorder>
                <Stack gap="md">
                  <Title order={4}>{t('recentActivity')}</Title>
                  
                  <div>
                    <Text fw={500} size="sm">{t('lastLesson')}</Text>
                    <Text size="sm" c="dimmed">
                      {(classData.lessons && classData.lessons.length > 0) ? 
                        new Date(classData.lessons[0].startTime).toLocaleDateString() : 
                        t('noLessons')
                      }
                    </Text>
                  </div>

                  <div>
                    <Text fw={500} size="sm">{t('nextLesson')}</Text>
                    <Text size="sm" c="dimmed">
                      {(() => {
                        const scheduledLesson = classData.lessons?.find((lesson: any) => lesson.status === 'SCHEDULED');
                        return scheduledLesson ? 
                          new Date(scheduledLesson.startTime).toLocaleDateString() :
                          t('noScheduledLessons');
                      })()}
                    </Text>
                  </div>

                  <div>
                    <Text fw={500} size="sm">{t('createdDate')}</Text>
                    <Text size="sm" c="dimmed">
                      {new Date(classData.createdAt).toLocaleDateString()}
                    </Text>
                  </div>
                </Stack>
              </Card>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        {/* Students Tab */}
        <Tabs.Panel value="students">
          <Card withBorder>
            <Group justify="space-between" mb="md">
              <Title order={4}>{t('enrolledStudents')}</Title>
              <Button
                size="sm"
                onClick={() => router.push(`/dashboard/classes/${classId}/enroll`)}
              >
                {t('enrollStudent')}
              </Button>
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('student.name')}</Table.Th>
                  <Table.Th>{t('email')}</Table.Th>
                  <Table.Th>{t('enrolledDate')}</Table.Th>
                  <Table.Th>{t('status')}</Table.Th>
                  <Table.Th>{t('actions')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {classData.students?.map((enrollment: any) => (
                  <Table.Tr key={enrollment.id}>
                    <Table.Td>
                      <Text 
                        style={{ cursor: 'pointer' }}
                        c="blue"
                        onClick={() => router.push(`/dashboard/students/${enrollment.student.id}`)}
                      >
                        {enrollment.student.firstName} {enrollment.student.lastName}
                      </Text>
                    </Table.Td>
                    <Table.Td>{enrollment.student.email}</Table.Td>
                    <Table.Td>{new Date(enrollment.enrolledAt).toLocaleDateString()}</Table.Td>
                    <Table.Td>
                      <Badge 
                        color={enrollment.isActive ? 'green' : 'red'}
                      >
                        {enrollment.isActive ? t('active') : t('inactive')}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => {/* TODO: Implement unenroll */}}
                      >
                        <IconTrash size="1rem" />
                      </ActionIcon>
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
              <Title order={4}>{t('classLessons')}</Title>
              <Button
                size="sm"
                onClick={() => router.push(`/dashboard/lessons/new?classId=${classId}`)}
              >
                {t('addLesson')}
              </Button>
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('date')}</Table.Th>
                  <Table.Th>{t('topic')}</Table.Th>
                  <Table.Th>{t('time')}</Table.Th>
                  <Table.Th>{t('duration')}</Table.Th>
                  <Table.Th>{t('status')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {classData.lessons?.map((lesson: any) => (
                  <Table.Tr 
                    key={lesson.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/dashboard/lessons/${lesson.id}`)}
                  >
                    <Table.Td>{new Date(lesson.startTime).toLocaleDateString()}</Table.Td>
                    <Table.Td>{lesson.title || '-'}</Table.Td>
                    <Table.Td>
                      {new Date(lesson.startTime).toLocaleTimeString()} - {' '}
                      {new Date(lesson.endTime).toLocaleTimeString()}
                    </Table.Td>
                    <Table.Td>
                      {Math.round((new Date(lesson.endTime).getTime() - new Date(lesson.startTime).getTime()) / (1000 * 60))} {t('minutes')}
                    </Table.Td>
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
                <Title order={4} mb="md">{t('classPerformance')}</Title>
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
                    <Text fw={500}>{t('occupancyRate')}</Text>
                    <Text size="lg" c="green">
                      {occupancyRate}%
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Text fw={500}>{t('lessonsThisMonth')}</Text>
                    <Text size="lg" c="orange">
                      {classData.lessons?.filter((lesson: any) => {
                        const lessonDate = new Date(lesson.startTime);
                        const now = new Date();
                        return lessonDate.getMonth() === now.getMonth() && 
                               lessonDate.getFullYear() === now.getFullYear();
                      }).length || 0}
                    </Text>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6 }}>
                    <Text fw={500}>{t('averageAttendance')}</Text>
                    <Text size="lg" c="purple">
                      85% {/* TODO: Calculate from actual attendance data */}
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
          {t('classDetail.deleteConfirmation', { 
            name: classData.name
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
