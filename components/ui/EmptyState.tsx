'use client';

import {
  Stack,
  Title,
  Text,
  Button,
  ThemeIcon,
  Paper,
  Group,
  Box,
  rem
} from '@mantine/core';
import {
  IconUsers,
  IconSchool,
  IconBook,
  IconCalendar,
  IconCreditCard,
  IconBell,
  IconClipboard,
  IconPlus,
  IconArrowRight,
  IconFileText,
  IconUserPlus,
  IconBooks
} from '@tabler/icons-react';
import Link from 'next/link';
import { ReactNode, ComponentType } from 'react';

type IconComponent = ComponentType<{ size?: number | string }>;

interface EmptyStateProps {
  icon?: IconComponent;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  secondaryActionHref?: string;
  variant?: 'default' | 'card' | 'minimal';
  color?: string;
  locale?: string;
}

// Predefined empty states for common entities
export const emptyStateConfigs = {
  students: {
    icon: IconUsers,
    title: 'Nessuno studente',
    description: 'Non hai ancora aggiunto studenti. Inizia creando il primo profilo studente.',
    actionLabel: 'Aggiungi Studente',
    actionHref: '/dashboard/students',
    color: 'blue',
  },
  teachers: {
    icon: IconSchool,
    title: 'Nessun insegnante',
    description: 'Non hai ancora aggiunto insegnanti. Aggiungi i docenti per iniziare a gestire le lezioni.',
    actionLabel: 'Aggiungi Insegnante',
    actionHref: '/dashboard/teachers',
    color: 'green',
  },
  classes: {
    icon: IconBook,
    title: 'Nessuna classe',
    description: 'Non hai ancora creato classi. Crea la prima classe per organizzare gli studenti.',
    actionLabel: 'Crea Classe',
    actionHref: '/dashboard/classes',
    color: 'violet',
  },
  lessons: {
    icon: IconCalendar,
    title: 'Nessuna lezione',
    description: 'Non hai ancora programmato lezioni. Pianifica la prima lezione per iniziare.',
    actionLabel: 'Pianifica Lezione',
    actionHref: '/dashboard/lessons/new',
    color: 'cyan',
  },
  payments: {
    icon: IconCreditCard,
    title: 'Nessun pagamento',
    description: 'Non ci sono pagamenti registrati. I pagamenti appariranno qui quando saranno creati.',
    actionLabel: 'Registra Pagamento',
    actionHref: '/dashboard/payments',
    color: 'orange',
  },
  notices: {
    icon: IconBell,
    title: 'Nessun avviso',
    description: 'Non ci sono avvisi da mostrare. Crea un avviso per comunicare con studenti e genitori.',
    actionLabel: 'Crea Avviso',
    actionHref: '/dashboard/notices',
    color: 'pink',
  },
  attendance: {
    icon: IconClipboard,
    title: 'Nessuna presenza registrata',
    description: 'Non ci sono presenze registrate. Le presenze appariranno qui dopo le lezioni.',
    actionLabel: 'Vai alle Lezioni',
    actionHref: '/dashboard/lessons',
    color: 'teal',
  },
  grades: {
    icon: IconFileText,
    title: 'Nessun voto',
    description: 'Non ci sono voti registrati. Inizia a inserire i voti per gli studenti.',
    actionLabel: 'Inserisci Voti',
    actionHref: '/dashboard/grades',
    color: 'yellow',
  },
  homework: {
    icon: IconBooks,
    title: 'Nessun compito',
    description: 'Non ci sono compiti assegnati. Assegna il primo compito alla classe.',
    actionLabel: 'Assegna Compito',
    actionHref: '/dashboard/homework',
    color: 'indigo',
  },
  users: {
    icon: IconUserPlus,
    title: 'Nessun utente',
    description: 'Non ci sono altri utenti. Invita colleghi per collaborare.',
    actionLabel: 'Invita Utente',
    actionHref: '/dashboard/admin/users',
    color: 'grape',
  },
};

