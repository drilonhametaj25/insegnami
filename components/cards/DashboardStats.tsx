'use client';

import { Paper, Group, Text, ThemeIcon, SimpleGrid, Progress, Badge, Stack } from '@mantine/core';
import { 
  IconUsers, 
  IconBook, 
  IconCalendar, 
  IconCurrencyEuro, 
  IconTrendingUp, 
  IconTrendingDown,
  IconMinus,
  IconCheck,
  IconClock,
  IconAlertTriangle
} from '@tabler/icons-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
    period: string;
  };
  progress?: {
    value: number;
    label: string;
    color: string;
  };
  badge?: {
    text: string;
    color: string;
  };
}

function StatCard({ title, value, icon, color, change, progress, badge }: StatCardProps) {
  const getTrendIcon = () => {
    if (!change) return null;
    
    switch (change.type) {
      case 'increase':
        return <IconTrendingUp size={14} />;
      case 'decrease':
        return <IconTrendingDown size={14} />;
      default:
        return <IconMinus size={14} />;
    }
  };

  const getTrendColor = () => {
    if (!change) return 'gray';
    
    switch (change.type) {
      case 'increase':
        return 'green';
      case 'decrease':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <Paper 
      withBorder 
      p="lg" 
      radius="xl" 
      style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid #e2e8f0',
        transition: 'all 0.2s ease',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 12px 24px -4px rgb(0 0 0 / 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0px)';
        e.currentTarget.style.boxShadow = '0 1px 3px 0 rgb(0 0 0 / 0.1)';
      }}
    >
      <Group justify="space-between">
        <div>
          <Text c="dimmed" size="sm" mb={4}>
            {title}
          </Text>
          <Group align="flex-end" gap="xs">
            <Text size="xl" fw={700}>
              {value}
            </Text>
            {badge && (
              <Badge color={badge.color} variant="light" size="sm">
                {badge.text}
              </Badge>
            )}
          </Group>
          {change && (
            <Group gap={4} mt={4}>
              <ThemeIcon
                color={getTrendColor()}
                variant="light"
                size="sm"
                radius="xl"
              >
                {getTrendIcon()}
              </ThemeIcon>
              <Text size="xs" c={getTrendColor()}>
                {change.value > 0 ? '+' : ''}{change.value}% {change.period}
              </Text>
            </Group>
          )}
          {progress && (
            <Stack gap={4} mt="md">
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  {progress.label}
                </Text>
                <Text size="xs" fw={500}>
                  {progress.value}%
                </Text>
              </Group>
              <Progress value={progress.value} color={progress.color} size="sm" />
            </Stack>
          )}
        </div>
        <ThemeIcon
          color={color}
          variant="light"
          size="xl"
          radius="md"
        >
          {icon}
        </ThemeIcon>
      </Group>
    </Paper>
  );
}

interface DashboardStatsProps {
  role: 'ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';
  data?: {
    students?: number;
    teachers?: number;
    classes?: number;
    lessons?: number;
    revenue?: number;
    attendance?: number;
    pendingPayments?: number;
    upcomingLessons?: number;
  };
}

