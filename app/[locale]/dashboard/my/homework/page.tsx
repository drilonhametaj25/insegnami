'use client';

// Portale famiglia: compiti assegnati; lo STUDENT può consegnare da qui

import { useState } from 'react';
import {
  Container,
  Stack,
  Group,
  Paper,
  Text,
  Badge,
  Alert,
  Skeleton,
  Button,
  Modal,
  Textarea,
  TextInput,
  Anchor,
  Divider,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconBook,
  IconInfoCircle,
  IconAlertTriangle,
  IconSend,
  IconCircleCheck,
} from '@tabler/icons-react';
import {
  useHomework,
  useSubmitHomework,
  useHomeworkSubmissions,
  getDueDateColor,
  formatDueDate,
  type Homework,
  type HomeworkSubmission,
} from '@/lib/hooks/useHomework';
import { useChildFilter, ChildSelect, MyPageHeader } from '../_components/family';

function SubmissionStatus({ submission }: { submission: HomeworkSubmission | undefined }) {
  if (!submission) {
    return (
      <Badge color="gray" variant="light">
        Da consegnare
      </Badge>
    );
  }
  if (submission.grade !== null && submission.grade !== undefined) {
    return (
      <Badge color="green" variant="filled" leftSection={<IconCircleCheck size="0.8rem" />}>
        Valutato: {submission.grade}/10
      </Badge>
    );
  }
  return (
    <Badge color="blue" variant="light">
      Consegnato
    </Badge>
  );
}

// Modale di dettaglio/consegna di un singolo compito
function HomeworkModal({
  homework,
  ownStudentId,
  isStudent,
  onClose,
}: {
  homework: Homework;
  ownStudentId: string | null;
  isStudent: boolean;
  onClose: () => void;
}) {
  const [content, setContent] = useState('');
  const [link, setLink] = useState('');

  const submissionsQuery = useHomeworkSubmissions(homework.id);
  const submitMutation = useSubmitHomework();

  // Per STUDENT la route ritorna { submissions }: individuiamo la propria
  const mySubmission = (submissionsQuery.data?.submissions ?? []).find(
    (s) => ownStudentId && s.studentId === ownStudentId
  );

  const handleSubmit = async () => {
    try {
      await submitMutation.mutateAsync({
        homeworkId: homework.id,
        data: {
          content: content || null,
          attachments: link ? [link] : [],
        },
      });
      notifications.show({
        title: 'Compito consegnato',
        message: 'La tua consegna è stata registrata.',
        color: 'green',
      });
      onClose();
    } catch (error: any) {
      notifications.show({
        title: 'Errore nella consegna',
        message: error.message,
        color: 'red',
      });
    }
  };

  return (
    <Stack gap="md">
      <div>
        <Text fw={600}>{homework.title}</Text>
        <Text size="sm" c="dimmed">
          {homework.subject?.name} · {homework.class?.name} · Scadenza{' '}
          {formatDueDate(homework.dueDate)}
        </Text>
      </div>
      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
        {homework.description}
      </Text>

      {submissionsQuery.isLoading ? (
        <Skeleton height={60} radius="md" />
      ) : (
        <>
          <Group gap="sm">
            <Text size="sm" fw={500}>
              Stato:
            </Text>
            <SubmissionStatus submission={mySubmission} />
          </Group>

          {mySubmission?.content && (
            <Paper p="sm" withBorder radius="md">
              <Text size="xs" c="dimmed" mb={4}>
                La tua consegna
              </Text>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                {mySubmission.content}
              </Text>
              {mySubmission.attachments?.map((a) => (
                <Anchor key={a} href={a} target="_blank" rel="noopener noreferrer" size="sm">
                  {a}
                </Anchor>
              ))}
            </Paper>
          )}

          {mySubmission?.feedback && (
            <Alert color="green" icon={<IconInfoCircle size="1rem" />} title="Feedback del docente">
              {mySubmission.feedback}
            </Alert>
          )}

          {isStudent && !mySubmission?.gradedAt && (
            <>
              <Divider
                label={mySubmission ? 'Aggiorna la consegna' : 'Consegna il compito'}
                labelPosition="left"
              />
              <Textarea
                data-testid="my-homework-content"
                label="Testo della consegna"
                placeholder="Scrivi qui la tua consegna..."
                minRows={4}
                value={content}
                onChange={(e) => setContent(e.currentTarget.value)}
              />
              <TextInput
                data-testid="my-homework-link"
                label="Link allegato (opzionale)"
                placeholder="https://..."
                value={link}
                onChange={(e) => setLink(e.currentTarget.value)}
              />
              <Group justify="flex-end">
                <Button variant="default" onClick={onClose}>
                  Annulla
                </Button>
                <Button
                  data-testid="my-homework-submit"
                  leftSection={<IconSend size="1rem" />}
                  onClick={handleSubmit}
                  loading={submitMutation.isPending}
                  disabled={!content && !link}
                >
                  {mySubmission ? 'Aggiorna consegna' : 'Consegna'}
                </Button>
              </Group>
            </>
          )}
        </>
      )}
    </Stack>
  );
}

