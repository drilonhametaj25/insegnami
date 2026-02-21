'use client';

import {
  Card,
  Group,
  Text,
  Badge,
  Stack,
  ActionIcon,
  Menu,
  rem,
  Tooltip,
} from '@mantine/core';
import {
  IconDotsVertical,
  IconCheck,
  IconX,
  IconCircleCheck,
  IconEdit,
  IconTrash,
  IconClock,
  IconCalendar,
  IconUser,
  IconMapPin,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import {
  ParentMeeting,
  getStatusColor,
  formatMeetingDateTime,
  canConfirmMeeting,
  canCancelMeeting,
  canCompleteMeeting,
  canEditMeeting,
  canDeleteMeeting,
  isMeetingInPast,
} from '@/lib/hooks/useParentMeetings';

interface MeetingCardProps {
  meeting: ParentMeeting;
  viewAs: 'teacher' | 'parent' | 'admin';
  onConfirm?: (meeting: ParentMeeting) => void;
  onCancel?: (meeting: ParentMeeting) => void;
  onComplete?: (meeting: ParentMeeting) => void;
  onEdit?: (meeting: ParentMeeting) => void;
  onDelete?: (meeting: ParentMeeting) => void;
  onClick?: (meeting: ParentMeeting) => void;
}

export function MeetingCard({
  meeting,
  viewAs,
  onConfirm,
  onCancel,
  onComplete,
  onEdit,
  onDelete,
  onClick,
}: MeetingCardProps) {
  const t = useTranslations('meetings');

  const isPast = isMeetingInPast(meeting.date);
  const statusColor = getStatusColor(meeting.status);

  const showConfirm = viewAs !== 'parent' && canConfirmMeeting(meeting) && onConfirm;
  const showCancel = canCancelMeeting(meeting) && onCancel;
  const showComplete = viewAs !== 'parent' && canCompleteMeeting(meeting) && onComplete;
  const showEdit = canEditMeeting(meeting) && onEdit;
  const showDelete = canDeleteMeeting(meeting) && onDelete;

  const hasActions = showConfirm || showCancel || showComplete || showEdit || showDelete;

  return (
    <Card
      shadow="sm"
      padding="md"
      radius="md"
      withBorder
      style={{
        cursor: onClick ? 'pointer' : 'default',
        opacity: isPast && meeting.status !== 'COMPLETED' ? 0.7 : 1,
      }}
      onClick={() => onClick?.(meeting)}
    >
      <Group justify="space-between" mb="xs">
        <Badge color={statusColor} variant="light" size="sm">
          {t(`status.${meeting.status}`)}
        </Badge>

        {hasActions && (
          <Menu shadow="md" width={200} position="bottom-end">
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={(e) => e.stopPropagation()}
              >
                <IconDotsVertical size="1rem" />
              </ActionIcon>
            </Menu.Target>

            <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
              {showConfirm && (
                <Menu.Item
                  leftSection={<IconCheck size={rem(14)} />}
                  color="blue"
                  onClick={() => onConfirm(meeting)}
                >
                  {t('actions.confirm')}
                </Menu.Item>
              )}
              {showComplete && (
                <Menu.Item
                  leftSection={<IconCircleCheck size={rem(14)} />}
                  color="green"
                  onClick={() => onComplete(meeting)}
                >
                  {t('actions.complete')}
                </Menu.Item>
              )}
              {showEdit && (
                <Menu.Item
                  leftSection={<IconEdit size={rem(14)} />}
                  onClick={() => onEdit(meeting)}
                >
                  {t('actions.edit')}
                </Menu.Item>
              )}
              {(showCancel || showDelete) && <Menu.Divider />}
              {showCancel && (
                <Menu.Item
                  leftSection={<IconX size={rem(14)} />}
                  color="orange"
                  onClick={() => onCancel(meeting)}
                >
                  {t('actions.cancel')}
                </Menu.Item>
              )}
              {showDelete && (
                <Menu.Item
                  leftSection={<IconTrash size={rem(14)} />}
                  color="red"
                  onClick={() => onDelete(meeting)}
                >
                  {t('actions.delete')}
                </Menu.Item>
              )}
            </Menu.Dropdown>
          </Menu>
        )}
      </Group>

      <Stack gap="xs">
        {/* Date and time */}
        <Group gap="xs">
          <IconCalendar size="1rem" style={{ color: 'var(--mantine-color-dimmed)' }} />
          <Text size="sm" fw={500}>
            {formatMeetingDateTime(meeting.date)}
          </Text>
        </Group>

        {/* Duration */}
        <Group gap="xs">
          <IconClock size="1rem" style={{ color: 'var(--mantine-color-dimmed)' }} />
          <Text size="sm" c="dimmed">
            {meeting.duration} {t('minutes')}
          </Text>
        </Group>

        {/* Person - show teacher for parent, student for teacher */}
        <Group gap="xs">
          <IconUser size="1rem" style={{ color: 'var(--mantine-color-dimmed)' }} />
          <Text size="sm">
            {viewAs === 'parent' || viewAs === 'admin'
              ? `${meeting.teacher.firstName} ${meeting.teacher.lastName}`
              : `${meeting.student.firstName} ${meeting.student.lastName}`}
          </Text>
        </Group>

        {/* Room if available */}
        {meeting.room && (
          <Group gap="xs">
            <IconMapPin size="1rem" style={{ color: 'var(--mantine-color-dimmed)' }} />
            <Text size="sm" c="dimmed">
              {meeting.room}
            </Text>
          </Group>
        )}
      </Stack>
    </Card>
  );
}