export default function DashboardStats({ role, data }: DashboardStatsProps) {
  // Sample data if none provided
  const defaultData = {
    students: 156,
    teachers: 12,
    classes: 18,
    lessons: 45,
    revenue: 12500,
    attendance: 87,
    pendingPayments: 8,
    upcomingLessons: 12,
  };

  const stats = { ...defaultData, ...data };

  const getStatsForRole = () => {
    switch (role) {
      case 'ADMIN':
        return [
          {
            title: 'Studenti Attivi',
            value: stats.students,
            icon: <IconUsers size={24} />,
            color: 'blue',
            change: {
              value: 12,
              type: 'increase' as const,
              period: 'questo mese',
            },
            progress: {
              value: 78,
              label: 'Capacità utilizzo',
              color: 'blue',
            },
          },
          {
            title: 'Docenti',
            value: stats.teachers,
            icon: <IconBook size={24} />,
            color: 'green',
            badge: {
              text: `${Math.floor(stats.students / stats.teachers)} std/doc`,
              color: 'green',
            },
          },
          {
            title: 'Classi Attive',
            value: stats.classes,
            icon: <IconCalendar size={24} />,
            color: 'violet',
            change: {
              value: 5,
              type: 'increase' as const,
              period: 'ultimo trimestre',
            },
          },
          {
            title: 'Fatturato Mensile',
            value: `€${stats.revenue.toLocaleString()}`,
            icon: <IconCurrencyEuro size={24} />,
            color: 'orange',
            change: {
              value: 8,
              type: 'increase' as const,
              period: 'vs mese scorso',
            },
            badge: {
              text: `${stats.pendingPayments} in sospeso`,
              color: 'yellow',
            },
          },
          {
            title: 'Presenze Medie',
            value: `${stats.attendance}%`,
            icon: <IconCheck size={24} />,
            color: 'teal',
            progress: {
              value: stats.attendance,
              label: 'Obiettivo: 90%',
              color: stats.attendance >= 90 ? 'green' : stats.attendance >= 80 ? 'yellow' : 'red',
            },
          },
          {
            title: 'Lezioni Oggi',
            value: stats.lessons,
            icon: <IconClock size={24} />,
            color: 'indigo',
            badge: {
              text: `${stats.upcomingLessons} prossime`,
              color: 'blue',
            },
          },
        ];

      case 'TEACHER':
        return [
          {
            title: 'I Miei Studenti',
            value: 42,
            icon: <IconUsers size={24} />,
            color: 'blue',
            progress: {
              value: 85,
              label: 'Frequenza media',
              color: 'blue',
            },
          },
          {
            title: 'Classi Assegnate',
            value: 6,
            icon: <IconBook size={24} />,
            color: 'green',
          },
          {
            title: 'Lezioni Oggi',
            value: 4,
            icon: <IconCalendar size={24} />,
            color: 'violet',
            badge: {
              text: '2 completate',
              color: 'green',
            },
          },
          {
            title: 'Presenze da Confermare',
            value: 12,
            icon: <IconAlertTriangle size={24} />,
            color: 'orange',
            badge: {
              text: 'Urgente',
              color: 'red',
            },
          },
        ];

      case 'STUDENT':
        return [
          {
            title: 'Corsi Attivi',
            value: 3,
            icon: <IconBook size={24} />,
            color: 'blue',
          },
          {
            title: 'Lezioni Questa Settimana',
            value: 8,
            icon: <IconCalendar size={24} />,
            color: 'green',
            badge: {
              text: '2 completate',
              color: 'green',
            },
          },
          {
            title: 'Frequenza',
            value: '92%',
            icon: <IconCheck size={24} />,
            color: 'teal',
            progress: {
              value: 92,
              label: 'Obiettivo personale',
              color: 'green',
            },
          },
          {
            title: 'Prossima Lezione',
            value: 'Oggi 15:00',
            icon: <IconClock size={24} />,
            color: 'violet',
            badge: {
              text: 'Inglese Avanzato',
              color: 'blue',
            },
          },
        ];

      case 'PARENT':
        return [
          {
            title: 'Figli Iscritti',
            value: 2,
            icon: <IconUsers size={24} />,
            color: 'blue',
          },
          {
            title: 'Corsi Attivi',
            value: 4,
            icon: <IconBook size={24} />,
            color: 'green',
          },
          {
            title: 'Frequenza Media',
            value: '89%',
            icon: <IconCheck size={24} />,
            color: 'teal',
            progress: {
              value: 89,
              label: 'Ultimo mese',
              color: 'yellow',
            },
          },
          {
            title: 'Pagamenti in Sospeso',
            value: '€320',
            icon: <IconCurrencyEuro size={24} />,
            color: 'orange',
            badge: {
              text: 'Scade in 3 giorni',
              color: 'red',
            },
          },
        ];

      default:
        return [];
    }
  };

  const statsData = getStatsForRole();

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      {statsData.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </SimpleGrid>
  );
}