export default function MyHomeworkPage() {
  const { isParent, isStudent, children, selectedChildId, setSelectedChildId, ownStudentId } =
    useChildFilter();

  const { data, isLoading, error } = useHomework({ limit: 100 });
  const [selected, setSelected] = useState<Homework | null>(null);
  const [modalOpened, { open: openModal, close: closeModal }] = useDisclosure(false);

  const homework = data?.data ?? [];

  const openHomework = (hw: Homework) => {
    setSelected(hw);
    openModal();
  };

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <MyPageHeader
          icon={<IconBook size="1.5rem" />}
          title="Compiti"
          subtitle={
            isParent
              ? 'I compiti assegnati alle classi dei tuoi figli'
              : 'I compiti assegnati alle tue classi'
          }
          action={
            <ChildSelect
              options={children}
              value={selectedChildId}
              onChange={setSelectedChildId}
            />
          }
        />

        {error && (
          <Alert color="red" icon={<IconAlertTriangle size="1rem" />}>
            {(error as Error).message}
          </Alert>
        )}

        {isLoading ? (
          <Skeleton height={200} radius="md" />
        ) : homework.length === 0 ? (
          <Alert color="blue" icon={<IconInfoCircle size="1rem" />}>
            Nessun compito assegnato al momento.
          </Alert>
        ) : (
          <Stack gap="sm" data-testid="my-homework-list">
            {homework.map((hw) => (
              <Paper key={hw.id} p="md" withBorder radius="md">
                <Group justify="space-between" wrap="wrap">
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <Group gap="xs">
                      <Text fw={600}>{hw.title}</Text>
                      <Badge color={getDueDateColor(hw.dueDate)} variant="light">
                        Scadenza {formatDueDate(hw.dueDate)}
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {hw.subject?.name} · {hw.class?.name}
                      {hw.teacher ? ` · ${hw.teacher.firstName} ${hw.teacher.lastName}` : ''}
                    </Text>
                    <Text size="sm" lineClamp={2} mt={4}>
                      {hw.description}
                    </Text>
                  </div>
                  <Button
                    data-testid="my-homework-open"
                    variant="light"
                    onClick={() => openHomework(hw)}
                  >
                    {isStudent ? 'Dettagli / Consegna' : 'Dettagli'}
                  </Button>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>

      <Modal
        opened={modalOpened}
        onClose={closeModal}
        title="Dettaglio compito"
        size="lg"
      >
        {selected && (
          <HomeworkModal
            homework={selected}
            ownStudentId={ownStudentId}
            isStudent={isStudent}
            onClose={closeModal}
          />
        )}
      </Modal>
    </Container>
  );
}
