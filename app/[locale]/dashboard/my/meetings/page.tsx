'use client';

// Portale famiglia: colloqui genitori-docenti.
// Il PARENT può richiedere un nuovo colloquio (opzioni da my-options);
// lo STUDENT consulta in sola lettura.

import {
  Container,
  Stack,
  Paper,
  Text,
  Badge,
  Alert,
  Skeleton,
  Button,
  Group,
  Modal,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconCalendarEvent,
  IconInfoCircle,
  IconAlertTriangle,
  IconPlus,
  IconMapPin,
} from '@tabler/icons-react';
import { ParentMeetingForm } from '@/components/forms/ParentMeetingForm';
import {
  useParentMeetings,
  useParentMeetingOptions,
  useCreateParentMeeting,
  getStatusColor,
  formatMeetingDateTime,
  type ParentMeeting,
} from '@/lib/hooks/useParentMeetings';
import { useChildFilter, ChildSelect, MyPageHeader } from '../_components/family';

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: 'Richiesto',
  CONFIRMED: 'Confermato',
  COMPLETED: 'Completato',
  CANCELLED: 'Annullato',
};

export default function MyMeetingsPage() {
  const { isParent, children, selectedChildId, setSelectedChildId } = useChildFilter();

  const [createModalOpened, { open: openCreateModal, close: closeCreateModal }] =
    useDisclosure(false);

  const meetingsQuery = useParentMeetings(
    isParent && selectedChildId ? { studentId: selectedChildId } : {}
  );
  const optionsQuery = useParentMeetingOptions(isParent);
  const createMutation = useCreateParentMeeting();

  const meetings = meetingsQuery.data?.meetings ?? [];
  const teachers = optionsQuery.data?.teachers ?? [];

  const handleCreateSubmit = async (data: any) => {
    try {
      await createMutation.mutateAsync(data);
      notifications.show({
        title: 'Richiesta inviata',
        message: 'Il docente riceverà la tua richiesta di colloquio.',
        color: 'green',
      });
      closeCreateModal();
    } catch (error: any) {
      notifications.show({
        title: 'Errore nella richiesta',
        message: error.message,
        color: 'red',
      });
    }
  };

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <MyPageHeader
          icon={<IconCalendarEvent size="1.5rem" />}
          title="Colloqui"
          subtitle={
            isParent
              ? 'I colloqui con i docenti dei tuoi figli'
              : 'I colloqui programmati che ti riguardano'
          }
          action={
            <Group gap="sm" align="flex-end">
              <ChildSelect
                options={children}
                value={selectedChildId}
                onChange={setSelectedChildId}
              />
              {isParent && (
                <Button
                  data-testid="my-meetings-request"
                  leftSection={<IconPlus size="1rem" />}
                  onClick={openCreateModal}
                >
                  Richiedi colloquio
                </Button>
              )}
            </Group>
          }
        />

        {meetingsQuery.error && (
          <Alert color="red" icon={<IconAlertTriangle size="1rem" />}>
            {(meetingsQuery.error as Error).message}
          </Alert>
        )}

        {meetingsQuery.isLoading ? (
          <Skeleton height={200} radius="md" />
        ) : meetings.length === 0 ? (
          <Alert color="blue" icon={<IconInfoCircle size="1rem" />}>
            Nessun colloquio programmato al momento.
          </Alert>
        ) : (
          <Stack gap="sm" data-testid="my-meetings-list">
            {meetings.map((meeting: ParentMeeting) => (
              <Paper key={meeting.id} p="md" withBorder radius="md">
                <Group justify="space-between" wrap="wrap" align="flex-start">
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <Group gap="xs" mb={4}>
                      <Badge color={getStatusColor(meeting.status)} variant="filled">
                        {STATUS_LABELS[meeting.status] ?? meeting.status}
                      </Badge>
                      <Text size="sm" fw={600}>
                        {formatMeetingDateTime(meeting.date)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        ({meeting.duration} min)
                      </Text>
                    </Group>
                    <Text size="sm">
                      Docente: {meeting.teacher.firstName} {meeting.teacher.lastName}
                    </Text>
                    <Text size="sm" c="dimmed">
                      Studente: {meeting.student.firstName} {meeting.student.lastName}
                    </Text>
                    {meeting.room && (
                      <Group gap={4} mt={4}>
                        <IconMapPin size="0.9rem" />
                        <Text size="sm">{meeting.room}</Text>
                      </Group>
                    )}
                    {meeting.parentNotes && (
                      <Text size="sm" mt={4} c="dimmed">
                        Note: {meeting.parentNotes}
                      </Text>
                    )}
                    {meeting.teacherNotes && (
                      <Text size="sm" mt={4} c="dimmed">
                        Note del docente: {meeting.teacherNotes}
                      </Text>
                    )}
                  </div>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>

      {/* Modale richiesta colloquio (solo PARENT) */}
      <Modal
        opened={createModalOpened}
        onClose={closeCreateModal}
        title="Richiedi colloquio"
        size="lg"
      >
        {optionsQuery.isLoading ? (
          <Skeleton height={200} radius="md" />
        ) : (
          <ParentMeetingForm
            teachers={teachers}
            students={children}
            onSubmit={handleCreateSubmit}
            onCancel={closeCreateModal}
            isLoading={createMutation.isPending}
          />
        )}
      </Modal>
    </Container>
  );
}
