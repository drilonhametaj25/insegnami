'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Container,
  Stack,
  Title,
  Button,
  Group,
  Text,
  Alert,
  LoadingOverlay,
  Badge,
  Grid,
  Card,
  Table,
  Box,
  ActionIcon,
  Tooltip,
  Paper,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconEdit,
  IconTrash,
  IconCheck,
  IconX,
  IconInfoCircle,
  IconUsers,
  IconBook,
  IconClock,
} from '@tabler/icons-react';
import { SubjectForm } from '@/components/forms/SubjectForm';
import {
  useSubject,
  useUpdateSubject,
  useDeleteSubject,
  CreateSubjectData,
} from '@/lib/hooks/useSubjects';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SubjectDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;

  const { data: session } = useSession();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('subjects');
  const tCommon = useTranslations('common');

  const [opened, { open, close }] = useDisclosure(false);

  // React Query hooks
  const { data: subject, isLoading, error } = useSubject(id);
  const updateSubject = useUpdateSubject();
  const deleteSubject = useDeleteSubject();

  // Check permissions
  const canManageSubjects =
    session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN';

  // Handle back
  const handleBack = () => {
    router.push(`/${locale}/dashboard/subjects`);
  };

  // Handle edit
  const handleEdit = () => {
    open();
  };

  // Handle delete
  const handleDelete = () => {
    if (!subject) return;

    modals.openConfirmModal({
      title: t('confirmDelete'),
      children: (
        <Text size="sm">
          {t('confirmDeleteMessage', { name: subject.name })}
        </Text>
      ),
      labels: { confirm: tCommon('delete'), cancel: tCommon('cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteSubject.mutateAsync(subject.id);
          notifications.show({
            title: tCommon('success'),
            message: t('deleteSuccess'),
            color: 'green',
            icon: <IconCheck />,
          });
          router.push(`/${locale}/dashboard/subjects`);
        } catch (error) {
          notifications.show({
            title: tCommon('error'),
            message: t('deleteError'),
            color: 'red',
            icon: <IconX />,
          });
        }
      },
    });
  };

  // Submit form
  const handleSubmit = async (data: CreateSubjectData) => {
    await updateSubject.mutateAsync({ id, data });
    close();
  };

  if (isLoading) {
    return (
      <Container size="xl" py="md">
        <LoadingOverlay visible />
      </Container>
    );
  }

  if (error || !subject) {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconInfoCircle />} color="red">
          {t('notFound')}
        </Alert>
        <Button mt="md" onClick={handleBack} leftSection={<IconArrowLeft size={16} />}>
          {t('backToList')}
        </Button>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <Group>
            <Button
              variant="subtle"
              onClick={handleBack}
              leftSection={<IconArrowLeft size={16} />}
            >
              {t('backToList')}
            </Button>
            <Box
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                backgroundColor: subject.color || '#3b82f6',
              }}
            />
            <div>
              <Title order={2}>{subject.name}</Title>
              <Text c="dimmed">{subject.code}</Text>
            </div>
            <Badge color={subject.isActive ? 'green' : 'gray'} size="lg">
              {subject.isActive ? tCommon('active') : tCommon('inactive')}
            </Badge>
          </Group>
          {canManageSubjects && (
            <Group>
              <Button
                variant="light"
                color="yellow"
                leftSection={<IconEdit size={16} />}
                onClick={handleEdit}
              >
                {tCommon('edit')}
              </Button>
              <Button
                variant="light"
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={handleDelete}
              >
                {tCommon('delete')}
              </Button>
            </Group>
          )}
        </Group>

        {/* Stats Cards */}
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group>
                <IconClock size={32} color="#3b82f6" />
                <div>
                  <Text size="xs" c="dimmed">{t('weeklyHours')}</Text>
                  <Text size="xl" fw={700}>
                    {subject.weeklyHours ?? '-'}
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group>
                <IconUsers size={32} color="#10b981" />
                <div>
                  <Text size="xs" c="dimmed">{t('teachers')}</Text>
                  <Text size="xl" fw={700}>
                    {subject.teachers?.length || 0}
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group>
                <IconBook size={32} color="#8b5cf6" />
                <div>
                  <Text size="xs" c="dimmed">{t('classes')}</Text>
                  <Text size="xl" fw={700}>
                    {subject._count?.classSubjects || 0}
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Group>
                <Text style={{ fontSize: 32 }}>📝</Text>
                <div>
                  <Text size="xs" c="dimmed">{t('grades')}</Text>
                  <Text size="xl" fw={700}>
                    {subject._count?.grades || 0}
                  </Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Teachers Section */}
        <Paper shadow="sm" p="lg" radius="md" withBorder>
          <Title order={4} mb="md">{t('assignedTeachers')}</Title>
          {subject.teachers && subject.teachers.length > 0 ? (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('teacherName')}</Table.Th>
                  <Table.Th>{t('email')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {subject.teachers.map((teacher) => (
                  <Table.Tr key={teacher.id}>
                    <Table.Td>
                      <Text fw={500}>
                        {teacher.firstName} {teacher.lastName}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text c="dimmed">{teacher.email}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text c="dimmed">{t('noTeachersAssigned')}</Text>
          )}
        </Paper>

        {/* Class Assignments Section */}
        <Paper shadow="sm" p="lg" radius="md" withBorder>
          <Title order={4} mb="md">{t('classAssignments')}</Title>
          {subject.classSubjects && subject.classSubjects.length > 0 ? (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('className')}</Table.Th>
                  <Table.Th>{t('classCode')}</Table.Th>
                  <Table.Th>{t('teacher')}</Table.Th>
                  <Table.Th>{t('weeklyHours')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {subject.classSubjects.map((cs, index) => (
                  <Table.Tr key={index}>
                    <Table.Td>
                      <Text fw={500}>{cs.className}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light">{cs.classCode}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text>{cs.teacherName}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text>{cs.weeklyHours} {t('hoursPerWeek')}</Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text c="dimmed">{t('noClassAssignments')}</Text>
          )}
        </Paper>
      </Stack>

      {/* Edit Form Modal */}
      <SubjectForm
        opened={opened}
        onClose={close}
        subject={subject}
        onSave={handleSubmit}
        loading={updateSubject.isPending}
      />
    </Container>
  );
}
