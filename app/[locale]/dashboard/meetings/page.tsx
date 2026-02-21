'use client';

import { useState } from 'react';
import {
  Container,
  Title,
  Text,
  Group,
  Button,
  Stack,
  Paper,
  SimpleGrid,
  Modal,
  LoadingOverlay,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCalendarEvent,
  IconPlus,
  IconClock,
  IconCalendarCheck,
  IconCircleCheck,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { MeetingsList } from '@/components/meetings/MeetingsList';
import { ParentMeetingForm } from '@/components/forms/ParentMeetingForm';
import {
  ParentMeeting,
  useParentMeetingStats,
  useCreateParentMeeting,
  useUpdateMeetingStatus,
  useDeleteParentMeeting,
} from '@/lib/hooks/useParentMeetings';
import { useTeachers } from '@/lib/hooks/useTeachers';
import { useStudents } from '@/lib/hooks/useStudents';

export default function MeetingsPage() {
  const t = useTranslations('meetings');
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] =
    useDisclosure(false);
  const [cancelModalOpened, { open: openCancelModal, close: closeCancelModal }] =
    useDisclosure(false);
  const [selectedMeeting, setSelectedMeeting] = useState<ParentMeeting | null>(null);

  // Data fetching
  const { data: stats, isLoading: statsLoading } = useParentMeetingStats();
  const { data: teachersData } = useTeachers();
  const { data: studentsData } = useStudents();

  const teachers = teachersData?.teachers || [];
  const students = studentsData?.students || [];

  // Mutations
  const createMutation = useCreateParentMeeting();
  const statusMutation = useUpdateMeetingStatus();
  const deleteMutation = useDeleteParentMeeting();

  // Determine view type
  const viewAs = userRole === 'TEACHER' ? 'teacher' : userRole === 'PARENT' ? 'parent' : 'admin';

  const handleCreateSubmit = async (data: any) => {
    try {
      await createMutation.mutateAsync(data);
      notifications.show({
        title: t('success.created'),
        message: '',
        color: 'green',
      });
      closeCreateModal();
    } catch (error: any) {
      notifications.show({
        title: t('errors.createFailed'),
        message: error.message,
        color: 'red',
      });
    }
  };

  const handleConfirm = async (meeting: ParentMeeting) => {
    try {
      await statusMutation.mutateAsync({
        id: meeting.id,
        data: { status: 'CONFIRMED' },
      });
      notifications.show({
        title: t('success.confirmed'),
        message: '',
        color: 'green',
      });
    } catch (error: any) {
      notifications.show({
        title: 'Errore',
        message: error.message,
        color: 'red',
      });
    }
  };

  const handleComplete = async (meeting: ParentMeeting) => {
    try {
      await statusMutation.mutateAsync({
        id: meeting.id,
        data: { status: 'COMPLETED' },
      });
      notifications.show({
        title: t('success.completed'),
        message: '',
        color: 'green',
      });
    } catch (error: any) {
      notifications.show({
        title: 'Errore',
        message: error.message,
        color: 'red',
      });
    }
  };

  const handleCancel = (meeting: ParentMeeting) => {
    setSelectedMeeting(meeting);
    openCancelModal();
  };

  const confirmCancel = async () => {
    if (!selectedMeeting) return;

    try {
      await statusMutation.mutateAsync({
        id: selectedMeeting.id,
        data: { status: 'CANCELLED' },
      });
      notifications.show({
        title: t('success.cancelled'),
        message: '',
        color: 'green',
      });
      closeCancelModal();
      setSelectedMeeting(null);
    } catch (error: any) {
      notifications.show({
        title: 'Errore',
        message: error.message,
        color: 'red',
      });
    }
  };

  const handleDelete = async (meeting: ParentMeeting) => {
    if (!confirm('Sei sicuro di voler eliminare questo colloquio?')) return;

    try {
      await deleteMutation.mutateAsync(meeting.id);
      notifications.show({
        title: 'Colloquio eliminato',
        message: '',
        color: 'green',
      });
    } catch (error: any) {
      notifications.show({
        title: 'Errore',
        message: error.message,
        color: 'red',
      });
    }
  };

  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={statsLoading} />

      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={2}>
              <Group gap="xs">
                <IconCalendarEvent />
                {t('title')}
              </Group>
            </Title>
            <Text c="dimmed">{t('subtitle')}</Text>
          </div>

          <Button leftSection={<IconPlus size="1rem" />} onClick={openCreateModal}>
            {userRole === 'PARENT' ? t('requestMeeting') : t('newMeeting')}
          </Button>
        </Group>

        {/* Stats Cards */}
        {stats && (
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <Paper p="md" withBorder radius="md">
              <Group>
                <IconClock size="2rem" style={{ color: 'var(--mantine-color-yellow-6)' }} />
                <div>
                  <Text size="xl" fw={700}>
                    {stats.requested}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {t('stats.pending')}
                  </Text>
                </div>
              </Group>
            </Paper>

            <Paper p="md" withBorder radius="md">
              <Group>
                <IconCalendarCheck
                  size="2rem"
                  style={{ color: 'var(--mantine-color-blue-6)' }}
                />
                <div>
                  <Text size="xl" fw={700}>
                    {stats.todayCount}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {t('stats.todayConfirmed')}
                  </Text>
                </div>
              </Group>
            </Paper>

            <Paper p="md" withBorder radius="md">
              <Group>
                <IconCircleCheck
                  size="2rem"
                  style={{ color: 'var(--mantine-color-green-6)' }}
                />
                <div>
                  <Text size="xl" fw={700}>
                    {stats.completed}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {t('stats.monthCompleted')}
                  </Text>
                </div>
              </Group>
            </Paper>
          </SimpleGrid>
        )}

        {/* Meetings List */}
        <MeetingsList
          viewAs={viewAs}
          teachers={teachers}
          students={students}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onComplete={handleComplete}
          onDelete={handleDelete}
        />
      </Stack>

      {/* Create Modal */}
      <Modal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title={userRole === 'PARENT' ? t('requestMeeting') : t('newMeeting')}
        size="lg"
      >
        <ParentMeetingForm
          teachers={teachers}
          students={students}
          onSubmit={handleCreateSubmit}
          onCancel={closeCreateModal}
          isLoading={createMutation.isPending}
        />
      </Modal>

      {/* Cancel Confirmation Modal */}
      <Modal
        opened={cancelModalOpened}
        onClose={closeCancelModal}
        title={t('actions.cancel')}
        size="sm"
      >
        <Stack gap="md">
          <Text>Sei sicuro di voler cancellare questo colloquio?</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={closeCancelModal}>
              No
            </Button>
            <Button
              color="red"
              onClick={confirmCancel}
              loading={statusMutation.isPending}
            >
              Sì, cancella
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
