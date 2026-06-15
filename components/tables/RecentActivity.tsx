'use client';

import { 
  Paper, 
  Group, 
  Text, 
  Avatar, 
  Timeline, 
  ThemeIcon, 
  Badge,
  Stack,
  ActionIcon,
  Menu,
  Divider
} from '@mantine/core';
import { 
  IconUser,
  IconBook,
  IconCalendar,
  IconCurrencyEuro,
  IconCheck,
  IconX,
  IconClock,
  IconBell,
  IconDots,
  IconEye,
  IconEdit,
  IconTrash
} from '@tabler/icons-react';
import moment from 'moment';

export interface Activity {
  id: string;
  type: 'student_enrolled' | 'lesson_completed' | 'payment_received' | 'attendance_marked' | 'notice_published' | 'class_created';
  title: string;
  description: string;
  timestamp: Date;
  user?: {
    name: string;
    avatar?: string;
    role: string;
  };
  metadata?: {
    amount?: number;
    status?: string;
    className?: string;
    studentName?: string;
  };
}

interface RecentActivityProps {
  activities?: Activity[];
  maxItems?: number;
  showActions?: boolean;
  onViewDetails?: (activity: Activity) => void;
  onEdit?: (activity: Activity) => void;
  onDelete?: (activity: Activity) => void;
}

function getActivityIcon(type: Activity['type']) {
  switch (type) {
    case 'student_enrolled':
      return <IconUser size={16} />;
    case 'lesson_completed':
      return <IconBook size={16} />;
    case 'payment_received':
      return <IconCurrencyEuro size={16} />;
    case 'attendance_marked':
      return <IconCheck size={16} />;
    case 'notice_published':
      return <IconBell size={16} />;
    case 'class_created':
      return <IconCalendar size={16} />;
    default:
      return <IconClock size={16} />;
  }
}

function getActivityColor(type: Activity['type']) {
  switch (type) {
    case 'student_enrolled':
      return 'blue';
    case 'lesson_completed':
      return 'green';
    case 'payment_received':
      return 'orange';
    case 'attendance_marked':
      return 'teal';
    case 'notice_published':
      return 'violet';
    case 'class_created':
      return 'indigo';
    default:
      return 'gray';
  }
}

function getStatusBadge(status?: string) {
  if (!status) return null;
  
  let color = 'gray';
  switch (status.toLowerCase()) {
    case 'completed':
    case 'paid':
    case 'present':
      color = 'green';
      break;
    case 'pending':
    case 'scheduled':
      color = 'yellow';
      break;
    case 'cancelled':
    case 'absent':
      color = 'red';
      break;
  }
  
  return (
    <Badge color={color} variant="light" size="xs">
      {status}
    </Badge>
  );
}

export default function RecentActivity({ 
  activities, 
  maxItems = 10, 
  showActions = false,
  onViewDetails,
  onEdit,
  onDelete
}: RecentActivityProps) {
  const allActivities = activities ?? [];
  const displayActivities = allActivities.slice(0, maxItems);

  const formatTimeAgo = (date: Date) => {
    const now = moment();
    const activityTime = moment(date);
    const diffHours = now.diff(activityTime, 'hours');
    const diffDays = now.diff(activityTime, 'days');

    if (diffDays > 0) {
      return `${diffDays} giorn${diffDays === 1 ? 'o' : 'i'} fa`;
    } else if (diffHours > 0) {
      return `${diffHours} or${diffHours === 1 ? 'a' : 'e'} fa`;
    } else {
      const diffMinutes = now.diff(activityTime, 'minutes');
      return `${diffMinutes} minut${diffMinutes === 1 ? 'o' : 'i'} fa`;
    }
  };

  return (
    <Paper withBorder p="lg" radius="md">
      <Group justify="space-between" mb="lg">
        <Text size="lg" fw={600}>
          Attività Recenti
        </Text>
        <Badge variant="light" color="gray">
          {displayActivities.length} elementi
        </Badge>
      </Group>

      {displayActivities.length === 0 ? (
        <Stack align="center" gap="xs" py="xl">
          <ThemeIcon color="gray" size={48} radius="xl" variant="light">
            <IconClock size={24} />
          </ThemeIcon>
          <Text c="dimmed" size="sm" ta="center">
            Nessuna attività recente
          </Text>
        </Stack>
      ) : (
      <Timeline active={displayActivities.length} bulletSize={24} lineWidth={2}>
        {displayActivities.map((activity, index) => (
          <Timeline.Item
            key={activity.id}
            bullet={
              <ThemeIcon
                color={getActivityColor(activity.type)}
                size={24}
                radius="xl"
                variant="light"
              >
                {getActivityIcon(activity.type)}
              </ThemeIcon>
            }
            title={
              <Group justify="space-between" align="flex-start">
                <div>
                  <Group gap="xs" align="flex-start">
                    <Text fw={500} size="sm">
                      {activity.title}
                    </Text>
                    {getStatusBadge(activity.metadata?.status)}
                  </Group>
                  {activity.metadata?.amount && (
                    <Text size="xs" c="green" fw={600}>
                      €{activity.metadata.amount}
                    </Text>
                  )}
                </div>
                {showActions && (
                  <Menu shadow="md" width={200}>
                    <Menu.Target>
                      <ActionIcon variant="light" size="sm">
                        <IconDots size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconEye size={14} />}
                        onClick={() => onViewDetails?.(activity)}
                      >
                        Visualizza
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconEdit size={14} />}
                        onClick={() => onEdit?.(activity)}
                      >
                        Modifica
                      </Menu.Item>
                      <Menu.Divider />
                      <Menu.Item
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => onDelete?.(activity)}
                      >
                        Elimina
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                )}
              </Group>
            }
          >
            <Text c="dimmed" size="sm" mb="xs">
              {activity.description}
            </Text>
            
            <Group gap="xs" align="center">
              {activity.user && (
                <>
                  <Avatar size="xs" color="blue">
                    {activity.user.name.split(' ').map(n => n[0]).join('')}
                  </Avatar>
                  <Text size="xs" c="dimmed">
                    {activity.user.name} • {activity.user.role}
                  </Text>
                  <Text size="xs" c="dimmed">•</Text>
                </>
              )}
              <Text size="xs" c="dimmed">
                {formatTimeAgo(activity.timestamp)}
              </Text>
            </Group>

            {activity.metadata?.className && (
              <Badge variant="outline" size="xs" mt="xs">
                {activity.metadata.className}
              </Badge>
            )}
          </Timeline.Item>
        ))}
      </Timeline>
      )}

      {allActivities.length > maxItems && (
        <>
          <Divider my="md" />
          <Group justify="center">
            <Text size="sm" c="dimmed">
              +{allActivities.length - maxItems} altre attività
            </Text>
          </Group>
        </>
      )}
    </Paper>
  );
}
