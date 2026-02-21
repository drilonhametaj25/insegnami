'use client';

import { useState, useEffect } from 'react';
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
  ActionIcon,
  Tooltip,
  Box,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconX,
  IconInfoCircle,
  IconEye,
  IconPlus,
  IconRefresh,
  IconEdit,
  IconTrash,
} from '@tabler/icons-react';
import { DataTable } from '@/components/tables/DataTable';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';
import { SubjectForm } from '@/components/forms/SubjectForm';
import {
  useSubjects,
  useSubjectStats,
  useCreateSubject,
  useUpdateSubject,
  useDeleteSubject,
  Subject,
  CreateSubjectData,
} from '@/lib/hooks/useSubjects';

export default function SubjectsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('subjects');
  const tCommon = useTranslations('common');

  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('');

  const [opened, { open, close }] = useDisclosure(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);

  // React Query hooks
  const {
    data: subjectsData,
    isLoading,
    refetch,
  } = useSubjects(page, 50, {
    search: searchQuery || undefined,
    isActive: activeFilter ? activeFilter === 'true' : undefined,
  });

  const { data: stats } = useSubjectStats();
  const createSubject = useCreateSubject();
  const updateSubject = useUpdateSubject();
  const deleteSubject = useDeleteSubject();

  // Check permissions
  const canManageSubjects =
    session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN';

  // Navigate to subject detail
  const handleViewSubject = (subjectId: string) => {
    router.push(`/${locale}/dashboard/subjects/${subjectId}`);
  };

  // Handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setPage(1);
  };

  // Handle filter
  const handleFilter = (filter: string) => {
    setActiveFilter(filter);
    setPage(1);
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  // Handle create
  const handleCreate = () => {
    setEditingSubject(null);
    open();
  };

  // Handle edit
  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject);
    open();
  };

  // Handle delete
  const handleDelete = (subject: Subject) => {
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
    if (editingSubject) {
      await updateSubject.mutateAsync({ id: editingSubject.id, data });
    } else {
      await createSubject.mutateAsync(data);
    }
  };

  // Table columns
  const columns = [
    {
      key: 'name' as keyof Subject,
      title: t('name'),
      render: (_value: any, subject: Subject) => (
        <Group gap="sm">
          <Box
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: subject.color || '#3b82f6',
            }}
          />
          <div>
            <Text
              fw={500}
              size="sm"
              c="blue"
              style={{ cursor: 'pointer' }}
              onClick={() => handleViewSubject(subject.id)}
            >
              {subject.name}
            </Text>
            <Text size="xs" c="dimmed">
              {subject.code}
            </Text>
          </div>
        </Group>
      ),
    },
    {
      key: 'weeklyHours' as keyof Subject,
      title: t('weeklyHours'),
      render: (hours: number | null) => (
        <Text size="sm">{hours ?? '-'} {hours ? t('hoursPerWeek') : ''}</Text>
      ),
    },
    {
      key: 'teachers' as keyof Subject,
      title: t('teachers'),
      render: (teachers: Subject['teachers']) => (
        <Text size="sm">{teachers?.length || 0} {t('teachersCount')}</Text>
      ),
    },
    {
      key: '_count' as keyof Subject,
      title: t('usage'),
      render: (_count: Subject['_count']) => (
        <Group gap="xs">
          <Badge size="sm" variant="light" color="blue">
            {_count?.grades || 0} {t('grades')}
          </Badge>
          <Badge size="sm" variant="light" color="grape">
            {_count?.homework || 0} {t('homework')}
          </Badge>
        </Group>
      ),
    },
    {
      key: 'isActive' as keyof Subject,
      title: t('status'),
      render: (isActive: boolean) => (
        <Badge color={isActive ? 'green' : 'gray'}>
          {isActive ? tCommon('active') : tCommon('inactive')}
        </Badge>
      ),
    },
    {
      key: 'id' as keyof Subject,
      title: tCommon('actions'),
      render: (_id: string, subject: Subject) => (
        <Group gap="xs">
          <Tooltip label={t('viewDetails')}>
            <ActionIcon
              variant="light"
              color="blue"
              onClick={() => handleViewSubject(subject.id)}
            >
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          {canManageSubjects && (
            <>
              <Tooltip label={tCommon('edit')}>
                <ActionIcon
                  variant="light"
                  color="yellow"
                  onClick={() => handleEdit(subject)}
                >
                  <IconEdit size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={tCommon('delete')}>
                <ActionIcon
                  variant="light"
                  color="red"
                  onClick={() => handleDelete(subject)}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </>
          )}
        </Group>
      ),
    },
  ];

  if (!canManageSubjects && session?.user?.role !== 'TEACHER') {
    return (
      <Container size="lg" py="xl">
        <Alert icon={<IconInfoCircle />} color="red">
          {t('noPermission')}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={isLoading && !subjectsData} />

      <Stack gap="lg">
        <Group justify="space-between">
          <Title order={2}>{t('title')}</Title>
          <Group>
            <Button
              leftSection={<IconRefresh size={16} />}
              variant="light"
              onClick={() => refetch()}
              loading={isLoading}
            >
              {tCommon('refresh')}
            </Button>
            {canManageSubjects && (
              <Button leftSection={<IconPlus size={16} />} onClick={handleCreate}>
                {t('addSubject')}
              </Button>
            )}
          </Group>
        </Group>

        {/* Stats Cards */}
        {stats && (
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <ModernStatsCard
                title={t('totalSubjects')}
                value={stats.totalSubjects}
                icon="📚"
                gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <ModernStatsCard
                title={t('activeSubjects')}
                value={stats.activeSubjects}
                icon="✅"
                gradient="linear-gradient(135deg, #48bb78 0%, #38a169 100%)"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <ModernStatsCard
                title={t('totalGrades')}
                value={stats.totalGrades}
                icon="📝"
                gradient="linear-gradient(135deg, #4fd1c7 0%, #3182ce 100%)"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
              <ModernStatsCard
                title={t('totalHomework')}
                value={stats.totalHomework}
                icon="📋"
                gradient="linear-gradient(135deg, #f6ad55 0%, #ed8936 100%)"
              />
            </Grid.Col>
          </Grid>
        )}

        <DataTable
          data={subjectsData?.subjects || []}
          columns={columns}
          loading={isLoading}
          searchPlaceholder={t('searchPlaceholder')}
          onSearch={handleSearch}
          filterable
          filterOptions={[
            { value: 'true', label: tCommon('active') },
            { value: 'false', label: tCommon('inactive') },
          ]}
          filterLabel={t('filterByStatus')}
          onFilter={handleFilter}
          onEdit={canManageSubjects ? handleEdit : undefined}
          onCreate={canManageSubjects ? handleCreate : undefined}
          createButtonLabel={t('addSubject')}
          page={page}
          totalPages={subjectsData?.pagination?.totalPages || 1}
          onPageChange={handlePageChange}
          pageSize={50}
          total={subjectsData?.pagination?.total || 0}
        />
      </Stack>

      {/* Subject Form Modal */}
      <SubjectForm
        opened={opened}
        onClose={close}
        subject={editingSubject}
        onSave={handleSubmit}
        loading={createSubject.isPending || updateSubject.isPending}
      />
    </Container>
  );
}
