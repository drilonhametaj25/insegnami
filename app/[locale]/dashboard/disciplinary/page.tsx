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
  IconFileText,
} from '@tabler/icons-react';
import {
  useDisciplinaryNotes,
  useCreateDisciplinaryNote,
  useUpdateDisciplinaryNote,
  useDeleteDisciplinaryNote,
  DisciplinaryNote,
} from '@/lib/hooks/useDisciplinaryNotes';
import { useClasses } from '@/lib/hooks/useClasses';
import { DisciplinaryNoteForm } from '@/components/forms/DisciplinaryNoteForm';
import { NotesList, NotesStats } from '@/components/disciplinary/NotesList';
import { ModernStatsCard } from '@/components/cards/ModernStatsCard';

export default function DisciplinaryNotesPage() {
  const { data: session } = useSession();
  const params = useParams();
  const locale = params.locale as string;
  const t = useTranslations('disciplinary');
  const tCommon = useTranslations('common');

  const [opened, { open, close }] = useDisclosure(false);
  const [editingNote, setEditingNote] = useState<DisciplinaryNote | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [filterResolved, setFilterResolved] = useState<string>('all');

  const canManage =
    session?.user?.role === 'ADMIN' ||
    session?.user?.role === 'SUPERADMIN' ||
    session?.user?.role === 'TEACHER';

  const canDelete =
    session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPERADMIN';

  // Fetch classes for filter
  const { data: classesData } = useClasses();
  const classes = classesData?.classes || [];

  // Fetch disciplinary notes
  const {
    data: notesData,
    isLoading,
    refetch,
  } = useDisciplinaryNotes({
    classId: selectedClassId || undefined,
    type: filterType as any || undefined,
    resolved:
      filterResolved === 'all'
        ? undefined
        : filterResolved === 'resolved',
  });

  const createNote = useCreateDisciplinaryNote();
  const updateNote = useUpdateDisciplinaryNote();
  const deleteNote = useDeleteDisciplinaryNote();

  const handleAddNote = () => {
    setEditingNote(null);
    open();
  };

  const handleEditNote = (note: DisciplinaryNote) => {
    setEditingNote(note);
    open();
  };

  const handleDeleteNote = (note: DisciplinaryNote) => {
    modals.openConfirmModal({
      title: t('confirmDelete'),
      children: <Text size="sm">{t('confirmDeleteMessage')}</Text>,
      labels: { confirm: tCommon('delete'), cancel: tCommon('cancel') },
      confirmProps: { color: 'red' },
      onConfirm: async () => {
        try {
          await deleteNote.mutateAsync(note.id);
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

  const handleSaveNote = async (data: any) => {
    if (editingNote) {
      await updateNote.mutateAsync({
        id: editingNote.id,
        data,
      });
      notifications.show({
        title: tCommon('success'),
        message: t('updateSuccess'),
        color: 'green',
        icon: <IconCheck />,
      });
    } else {
      // For new notes, we need studentId and classId from form
      // This will be handled by a different flow with student selection
      notifications.show({
        title: tCommon('info'),
        message: t('selectStudentFirst'),
        color: 'blue',
      });
    }
  };

  // Calculate statistics from notes
  const notes = notesData?.data || [];
  const statistics = {
    total: notes.length,
    resolved: notes.filter((n) => n.resolved).length,
    unresolved: notes.filter((n) => !n.resolved).length,
    byType: {
      NOTE: notes.filter((n) => n.type === 'NOTE').length,
      WARNING: notes.filter((n) => n.type === 'WARNING').length,
      SUSPENSION: notes.filter((n) => n.type === 'SUSPENSION').length,
      POSITIVE: notes.filter((n) => n.type === 'POSITIVE').length,
    },
    bySeverity: {
      LOW: notes.filter((n) => n.severity === 'LOW').length,
      MEDIUM: notes.filter((n) => n.severity === 'MEDIUM').length,
      HIGH: notes.filter((n) => n.severity === 'HIGH').length,
      CRITICAL: notes.filter((n) => n.severity === 'CRITICAL').length,
    },
  };

  return (
    <Container size="xl" py="md">
      <LoadingOverlay visible={isLoading && !notesData} />

      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between">
          <div>
            <Title order={2}>{t('title')}</Title>
            <Text c="dimmed">{t('subtitle')}</Text>
          </div>
          <Group>
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
              title={t('totalNotes')}
              value={statistics.total}
              icon="📋"
              gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <ModernStatsCard
              title={t('openNotes')}
              value={statistics.unresolved}
              icon="⚠️"
              gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <ModernStatsCard
              title={t('resolvedNotes')}
              value={statistics.resolved}
              icon="✅"
              gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, lg: 3 }}>
            <ModernStatsCard
              title={t('positiveNotes')}
              value={statistics.byType.POSITIVE}
              icon="⭐"
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
              placeholder={t('filterByType')}
              data={[
                { value: 'NOTE', label: t('types.NOTE') },
                { value: 'WARNING', label: t('types.WARNING') },
                { value: 'SUSPENSION', label: t('types.SUSPENSION') },
                { value: 'POSITIVE', label: t('types.POSITIVE') },
              ]}
              value={filterType}
              onChange={setFilterType}
              clearable
              w={160}
            />
            <SegmentedControl
              value={filterResolved}
              onChange={setFilterResolved}
              data={[
                { value: 'all', label: t('all') },
                { value: 'open', label: t('open') },
                { value: 'resolved', label: t('resolved') },
              ]}
            />
          </Group>
        </Paper>

        {/* Notes List */}
        <NotesList
          notes={notes}
          loading={isLoading}
          onEdit={canManage ? handleEditNote : undefined}
          onDelete={canDelete ? handleDeleteNote : undefined}
          showStudent={true}
          showClass={true}
          canEdit={canManage}
          canDelete={canDelete}
        />

        {/* Info for adding notes */}
        {canManage && (
          <Alert icon={<IconInfoCircle />} color="blue" variant="light">
            {t('addNoteInfo')}
          </Alert>
        )}
      </Stack>

      {/* Edit Form Modal */}
      <DisciplinaryNoteForm
        opened={opened}
        onClose={close}
        note={editingNote}
        studentName={
          editingNote
            ? `${editingNote.student?.firstName} ${editingNote.student?.lastName}`
            : undefined
        }
        className={editingNote?.class?.name}
        onSave={handleSaveNote}
        loading={updateNote.isPending}
      />
    </Container>
  );
}
