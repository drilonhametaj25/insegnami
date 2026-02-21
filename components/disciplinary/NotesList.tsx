'use client';

import {
  Table,
  Badge,
  Group,
  Text,
  ActionIcon,
  Tooltip,
  Paper,
  ThemeIcon,
  Box,
  Skeleton,
} from '@mantine/core';
import {
  IconEdit,
  IconTrash,
  IconCheck,
  IconAlertTriangle,
  IconBan,
  IconStar,
  IconFileText,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { DisciplinaryType, Severity } from '@prisma/client';
import {
  DisciplinaryNote,
  getTypeColor,
  getSeverityColor,
} from '@/lib/hooks/useDisciplinaryNotes';

interface NotesListProps {
  notes: DisciplinaryNote[];
  loading?: boolean;
  onEdit?: (note: DisciplinaryNote) => void;
  onDelete?: (note: DisciplinaryNote) => void;
  showStudent?: boolean;
  showClass?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function NotesList({
  notes,
  loading,
  onEdit,
  onDelete,
  showStudent = true,
  showClass = true,
  canEdit = false,
  canDelete = false,
}: NotesListProps) {
  const t = useTranslations('disciplinary');

  const getTypeIcon = (type: DisciplinaryType) => {
    switch (type) {
      case 'NOTE':
        return <IconFileText size={16} />;
      case 'WARNING':
        return <IconAlertTriangle size={16} />;
      case 'SUSPENSION':
        return <IconBan size={16} />;
      case 'POSITIVE':
        return <IconStar size={16} />;
      default:
        return <IconFileText size={16} />;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <Paper withBorder p="md" radius="md">
        <Skeleton height={40} mb="sm" />
        <Skeleton height={40} mb="sm" />
        <Skeleton height={40} />
      </Paper>
    );
  }

  if (notes.length === 0) {
    return (
      <Paper withBorder p="xl" radius="md" ta="center">
        <ThemeIcon size={60} variant="light" color="gray" mx="auto">
          <IconFileText size={30} />
        </ThemeIcon>
        <Text c="dimmed" mt="md">
          {t('noNotes')}
        </Text>
      </Paper>
    );
  }

  return (
    <Paper withBorder radius="md" style={{ overflow: 'hidden' }}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th style={{ width: 120 }}>{t('date')}</Table.Th>
            <Table.Th style={{ width: 120 }}>{t('type')}</Table.Th>
            {showStudent && <Table.Th>{t('student')}</Table.Th>}
            {showClass && <Table.Th style={{ width: 120 }}>{t('class')}</Table.Th>}
            <Table.Th>{t('title')}</Table.Th>
            <Table.Th style={{ width: 100 }}>{t('severity')}</Table.Th>
            <Table.Th style={{ width: 100 }}>{t('status')}</Table.Th>
            {(canEdit || canDelete) && (
              <Table.Th style={{ width: 100, textAlign: 'center' }}>
                {t('actions')}
              </Table.Th>
            )}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {notes.map((note) => (
            <Table.Tr key={note.id}>
              <Table.Td>
                <Text size="sm">{formatDate(note.date)}</Text>
              </Table.Td>
              <Table.Td>
                <Badge
                  color={getTypeColor(note.type)}
                  variant="light"
                  leftSection={getTypeIcon(note.type)}
                >
                  {t(`types.${note.type}`)}
                </Badge>
              </Table.Td>
              {showStudent && (
                <Table.Td>
                  <div>
                    <Text size="sm" fw={500}>
                      {note.student?.lastName} {note.student?.firstName}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {note.student?.studentCode}
                    </Text>
                  </div>
                </Table.Td>
              )}
              {showClass && (
                <Table.Td>
                  <Text size="sm">{note.class?.name}</Text>
                </Table.Td>
              )}
              <Table.Td>
                <Tooltip label={note.description} multiline w={300}>
                  <Text size="sm" lineClamp={1}>
                    {note.title}
                  </Text>
                </Tooltip>
              </Table.Td>
              <Table.Td>
                {note.type !== 'POSITIVE' && (
                  <Badge color={getSeverityColor(note.severity)} variant="dot">
                    {t(`severities.${note.severity}`)}
                  </Badge>
                )}
              </Table.Td>
              <Table.Td>
                <Badge
                  color={note.resolved ? 'green' : 'gray'}
                  variant={note.resolved ? 'filled' : 'light'}
                  leftSection={note.resolved ? <IconCheck size={12} /> : null}
                >
                  {note.resolved ? t('resolved') : t('open')}
                </Badge>
              </Table.Td>
              {(canEdit || canDelete) && (
                <Table.Td>
                  <Group gap="xs" justify="center">
                    {canEdit && onEdit && (
                      <Tooltip label={t('editNote')}>
                        <ActionIcon
                          variant="light"
                          color="blue"
                          onClick={() => onEdit(note)}
                        >
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {canDelete && onDelete && (
                      <Tooltip label={t('deleteNote')}>
                        <ActionIcon
                          variant="light"
                          color="red"
                          onClick={() => onDelete(note)}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Paper>
  );
}

// Stats component for disciplinary notes
interface NotesStatsProps {
  statistics: {
    total: number;
    resolved: number;
    unresolved: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
}

export function NotesStats({ statistics }: NotesStatsProps) {
  const t = useTranslations('disciplinary');

  return (
    <Group gap="md" wrap="wrap">
      <Paper withBorder p="md" radius="md" style={{ minWidth: 120 }}>
        <Text size="xs" c="dimmed" tt="uppercase">
          {t('total')}
        </Text>
        <Text size="xl" fw={700}>
          {statistics.total}
        </Text>
      </Paper>
      <Paper withBorder p="md" radius="md" style={{ minWidth: 120 }}>
        <Text size="xs" c="dimmed" tt="uppercase">
          {t('open')}
        </Text>
        <Text size="xl" fw={700} c="orange">
          {statistics.unresolved}
        </Text>
      </Paper>
      <Paper withBorder p="md" radius="md" style={{ minWidth: 120 }}>
        <Text size="xs" c="dimmed" tt="uppercase">
          {t('resolved')}
        </Text>
        <Text size="xl" fw={700} c="green">
          {statistics.resolved}
        </Text>
      </Paper>
      <Paper withBorder p="md" radius="md" style={{ minWidth: 120 }}>
        <Text size="xs" c="dimmed" tt="uppercase">
          {t('types.POSITIVE')}
        </Text>
        <Text size="xl" fw={700} c="teal">
          {statistics.byType.POSITIVE || 0}
        </Text>
      </Paper>
    </Group>
  );
}
