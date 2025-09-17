import React from 'react';
import {
  Box,
  Text,
  Group,
  Badge,
  ActionIcon,
  ScrollArea,
  Stack,
  Button,
  Divider,
  Paper,
  Anchor,
  Popover,
  Indicator,
  Loader,
} from '@mantine/core';
import {
  IconBell,
  IconBellFilled,
  IconX,
  IconCheck,
  IconExternalLink,
  IconInfoCircle,
  IconAlertTriangle,
  IconCalendar,
  IconMail,
  IconSchool,
  IconCash,
  IconUser,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import {
  useNotifications,
  useUnreadNotificationsCount,
  useMarkNotificationRead,
  useDismissNotification,
  useMarkAllNotificationsRead,
  type Notification
} from '@/lib/hooks/useNotifications';

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'SYSTEM':
      return <IconInfoCircle size={16} />;
    case 'CLASS':
      return <IconSchool size={16} />;
    case 'PAYMENT':
      return <IconCash size={16} />;
    case 'ATTENDANCE':
      return <IconUser size={16} />;
    case 'MESSAGE':
      return <IconMail size={16} />;
    case 'CALENDAR':
      return <IconCalendar size={16} />;
    case 'ANNOUNCEMENT':
      return <IconBell size={16} />;
    case 'REMINDER':
      return <IconAlertTriangle size={16} />;
    default:
      return <IconBell size={16} />;
  }
};

const getNotificationColor = (type: string, priority: string) => {
  if (priority === 'URGENT') return 'red';
  if (priority === 'HIGH') return 'orange';
  
  switch (type) {
    case 'SYSTEM':
      return 'blue';
    case 'CLASS':
      return 'green';
    case 'PAYMENT':
      return 'yellow';
    case 'ATTENDANCE':
      return 'cyan';
    case 'MESSAGE':
      return 'indigo';
    case 'CALENDAR':
      return 'violet';
    case 'ANNOUNCEMENT':
      return 'blue';
    case 'REMINDER':
      return 'orange';
    default:
      return 'gray';
  }
};

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onDismiss: (id: string) => void;
  onNavigate?: (url: string) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onMarkRead,
  onDismiss,
  onNavigate,
}) => {
  const router = useRouter();
  const isUnread = notification.status === 'UNREAD';
  const color = getNotificationColor(notification.type, notification.priority);

  const handleClick = () => {
    if (isUnread) {
      onMarkRead(notification.id);
    }
    if (notification.actionUrl && onNavigate) {
      onNavigate(notification.actionUrl);
    }
  };

  return (
    <Paper
      p="sm"
      withBorder
      style={{
        backgroundColor: isUnread ? 'var(--mantine-color-blue-0)' : undefined,
        borderLeft: `4px solid var(--mantine-color-${color}-6)`,
        cursor: notification.actionUrl ? 'pointer' : 'default',
      }}
      onClick={handleClick}
    >
      <Group justify="space-between" wrap="nowrap">
        <Group flex={1} wrap="nowrap" gap="sm">
          <Box style={{ color: `var(--mantine-color-${color}-6)` }}>
            {getNotificationIcon(notification.type)}
          </Box>
          
          <Box flex={1}>
            <Group justify="space-between" mb={4}>
              <Text fw={isUnread ? 600 : 400} size="sm" truncate>
                {notification.title}
              </Text>
              <Group gap={4}>
                {notification.priority === 'URGENT' && (
                  <Badge color="red" size="xs">
                    Urgente
                  </Badge>
                )}
                {notification.priority === 'HIGH' && (
                  <Badge color="orange" size="xs">
                    Alta
                  </Badge>
                )}
              </Group>
            </Group>
            
            <Text c="dimmed" size="xs" mb={6} lineClamp={2}>
              {notification.content}
            </Text>
            
            <Group justify="space-between">
              <Text c="dimmed" size="xs">
                {formatDistanceToNow(new Date(notification.createdAt), {
                  addSuffix: true,
                  locale: it,
                })}
              </Text>
              
              {notification.actionLabel && notification.actionUrl && (
                <Anchor
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClick();
                  }}
                >
                  {notification.actionLabel}
                  <IconExternalLink size={12} style={{ marginLeft: 4 }} />
                </Anchor>
              )}
            </Group>
          </Box>
        </Group>
        
        <Group gap={4}>
          {isUnread && (
            <ActionIcon
              variant="subtle"
              color="green"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead(notification.id);
              }}
              title="Segna come letta"
            >
              <IconCheck size={14} />
            </ActionIcon>
          )}
          
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(notification.id);
            }}
            title="Rimuovi"
          >
            <IconX size={14} />
          </ActionIcon>
        </Group>
      </Group>
    </Paper>
  );
};

interface NotificationCenterProps {
  limit?: number;
  showHeader?: boolean;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  limit = 10,
  showHeader = true,
}) => {
  const t = useTranslations('common');
  const router = useRouter();
  
  const { data, isLoading } = useNotifications({ limit });
  const markReadMutation = useMarkNotificationRead();
  const dismissMutation = useDismissNotification();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const handleMarkRead = (id: string) => {
    markReadMutation.mutate(id);
  };

  const handleDismiss = (id: string) => {
    dismissMutation.mutate(id);
  };

  const handleNavigate = (url: string) => {
    router.push(url);
  };

  const handleMarkAllRead = () => {
    markAllReadMutation.mutate();
  };

  if (isLoading) {
    return (
      <Box p="md" style={{ textAlign: 'center' }}>
        <Loader size="sm" />
      </Box>
    );
  }

  const notifications = data?.notifications || [];
  const hasUnread = notifications.some(n => n.status === 'UNREAD');

  return (
    <Box>
      {showHeader && (
        <>
          <Group justify="space-between" p="sm">
            <Text fw={600}>Notifiche</Text>
            {hasUnread && (
              <Button
                variant="subtle"
                size="xs"
                onClick={handleMarkAllRead}
                loading={markAllReadMutation.isPending}
              >
                Segna tutte come lette
              </Button>
            )}
          </Group>
          <Divider />
        </>
      )}

      <ScrollArea h={400}>
        {notifications.length === 0 ? (
          <Box p="md" style={{ textAlign: 'center' }}>
            <Text c="dimmed" size="sm">
              Nessuna notifica
            </Text>
          </Box>
        ) : (
          <Stack gap="xs" p="xs">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkRead={handleMarkRead}
                onDismiss={handleDismiss}
                onNavigate={handleNavigate}
              />
            ))}
          </Stack>
        )}
      </ScrollArea>
    </Box>
  );
};

interface NotificationBellProps {
  size?: number;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ size = 20 }) => {
  const { data: unreadCount } = useUnreadNotificationsCount();
  const hasUnread = (unreadCount || 0) > 0;

  return (
    <Popover width={400} position="bottom-end" shadow="md">
      <Popover.Target>
        <ActionIcon variant="subtle" size="lg">
          <Indicator
            disabled={!hasUnread}
            color="red"
            size={16}
            label={unreadCount && unreadCount > 9 ? '9+' : unreadCount}
            offset={4}
          >
            {hasUnread ? (
              <IconBellFilled size={size} />
            ) : (
              <IconBell size={size} />
            )}
          </Indicator>
        </ActionIcon>
      </Popover.Target>
      
      <Popover.Dropdown p={0}>
        <NotificationCenter />
      </Popover.Dropdown>
    </Popover>
  );
};

export default NotificationCenter;
