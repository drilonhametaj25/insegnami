'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Container,
  Stack,
  Title,
  Text,
  Alert,
  LoadingOverlay,
  Grid,
  Group,
  Button,
  Select,
  SegmentedControl,
  Paper,
  Table,
  Badge,
  ActionIcon,
  Tooltip,
  ThemeIcon,
  Progress,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconInfoCircle,
  IconPlus,
  IconRefresh,
  IconCheck,
  IconX,
  IconBook2,
  IconEdit,
  IconTrash,
  IconCalendar,
  IconClock,
} from '@tabler/icons-react';
import Link from 'next/link';
import {
  useHomework,
  useCreateHomework,
  useUpdateHomework,
  useDeleteHomework,
  Homework,
  getDueDateColor,
  formatDueDate,
  isOverdue,
} from '@/lib/hooks/useHomework';
import { useClasses } from '@/lib/hooks/useClasses';
import { useSubjects } from '@/lib/hooks/useSubjects';
import { HomeworkForm } from '@/components/forms/HomeworkForm';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';

export default function HomeworkPage() {
  const { data: session } = useSession();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('homework');
  const tCommon = useTranslations('common');

  const [opened, { open, close }] = useDisclosure(false);
  const [editingHomework, setEditingHomework] = useState<Homework | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [filterTime, setFilterTime] = useState<string>('upcoming');

  const canManage =
    session?.user?.role === 'ADMIN' ||
    session?.user?.role === 'SUPERADMIN' ||
    session?.user?.role === 'TEACHER';

  // Fetch classes for filter
  const { data: classesData } = useClasses();
  const classes = classesData?.classes || [];

  // Fetch subjects for filter
  const { data: subjectsData } = useSubjects();
  const subjects = subjectsData?.subjects || [];

  // Fetch homework
  const {
    data: homeworkData,
    isLoading,
    refetch,
  } = useHomework({
    classId: selectedClassId || undefined,
    subjectId: selectedSubjectId || undefined,
    upcoming: filterTime === 'upcoming' ? true : undefined,
    past: filterTime === 'past' ? true : undefined,
  });

  const createHomework = useCreateHomework();
  const updateHomework = useUpdateHomework();
  const deleteHomework = useDeleteHomework();

  const handleAddHomework = () => {
    setEditingHomework(null);
    open();
  };

  const handleEditHomework = (hw: Homework) => {
    setEditingHomework(hw);
    open();
  };

  const handleDeleteHomework = (hw: Homework) => {
    modals.openConfirmModal({
      title: t('confirmDelete'),
      children: <Text size="sm">{t('confirmDeleteMessage')}</Text>,
      labels: { confirm: tCommon('delete'), cancel: tCommon('cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteHomework.mutateAsync(hw.id);
          notifications.show({
            title: tCommon('success'),
            message: t('deleteSuccess'),
            color: 'green',
            icon: <IconCheck />,
          });
        } catch (error) {
          notifications.show({
            title: tCommon('error'),
            message:
              error instanceof Error ? error.message : t('deleteError'),
            color: 'red',
            icon: <IconX />,
          });
        }
      },
    });
  };

  const handleSaveHomework = async (data: any) => {
    if (editingHomework) {
      await updateHomework.mutateAsync({
        id: editingHomework.id,
        data,
      });
      notifications.show({
        title: tCommon('success'),
        message: t('updateSuccess'),
        color: 'green',
        icon: <IconCheck />,
      });
    } else {
      await createHomework.mutateAsync(data);
      notifications.show({
        title: tCommon('success'),
        message: t('createSuccess'),
        color: 'green',
        icon: <IconCheck />,
      });
    }
  };

  const homeworkList = homeworkData?.data || [];

  // Calculate stats
  const stats = {
    total: homeworkList.length,
    upcoming: homeworkList.filter((h) => !isOverdue(h.dueDate)).length,
    overdue: homeworkList.filter((h) => isOverdue(h.dueDate)).length,
    avgSubmissions: homeworkList.length > 0
      ? Math.round(
          homeworkList.reduce((sum, h) => sum + (h._count?.submissions || 0), 0) /
            homeworkList.length
        )
      : 0,
  };

  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={isLoading && !homeworkData} />

      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={2}>{t('title')}</Title>
            <Text c="dimmed">{t('subtitle')}</Text>
          </div>
          <Group>
            {canManage && (
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={handleAddHomework}
              >
                {t('addHomework')}
              </Button>
            )}
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="light"
              onClick={() => refetch()}
              loading={isLoading}
            >
              {tCommon('refresh')}
            </Button>
          </Group>
        </Group>

        {/* Stats */}
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <ModernStatsCard
              title={t('totalHomework')}
              value={stats.total}
              icon="📚"
              gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <ModernStatsCard
              title={t('upcoming')}
              value={stats.upcoming}
              icon="📅"
              gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <ModernStatsCard
              title={t('overdue')}
              value={stats.overdue}
              icon="⏰"
              gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <ModernStatsCard
              title={t('avgSubmissions')}
              value={stats.avgSubmissions}
              icon="✅"
              gradient="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
            />
          </Grid.Col>
        </Grid>

        {/* Filters */}
        <Paper withBorder p="md" radius="md">
          <Group gap="md" wrap="wrap">
            <Select
              placeholder={t('filterByClass')}
              data={classes.map((c: any) => ({
                value: c.id,
                label: c.name,
              }))}
              value={selectedClassId}
              onChange={setSelectedClassId}
              clearable
              w={200}
            />
            <Select
              placeholder={t('filterBySubject')}
              data={subjects.map((s: any) => ({
                value: s.id,
                label: s.name,
              }))}
              value={selectedSubjectId}
              onChange={setSelectedSubjectId}
              clearable
              w={200}
            />
            <SegmentedControl
              value={filterTime}
              onChange={setFilterTime}
              data={[
                { value: 'all', label: t('all') },
                { value: 'upcoming', label: t('upcoming') },
                { value: 'past', label: t('past') },
              ]}
            />
          </Group>
        </Paper>

        {/* Homework List */}
        {homeworkList.length > 0 ? (
          <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('title')}</Table.Th>
                  <Table.Th style={{ width: 150 }}>{t('class')}</Table.Th>
                  <Table.Th style={{ width: 150 }}>{t('subject')}</Table.Th>
                  <Table.Th style={{ width: 130 }}>{t('dueDate')}</Table.Th>
                  <Table.Th style={{ width: 120 }}>{t('submissions')}</Table.Th>
                  {canManage && (
                    <Table.Th style={{ width: 100, textAlign: 'center' }}>
                      {t('actions')}
                    </Table.Th>
                  )}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {homeworkList.map((hw) => (
                  <Table.Tr key={hw.id}>
                    <Table.Td>
                      <div>
                        <Text size="sm" fw={500} lineClamp={1}>
                          {hw.title}
                        </Text>
                        <Text size="xs" c="dimmed" lineClamp={1}>
                          {hw.description}
                        </Text>
                      </div>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light">{hw.class?.name}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        color={hw.subject?.color || 'blue'}
                      >
                        {hw.subject?.name}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Badge
                          color={getDueDateColor(hw.dueDate)}
                          variant={isOverdue(hw.dueDate) ? 'filled' : 'light'}
                          leftSection={
                            isOverdue(hw.dueDate) ? (
                              <IconClock size={12} />
                            ) : (
                              <IconCalendar size={12} />
                            )
                          }
                        >
                          {formatDueDate(hw.dueDate)}
                        </Badge>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{hw._count?.submissions || 0}</Text>
                    </Table.Td>
                    {canManage && (
                      <Table.Td>
                        <Group gap="xs" justify="center">
                          <Tooltip label={t('editHomework')}>
                            <ActionIcon
                              variant="light"
                              color="blue"
                              onClick={() => handleEditHomework(hw)}
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={t('deleteHomework')}>
                            <ActionIcon
                              variant="light"
                              color="red"
                              onClick={() => handleDeleteHomework(hw)}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    )}
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Paper>
        ) : (
          <Paper withBorder p="xl" radius="md" ta="center">
            <ThemeIcon size={60} variant="light" color="gray" mx="auto">
              <IconBook2 size={30} />
            </ThemeIcon>
            <Text c="dimmed" mt="md">
              {t('noHomework')}
            </Text>
            {canManage && (
              <Button mt="md" variant="light" onClick={handleAddHomework}>
                {t('addFirstHomework')}
              </Button>
            )}
          </Paper>
        )}
      </Stack>

      {/* Homework Form Modal */}
      <HomeworkForm
        opened={opened}
        onClose={close}
        homework={editingHomework}
        classes={classes.map((c: any) => ({ value: c.id, label: c.name }))}
        subjects={subjects.map((s: any) => ({ value: s.id, label: s.name }))}
        onSave={handleSaveHomework}
        loading={createHomework.isPending || updateHomework.isPending}
      />
    </Container>
  );
}
