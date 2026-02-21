'use client';

import { use } from 'react';
import {
  Container,
  Title,
  Text,
  Group,
  Button,
  Stack,
  Paper,
  Badge,
  Divider,
  Loader,
  Center,
  Breadcrumbs,
  Anchor,
  Modal,
  Textarea,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCalendarEvent,
  IconArrowLeft,
  IconCheck,
  IconX,
  IconCircleCheck,
  IconClock,
  IconUser,
  IconMapPin,
  IconNotes,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import {
  useParentMeeting,
  useUpdateMeetingStatus,
  useUpdateParentMeeting,
  getStatusColor,
  formatMeetingDateTime,
  canConfirmMeeting,
  canCancelMeeting,
  canCompleteMeeting,
} from '@/lib/hooks/useParentMeetings';
import { useState } from 'react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function MeetingDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const t = useTranslations('meetings');
  const locale = useLocale();
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = session?.user?.role;

  const { data: meeting, isLoading, error } = useParentMeeting(id);
  const statusMutation = useUpdateMeetingStatus();
  const updateMutation = useUpdateParentMeeting();

  const [cancelModalOpened, { open: openCancelModal, close: closeCancelModal }] =
    useDisclosure(false);
  const [cancelReason, setCancelReason] = useState('');

  const [notesModalOpened, { open: openNotesModal, close: closeNotesModal }] =
    useDisclosure(false);
  const [notes, setNotes] = useState('');

  const handleConfirm = async () => {
    if (!meeting) return;
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

  const handleComplete = async () => {
    if (!meeting) return;
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

  const confirmCancel = async () => {
    if (!meeting) return;
    try {
      await statusMutation.mutateAsync({
        id: meeting.id,
        data: { status: 'CANCELLED', reason: cancelReason },
      });
      notifications.show({
        title: t('success.cancelled'),
        message: '',
        color: 'green',
      });
      closeCancelModal();
      setCancelReason('');
    } catch (error: any) {
      notifications.show({
        title: 'Errore',
        message: error.message,
        color: 'red',
      });
    }
  };

  const handleSaveNotes = async () => {
    if (!meeting) return;
    try {
      const data =
        userRole === 'PARENT'
          ? { parentNotes: notes }
          : { teacherNotes: notes };

      await updateMutation.mutateAsync({
        id: meeting.id,
        data,
      });
      notifications.show({
        title: t('success.updated'),
        message: '',
        color: 'green',
      });
      closeNotesModal();
    } catch (error: any) {
      notifications.show({
        title: 'Errore',
        message: error.message,
        color: 'red',
      });
    }
  };

  const openEditNotes = () => {
    if (!meeting) return;
    setNotes(
      userRole === 'PARENT'
        ? meeting.parentNotes || ''
        : meeting.teacherNotes || ''
    );
    openNotesModal();
  };

  if (isLoading) {
    return (
      <Container size="lg" py="xl">
        <Center>
          <Loader />
        </Center>
      </Container>
    );
  }

  if (error || !meeting) {
    return (
      <Container size="lg" py="xl">
        <Center>
          <Text c="red">{t('empty.noMeetings')}</Text>
        </Center>
      </Container>
    );
  }

  const showConfirm = userRole !== 'PARENT' && canConfirmMeeting(meeting);
  const showComplete = userRole !== 'PARENT' && canCompleteMeeting(meeting);
  const showCancel = canCancelMeeting(meeting);

  return (
    <Container size="lg" py="md">
      <Stack gap="lg">
        {/* Breadcrumbs */}
        <Breadcrumbs>
          <Anchor component={Link} href={`/${locale}/dashboard/meetings`}>
            {t('title')}
          </Anchor>
          <Text>Dettaglio</Text>
        </Breadcrumbs>

        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={2}>
              <Group gap="xs">
                <IconCalendarEvent />
                {t('title')}
              </Group>
            </Title>
            <Badge color={getStatusColor(meeting.status)} size="lg" mt="xs">
              {t(`status.${meeting.status}`)}
            </Badge>
          </div>

          <Button
            variant="default"
            leftSection={<IconArrowLeft size="1rem" />}
            onClick={() => router.back()}
          >
            Indietro
          </Button>
        </Group>

        {/* Meeting Details */}
        <Paper p="lg" withBorder radius="md">
          <Stack gap="md">
            {/* Date and time */}
            <Group gap="xs">
              <IconClock size="1.25rem" style={{ color: 'var(--mantine-color-blue-6)' }} />
              <Text fw={500} size="lg">
                {formatMeetingDateTime(meeting.date)}
              </Text>
              <Text c="dimmed">({meeting.duration} {t('minutes')})</Text>
            </Group>

            <Divider />

            {/* Teacher */}
            <Group gap="xs">
              <IconUser size="1.25rem" style={{ color: 'var(--mantine-color-dimmed)' }} />
              <div>
                <Text size="sm" c="dimmed">
                  Docente
                </Text>
                <Text fw={500}>
                  {meeting.teacher.firstName} {meeting.teacher.lastName}
                </Text>
              </div>
            </Group>

            {/* Student */}
            <Group gap="xs">
              <IconUser size="1.25rem" style={{ color: 'var(--mantine-color-dimmed)' }} />
              <div>
                <Text size="sm" c="dimmed">
                  Studente
                </Text>
                <Text fw={500}>
                  {meeting.student.firstName} {meeting.student.lastName}
                </Text>
              </div>
            </Group>

            {/* Room */}
            {meeting.room && (
              <Group gap="xs">
                <IconMapPin size="1.25rem" style={{ color: 'var(--mantine-color-dimmed)' }} />
                <div>
                  <Text size="sm" c="dimmed">
                    {t('room')}
                  </Text>
                  <Text fw={500}>{meeting.room}</Text>
                </div>
              </Group>
            )}

            <Divider />

            {/* Notes */}
            <Group justify="space-between" align="flex-start">
              <Group gap="xs">
                <IconNotes size="1.25rem" style={{ color: 'var(--mantine-color-dimmed)' }} />
                <div style={{ flex: 1 }}>
                  <Text size="sm" c="dimmed">
                    {t('notes')}
                  </Text>

                  {meeting.teacherNotes && (
                    <Paper p="sm" withBorder mt="xs">
                      <Text size="sm" fw={500}>
                        {t('teacherNotes')}:
                      </Text>
                      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                        {meeting.teacherNotes}
                      </Text>
                    </Paper>
                  )}

                  {meeting.parentNotes && (
                    <Paper p="sm" withBorder mt="xs">
                      <Text size="sm" fw={500}>
                        {t('parentNotes')}:
                      </Text>
                      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                        {meeting.parentNotes}
                      </Text>
                    </Paper>
                  )}

                  {!meeting.teacherNotes && !meeting.parentNotes && (
                    <Text size="sm" c="dimmed" fs="italic">
                      Nessuna nota
                    </Text>
                  )}
                </div>
              </Group>

              {['REQUESTED', 'CONFIRMED'].includes(meeting.status) && (
                <Button variant="light" size="xs" onClick={openEditNotes}>
                  {t('actions.edit')} {t('notes')}
                </Button>
              )}
            </Group>
          </Stack>
        </Paper>

        {/* Actions */}
        {(showConfirm || showComplete || showCancel) && (
          <Paper p="lg" withBorder radius="md">
            <Text fw={500} mb="md">
              Azioni
            </Text>
            <Group>
              {showConfirm && (
                <Button
                  leftSection={<IconCheck size="1rem" />}
                  color="blue"
                  onClick={handleConfirm}
                  loading={statusMutation.isPending}
                >
                  {t('actions.confirm')}
                </Button>
              )}

              {showComplete && (
                <Button
                  leftSection={<IconCircleCheck size="1rem" />}
                  color="green"
                  onClick={handleComplete}
                  loading={statusMutation.isPending}
                >
                  {t('actions.complete')}
                </Button>
              )}

              {showCancel && (
                <Button
                  leftSection={<IconX size="1rem" />}
                  color="red"
                  variant="outline"
                  onClick={openCancelModal}
                >
                  {t('actions.cancel')}
                </Button>
              )}
            </Group>
          </Paper>
        )}
      </Stack>

      {/* Cancel Modal */}
      <Modal
        opened={cancelModalOpened}
        onClose={closeCancelModal}
        title={t('actions.cancel')}
        size="sm"
      >
        <Stack gap="md">
          <Text>Sei sicuro di voler cancellare questo colloquio?</Text>
          <Textarea
            label="Motivo (opzionale)"
            placeholder="Inserisci il motivo della cancellazione..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
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

      {/* Notes Modal */}
      <Modal
        opened={notesModalOpened}
        onClose={closeNotesModal}
        title={`${t('actions.edit')} ${t('notes')}`}
        size="md"
      >
        <Stack gap="md">
          <Textarea
            label={userRole === 'PARENT' ? t('parentNotes') : t('teacherNotes')}
            placeholder="Inserisci le note..."
            minRows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={closeNotesModal}>
              {t('actions.cancel')}
            </Button>
            <Button onClick={handleSaveNotes} loading={updateMutation.isPending}>
              Salva
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
