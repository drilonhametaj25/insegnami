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
  Textarea,
  Select,
  NumberInput,
} from '@mantine/core';
import {
  IconCalendar,
  IconClock,
  IconUser,
  IconUsers,
  IconBook,
  IconEdit,
  IconTrash,
  IconDotsVertical,
  IconCheck,
  IconX,
  IconAlertCircle,
  IconFileText,
  IconHome,
  IconChartBar,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useRouter, useParams } from 'next/navigation';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { StatsCard } from '@/components/cards/StatsCard';
import { useLessonById } from '@/lib/hooks/useLessons';

export default function LessonDetailPage() {
  const t = useTranslations();
  const router = useRouter();
  const params = useParams();
  const lessonId = params.id as string;

  const [deleteModalOpened, { open: openDeleteModal, close: closeDeleteModal }] = useDisclosure(false);
  const [attendanceEditing, setAttendanceEditing] = useState(false);
  const [notes, setNotes] = useState('');
  const [homework, setHomework] = useState('');

  const {
    data: lesson,
    isLoading,
    error,
    refetch,
  } = useLessonById(lessonId);

  const handleEdit = () => {
    router.push(`/dashboard/lessons/edit/${lessonId}`);
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/lessons/${lessonId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete lesson');
      }

      notifications.show({
        title: t('success'),
        message: t('lesson.deleted'),
        color: 'green',
      });

      router.push('/dashboard/lessons');
    } catch (error) {
      notifications.show({
        title: t('error'),
        message: t('lesson.deleteError'),
        color: 'red',
      });
    } finally {
      closeDeleteModal();
    }
  };

  const handleAttendanceChange = async (studentId: string, status: string) => {
    try {
      const response = await fetch(`/api/lessons/${lessonId}/attendance`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId,
          status,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update attendance');
      }

      notifications.show({
        title: t('success'),
        message: t('attendance.updated'),
        color: 'green',
      });

      refetch();
    } catch (error) {
      notifications.show({
        title: t('error'),
        message: t('attendance.updateError'),
        color: 'red',
      });
    }
  };

  const handleSaveNotes = async () => {
    try {
      const response = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes,
          homework,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save lesson notes');
      }

      notifications.show({
        title: t('success'),
        message: t('lesson.notesSaved'),
        color: 'green',
      });

      refetch();
    } catch (error) {
      notifications.show({
        title: t('error'),
        message: t('lesson.saveError'),
        color: 'red',
      });
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
          {t('lesson.loadError')}
        </Alert>
      </Container>
    );
  }

  if (!lesson) {
    return (
      <Container size="xl" py="xl">
        <Alert icon={<IconAlertCircle size="1rem" />} title={t('notFound')} color="yellow">
          {t('lesson.notFound')}
        </Alert>
      </Container>
    );
  }

  // Calculate stats
  const totalStudents = lesson.class?.students?.length || 0;
  const presentStudents = lesson.attendance?.filter(att => att.status === 'PRESENT').length || 0;
  const absentStudents = lesson.attendance?.filter(att => att.status === 'ABSENT').length || 0;
  const attendanceRate = totalStudents > 0 ? Math.round((presentStudents / totalStudents) * 100) : 0;

  const duration = lesson.endTime && lesson.startTime
    ? Math.round((new Date(lesson.endTime).getTime() - new Date(lesson.startTime).getTime()) / (1000 * 60))
    : 0;

  return (
    <Container size="xl" py="xl">
      {/* Header */}
      <Group justify="space-between" mb="xl">
        <div>
          <Title order={2}>
            {lesson.title}
          </Title>
          <Group gap="xs" mt={4}>
            <Badge color="blue" variant="light">
              {lesson.class?.name}
            </Badge>
            <Badge 
              color={
                lesson.status === 'COMPLETED' ? 'green' : 
                lesson.status === 'CANCELLED' ? 'red' : 
                'orange'
              }
              variant="light"
            >
              {t(`lessonStatus.${lesson.status?.toLowerCase()}`)}
            </Badge>
            {lesson.isRecurring && (
              <Badge color="purple" variant="light">
                {t('recurring')}
              </Badge>
            )}
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
            title={t('attendance.total')}
            value={totalStudents}
            icon={<IconUsers size="1.5rem" />}
            color="blue"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <StatsCard
            title={t('attendance.present')}
            value={presentStudents}
            icon={<IconCheck size="1.5rem" />}
            color="green"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <StatsCard
            title={t('attendance.rate')}
            value={`${attendanceRate}%`}
            icon={<IconChartBar size="1.5rem" />}
            color="orange"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
          <StatsCard
            title={t('duration')}
            value={`${duration} min`}
            icon={<IconClock size="1.5rem" />}
            color="purple"
          />
        </Grid.Col>
      </Grid>

      {/* Main Content */}
      <Tabs defaultValue="overview">
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconBook size="0.8rem" />}>
            {t('overview')}
          </Tabs.Tab>
          <Tabs.Tab value="attendance" leftSection={<IconUsers size="0.8rem" />}>
            {t('attendance')} ({totalStudents})
          </Tabs.Tab>
          <Tabs.Tab value="content" leftSection={<IconFileText size="0.8rem" />}>
            {t('content')}
          </Tabs.Tab>
          <Tabs.Tab value="homework" leftSection={<IconHome size="0.8rem" />}>
            {t('homework')}
          </Tabs.Tab>
        </Tabs.List>

        {/* Overview Tab */}
        <Tabs.Panel value="overview">
          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Card withBorder>
                <Stack gap="md">
                  <Title order={4}>{t('lessonInfo')}</Title>
                  
                  <Group>
                    <IconCalendar size="1rem" />
                    <Text size="sm">
                      {new Date(lesson.startTime).toLocaleDateString()} - {new Date(lesson.startTime).toLocaleTimeString()}
                    </Text>
                  </Group>

                  <Group>
                    <IconClock size="1rem" />
                    <Text size="sm">{duration} {t('minutes')}</Text>
                  </Group>

                  {lesson.room && (
                    <Group>
                      <IconBook size="1rem" />
                      <Text size="sm">{lesson.room}</Text>
                    </Group>
                  )}

                  <Group>
                    <IconUser size="1rem" />
                    <Text size="sm">
                      {lesson.teacher?.firstName} {lesson.teacher?.lastName}
                    </Text>
                  </Group>
                </Stack>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <Card withBorder>
                <Stack gap="md">
                  <Title order={4}>{t('classInfo')}</Title>
                  
                  <div>
                    <Text fw={500} size="sm">{t('className')}</Text>
                    <Text size="sm" c="dimmed">{lesson.class?.name}</Text>
                  </div>

                  <div>
                    <Text fw={500} size="sm">{t('course')}</Text>
                    <Text size="sm" c="dimmed">{lesson.class?.course?.name}</Text>
                  </div>

                  <div>
                    <Text fw={500} size="sm">{t('totalStudents')}</Text>
                    <Text size="sm" c="dimmed">{totalStudents}</Text>
                  </div>

                  {lesson.description && (
                    <div>
                      <Text fw={500} size="sm">{t('description')}</Text>
                      <Text size="sm" c="dimmed">{lesson.description}</Text>
                    </div>
                  )}
                </Stack>
              </Card>
            </Grid.Col>
          </Grid>
        </Tabs.Panel>

        {/* Attendance Tab */}
        <Tabs.Panel value="attendance">
          <Card withBorder>
            <Group justify="space-between" mb="md">
              <Title order={4}>{t('attendanceTracking')}</Title>
              <Button
                size="sm"
                variant={attendanceEditing ? 'filled' : 'outline'}
                onClick={() => setAttendanceEditing(!attendanceEditing)}
              >
                {attendanceEditing ? t('save') : t('edit')}
              </Button>
            </Group>
            
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('student')}</Table.Th>
                  <Table.Th>{t('email')}</Table.Th>
                  <Table.Th>{t('status')}</Table.Th>
                  {attendanceEditing && <Table.Th>{t('actions')}</Table.Th>}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {lesson.class?.students?.map((student: any) => {
                  const attendance = lesson.attendance?.find((att: any) => att.studentId === student.id);
                  const status = attendance?.status || 'UNKNOWN';
                  
                  return (
                    <Table.Tr key={student.id}>
                      <Table.Td>
                        <Text fw={500}>
                          {student.firstName} {student.lastName}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">{student.email}</Text>
                      </Table.Td>
                      <Table.Td>
                        {attendanceEditing ? (
                          <Select
                            size="sm"
                            value={status}
                            onChange={(value) => value && handleAttendanceChange(student.id, value)}
                            data={[
                              { value: 'PRESENT', label: t('present') },
                              { value: 'ABSENT', label: t('absent') },
                              { value: 'LATE', label: t('late') },
                              { value: 'EXCUSED', label: t('excused') },
                            ]}
                          />
                        ) : (
                          <Badge 
                            color={
                              status === 'PRESENT' ? 'green' : 
                              status === 'LATE' ? 'yellow' : 
                              status === 'EXCUSED' ? 'blue' : 
                              'red'
                            }
                          >
                            {t(status.toLowerCase())}
                          </Badge>
                        )}
                      </Table.Td>
                      {attendanceEditing && (
                        <Table.Td>
                          <Group gap="xs">
                            <ActionIcon 
                              size="sm" 
                              color="green" 
                              onClick={() => handleAttendanceChange(student.id, 'PRESENT')}
                            >
                              <IconCheck size="1rem" />
                            </ActionIcon>
                            <ActionIcon 
                              size="sm" 
                              color="red" 
                              onClick={() => handleAttendanceChange(student.id, 'ABSENT')}
                            >
                              <IconX size="1rem" />
                            </ActionIcon>
                          </Group>
                        </Table.Td>
                      )}
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Card>
        </Tabs.Panel>

        {/* Content Tab */}
        <Tabs.Panel value="content">
          <Card withBorder>
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={4}>{t('lessonContent')}</Title>
                <Button size="sm" onClick={handleSaveNotes}>
                  {t('saveNotes')}
                </Button>
              </Group>

              <Textarea
                label={t('lessonNotes')}
                placeholder={t('addLessonNotes')}
                value={notes || lesson.notes || ''}
                onChange={(event) => setNotes(event.currentTarget.value)}
                minRows={6}
              />

              {lesson.materials && (
                <div>
                  <Text fw={500} size="sm" mb="xs">{t('materials')}</Text>
                  <Text size="sm" c="dimmed">{lesson.materials}</Text>
                </div>
              )}
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* Homework Tab */}
        <Tabs.Panel value="homework">
          <Card withBorder>
            <Stack gap="md">
              <Group justify="space-between">
                <Title order={4}>{t('homework')}</Title>
                <Button size="sm" onClick={handleSaveNotes}>
                  {t('saveHomework')}
                </Button>
              </Group>

              <Textarea
                label={t('homeworkAssignment')}
                placeholder={t('addHomeworkDescription')}
                value={homework || lesson.homework || ''}
                onChange={(event) => setHomework(event.currentTarget.value)}
                minRows={6}
              />

              <div>
                <Text fw={500} size="sm" mb="xs">{t('homeworkInstructions')}</Text>
                <Text size="sm" c="dimmed">
                  {t('homeworkInstructionsText')}
                </Text>
              </div>
            </Stack>
          </Card>
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
          {t('lesson.deleteConfirmation', { 
            title: lesson.title 
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
