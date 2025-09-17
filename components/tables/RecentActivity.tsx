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

interface Activity {
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
  // Sample data if none provided
  const defaultActivities: Activity[] = [
    {
      id: '1',
      type: 'student_enrolled',
      title: 'Nuovo studente iscritto',
      description: 'Marco Verdi si è iscritto al corso Inglese Base A',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      user: {
        name: 'Admin Sistema',
        role: 'Admin',
      },
      metadata: {
        className: 'Inglese Base A',
        studentName: 'Marco Verdi',
      },
    },
    {
      id: '2',
      type: 'lesson_completed',
      title: 'Lezione completata',
      description: 'Inglese Avanzato B - Lezione del 16/09/2025',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
      user: {
        name: 'Anna Bianchi',
        role: 'Docente',
      },
      metadata: {
        status: 'completed',
        className: 'Inglese Avanzato B',
      },
    },
    {
      id: '3',
      type: 'payment_received',
      title: 'Pagamento ricevuto',
      description: 'Pagamento mensile per il corso di Conversazione',
      timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
      user: {
        name: 'Luigi Rossi',
        role: 'Studente',
      },
      metadata: {
        amount: 150,
        status: 'paid',
      },
    },
    {
      id: '4',
      type: 'attendance_marked',
      title: 'Presenze registrate',
      description: '15 presenze confermate per la classe Inglese Base A',
      timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
      user: {
        name: 'Mario Rossi',
        role: 'Docente',
      },
      metadata: {
        status: 'present',
        className: 'Inglese Base A',
      },
    },
    {
      id: '5',
      type: 'notice_published',
      title: 'Nuovo avviso pubblicato',
      description: 'Comunicazione importante riguardo agli orari delle lezioni',
      timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
      user: {
        name: 'Direzione Scuola',
        role: 'Admin',
      },
    },
    {
      id: '6',
      type: 'class_created',
      title: 'Nuova classe creata',
      description: 'Inglese Business - Corso per professionisti',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      user: {
        name: 'Admin Sistema',
        role: 'Admin',
      },
      metadata: {
        className: 'Inglese Business',
      },
    },
  ];

  const displayActivities = (activities || defaultActivities).slice(0, maxItems);

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

      {(activities || defaultActivities).length > maxItems && (
        <>
          <Divider my="md" />
          <Group justify="center">
            <Text size="sm" c="dimmed">
              +{(activities || defaultActivities).length - maxItems} altre attività
            </Text>
          </Group>
        </>
      )}
    </Paper>
  );
}