export function EmptyState({
  icon: Icon = IconUsers,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryActionLabel,
  secondaryActionHref,
  variant = 'default',
  color = 'blue',
  locale,
}: EmptyStateProps) {
  const resolvedActionHref = actionHref && locale ? `/${locale}${actionHref}` : actionHref;
  const resolvedSecondaryHref = secondaryActionHref && locale ? `/${locale}${secondaryActionHref}` : secondaryActionHref;

  const content = (
    <Stack align="center" gap="lg" py={variant === 'minimal' ? 'md' : 'xl'}>
      <ThemeIcon
        size={variant === 'minimal' ? 60 : 80}
        radius="xl"
        color={color}
        variant="light"
      >
        <Icon size={variant === 'minimal' ? 30 : 40} />
      </ThemeIcon>

      <Stack gap="xs" align="center" maw={400}>
        <Title order={variant === 'minimal' ? 4 : 3} ta="center">
          {title}
        </Title>
        <Text c="dimmed" ta="center" size={variant === 'minimal' ? 'sm' : 'md'}>
          {description}
        </Text>
      </Stack>

      {(actionLabel || secondaryActionLabel) && (
        <Group gap="sm">
          {actionLabel && (
            resolvedActionHref ? (
              <Button
                component={Link}
                href={resolvedActionHref}
                leftSection={<IconPlus size={18} />}
                color={color}
                size={variant === 'minimal' ? 'sm' : 'md'}
              >
                {actionLabel}
              </Button>
            ) : (
              <Button
                onClick={onAction}
                leftSection={<IconPlus size={18} />}
                color={color}
                size={variant === 'minimal' ? 'sm' : 'md'}
              >
                {actionLabel}
              </Button>
            )
          )}
          {secondaryActionLabel && resolvedSecondaryHref && (
            <Button
              component={Link}
              href={resolvedSecondaryHref}
              variant="light"
              color="gray"
              rightSection={<IconArrowRight size={16} />}
              size={variant === 'minimal' ? 'sm' : 'md'}
            >
              {secondaryActionLabel}
            </Button>
          )}
        </Group>
      )}
    </Stack>
  );

  if (variant === 'card') {
    return (
      <Paper p="xl" radius="md" withBorder>
        {content}
      </Paper>
    );
  }

  return content;
}

// Pre-configured empty states for easy usage
export function StudentsEmptyState({ locale }: { locale: string }) {
  return <EmptyState {...emptyStateConfigs.students} locale={locale} />;
}

export function TeachersEmptyState({ locale }: { locale: string }) {
  return <EmptyState {...emptyStateConfigs.teachers} locale={locale} />;
}

export function ClassesEmptyState({ locale }: { locale: string }) {
  return <EmptyState {...emptyStateConfigs.classes} locale={locale} />;
}

export function LessonsEmptyState({ locale }: { locale: string }) {
  return <EmptyState {...emptyStateConfigs.lessons} locale={locale} />;
}

export function PaymentsEmptyState({ locale }: { locale: string }) {
  return <EmptyState {...emptyStateConfigs.payments} locale={locale} />;
}

export function NoticesEmptyState({ locale }: { locale: string }) {
  return <EmptyState {...emptyStateConfigs.notices} locale={locale} />;
}

export function AttendanceEmptyState({ locale }: { locale: string }) {
  return <EmptyState {...emptyStateConfigs.attendance} locale={locale} />;
}

export function GradesEmptyState({ locale }: { locale: string }) {
  return <EmptyState {...emptyStateConfigs.grades} locale={locale} />;
}

export function HomeworkEmptyState({ locale }: { locale: string }) {
  return <EmptyState {...emptyStateConfigs.homework} locale={locale} />;
}

export function UsersEmptyState({ locale }: { locale: string }) {
  return <EmptyState {...emptyStateConfigs.users} locale={locale} />;
}

// Quick access component
export function EmptyStateByType({ type, variant = 'default', locale }: { type: keyof typeof emptyStateConfigs; variant?: 'default' | 'card' | 'minimal'; locale: string }) {
  const config = emptyStateConfigs[type];
  return <EmptyState {...config} variant={variant} locale={locale} />;
}
