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
  IconAlertTriangle,
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
        transition: 'all 0.2s ease',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 12px 24px -4px rgb(0 0 0 / 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0px)';
        e.currentTarget.style.boxShadow = '';
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
  role: 'ADMIN' | 'DIRECTOR' | 'SECRETARY' | 'TEACHER' | 'STUDENT' | 'PARENT';
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

// Helper: attendance progress (real ratio) with traffic-light color.
// Returns undefined when no attendance value was provided so we don't fake a bar.
function attendanceProgress(attendance: number | undefined, label: string) {
  if (attendance === undefined || attendance === null) return undefined;
  const value = Math.round(attendance);
  return {
    value,
    label,
    color: value >= 90 ? 'green' : value >= 80 ? 'amber' : 'red',
  };
}

export default function DashboardStats({ role, data }: DashboardStatsProps) {
  // No fake fallbacks: when a metric is missing we show 0 / empty, not invented numbers.
  const d = data ?? {};

  const getStatsForRole = (): StatCardProps[] => {
    switch (role) {
      case 'ADMIN':
      case 'DIRECTOR':
      case 'SECRETARY': {
        const students = d.students ?? 0;
        const teachers = d.teachers ?? 0;
        const classes = d.classes ?? 0;
        const lessons = d.lessons ?? 0;
        const revenue = d.revenue ?? 0;

        return [
          {
            title: 'Studenti Attivi',
            value: students,
            icon: <IconUsers size={24} />,
            color: 'navy',
            // ratio reale studenti/classe come badge informativo (niente trend inventato)
            ...(classes > 0
              ? { badge: { text: `${(students / classes).toFixed(1)} std/classe`, color: 'navy' } }
              : {}),
          },
          {
            title: 'Docenti',
            value: teachers,
            icon: <IconBook size={24} />,
            color: 'green',
            // ratio reale studenti/docente (solo se ci sono docenti)
            ...(teachers > 0
              ? { badge: { text: `${Math.round(students / teachers)} std/doc`, color: 'green' } }
              : {}),
          },
          {
            title: 'Classi Attive',
            value: classes,
            icon: <IconCalendar size={24} />,
            color: 'navy',
          },
          {
            title: 'Fatturato (30gg)',
            value: `€${revenue.toLocaleString('it-IT')}`,
            icon: <IconCurrencyEuro size={24} />,
            color: 'amber',
            // badge solo se ci sono davvero pagamenti in sospeso
            ...(d.pendingPayments && d.pendingPayments > 0
              ? { badge: { text: `${d.pendingPayments} in sospeso`, color: 'amber' } }
              : {}),
          },
          {
            title: 'Presenze Medie',
            value: d.attendance !== undefined ? `${Math.round(d.attendance)}%` : '—',
            icon: <IconCheck size={24} />,
            color: 'teal',
            // progress basata sul rapporto presenze REALE (se fornito)
            ...(attendanceProgress(d.attendance, 'Obiettivo: 90%')
              ? { progress: attendanceProgress(d.attendance, 'Obiettivo: 90%') }
              : {}),
          },
          {
            title: 'Lezioni (30gg)',
            value: lessons,
            icon: <IconClock size={24} />,
            color: 'navy',
            ...(d.upcomingLessons && d.upcomingLessons > 0
              ? { badge: { text: `${d.upcomingLessons} prossime`, color: 'navy' } }
              : {}),
          },
        ];
      }

      case 'TEACHER': {
        const students = d.students ?? 0;
        const classes = d.classes ?? 0;
        const lessons = d.lessons ?? 0;
        const pending = d.pendingPayments ?? 0;

        return [
          {
            title: 'I Miei Studenti',
            value: students,
            icon: <IconUsers size={24} />,
            color: 'navy',
            ...(attendanceProgress(d.attendance, 'Frequenza media')
              ? { progress: attendanceProgress(d.attendance, 'Frequenza media') }
              : {}),
          },
          {
            title: 'Classi Assegnate',
            value: classes,
            icon: <IconBook size={24} />,
            color: 'green',
          },
          {
            title: 'Lezioni Oggi',
            value: lessons,
            icon: <IconCalendar size={24} />,
            color: 'navy',
            ...(d.upcomingLessons && d.upcomingLessons > 0
              ? { badge: { text: `${d.upcomingLessons} prossime`, color: 'navy' } }
              : {}),
          },
          {
            title: 'Presenze da Confermare',
            value: pending,
            icon: <IconAlertTriangle size={24} />,
            color: 'amber',
            ...(pending > 0 ? { badge: { text: 'Da gestire', color: 'red' } } : {}),
          },
        ];
      }

      case 'STUDENT': {
        const classes = d.classes ?? 0;
        const lessons = d.lessons ?? 0;

        return [
          {
            title: 'Corsi Attivi',
            value: classes,
            icon: <IconBook size={24} />,
            color: 'navy',
          },
          {
            title: 'Lezioni (settimana)',
            value: lessons,
            icon: <IconCalendar size={24} />,
            color: 'green',
            ...(d.upcomingLessons && d.upcomingLessons > 0
              ? { badge: { text: `${d.upcomingLessons} prossime`, color: 'navy' } }
              : {}),
          },
          {
            title: 'Frequenza',
            value: d.attendance !== undefined ? `${Math.round(d.attendance)}%` : '—',
            icon: <IconCheck size={24} />,
            color: 'teal',
            ...(attendanceProgress(d.attendance, 'Le tue presenze')
              ? { progress: attendanceProgress(d.attendance, 'Le tue presenze') }
              : {}),
          },
          {
            title: 'Pagamenti in Sospeso',
            value: d.pendingPayments ?? 0,
            icon: <IconClock size={24} />,
            color: 'amber',
          },
        ];
      }

      case 'PARENT': {
        const students = d.students ?? 0;
        const classes = d.classes ?? 0;
        const pendingAmount = d.revenue ?? 0;

        return [
          {
            title: 'Figli Iscritti',
            value: students,
            icon: <IconUsers size={24} />,
            color: 'navy',
          },
          {
            title: 'Corsi Attivi',
            value: classes,
            icon: <IconBook size={24} />,
            color: 'green',
          },
          {
            title: 'Frequenza Media',
            value: d.attendance !== undefined ? `${Math.round(d.attendance)}%` : '—',
            icon: <IconCheck size={24} />,
            color: 'teal',
            ...(attendanceProgress(d.attendance, 'Ultimo periodo')
              ? { progress: attendanceProgress(d.attendance, 'Ultimo periodo') }
              : {}),
          },
          {
            title: 'Pagamenti in Sospeso',
            value: `€${pendingAmount.toLocaleString('it-IT')}`,
            icon: <IconCurrencyEuro size={24} />,
            color: 'amber',
            ...(d.pendingPayments && d.pendingPayments > 0
              ? { badge: { text: `${d.pendingPayments} da saldare`, color: 'red' } }
              : {}),
          },
        ];
      }

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
