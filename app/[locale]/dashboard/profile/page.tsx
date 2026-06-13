'use client';

import { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Card,
  Group,
  Stack,
  Avatar,
  Text,
  Badge,
  Divider,
  PasswordInput,
  Button,
  Skeleton,
  Alert,
  ThemeIcon,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconUser,
  IconMail,
  IconBuilding,
  IconLock,
  IconShieldCheck,
  IconAlertCircle,
} from '@tabler/icons-react';

type Role =
  | 'ADMIN'
  | 'DIRECTOR'
  | 'SECRETARY'
  | 'TEACHER'
  | 'STUDENT'
  | 'PARENT'
  | 'SUPERADMIN';

interface ProfileUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: Role;
  tenantId: string | null;
  tenantName: string | null;
}

const ROLE_LABELS: Record<Role, string> = {
  SUPERADMIN: 'Super Admin',
  ADMIN: 'Amministratore',
  DIRECTOR: 'Direttore',
  SECRETARY: 'Segreteria',
  TEACHER: 'Insegnante',
  STUDENT: 'Studente',
  PARENT: 'Genitore',
};

const ROLE_COLORS: Record<Role, string> = {
  SUPERADMIN: 'navy',
  ADMIN: 'navy',
  DIRECTOR: 'navy',
  SECRETARY: 'cyan',
  TEACHER: 'teal',
  STUDENT: 'amber',
  PARENT: 'orange',
};

function getInitials(firstName?: string | null, lastName?: string | null, email?: string) {
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();
  if (f || l) {
    return `${f.charAt(0)}${l.charAt(0)}`.toUpperCase() || (email?.charAt(0).toUpperCase() ?? '?');
  }
  return email?.charAt(0).toUpperCase() ?? '?';
}

export default function ProfilePage() {
  const [user, setUser] = useState<ProfileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    initialValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    validate: {
      currentPassword: (value) =>
        value.trim().length === 0 ? 'Inserisci la password attuale' : null,
      newPassword: (value) => {
        if (value.length < 8) return 'La password deve contenere almeno 8 caratteri';
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
          return 'Deve contenere minuscola, maiuscola e una cifra';
        }
        return null;
      },
      confirmPassword: (value, values) =>
        value !== values.newPassword ? 'Le password non coincidono' : null,
    },
  });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          throw new Error('Impossibile caricare il profilo');
        }
        const data = await res.json();
        if (active) {
          setUser(data.user);
        }
      } catch (err) {
        if (active) {
          setLoadError(err instanceof Error ? err.message : 'Errore nel caricamento del profilo');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = form.onSubmit(async (values) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        notifications.show({
          title: 'Errore',
          message: data?.error || 'Impossibile modificare la password',
          color: 'red',
        });
        return;
      }

      notifications.show({
        title: 'Password aggiornata',
        message: data?.message || 'La tua password è stata modificata con successo',
        color: 'green',
      });
      form.reset();
    } catch {
      notifications.show({
        title: 'Errore',
        message: 'Errore di rete durante la modifica della password',
        color: 'red',
      });
    } finally {
      setSubmitting(false);
    }
  });

  const fullName =
    user && (user.firstName || user.lastName)
      ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
      : user?.email ?? '';

  return (
    <Container size="lg" py="md">
      <Group gap="sm" mb="lg">
        <ThemeIcon size="lg" radius="md" variant="light" color="navy">
          <IconUser size={22} />
        </ThemeIcon>
        <Title order={2}>Il mio profilo</Title>
      </Group>

      <Stack gap="lg">
        {/* Profile card */}
        <Card withBorder padding="lg">
          {loading ? (
            <Group align="center" gap="lg">
              <Skeleton height={80} circle />
              <Stack gap="xs" style={{ flex: 1 }}>
                <Skeleton height={24} width="40%" radius="sm" />
                <Skeleton height={16} width="55%" radius="sm" />
                <Skeleton height={20} width="25%" radius="sm" />
              </Stack>
            </Group>
          ) : loadError ? (
            <Alert
              variant="light"
              color="red"
              icon={<IconAlertCircle size={18} />}
              title="Errore"
            >
              {loadError}
            </Alert>
          ) : user ? (
            <Group align="flex-start" gap="lg" wrap="nowrap">
              <Avatar size={80} radius="xl" color="amber" variant="filled">
                <Text fw={700} fz="xl">
                  {getInitials(user.firstName, user.lastName, user.email)}
                </Text>
              </Avatar>

              <Stack gap={6} style={{ flex: 1, minWidth: 0 }}>
                <Group gap="sm" wrap="wrap">
                  <Title order={3} style={{ wordBreak: 'break-word' }}>
                    {fullName}
                  </Title>
                  <Badge
                    color={ROLE_COLORS[user.role] ?? 'navy'}
                    variant="light"
                    size="lg"
                    radius="sm"
                  >
                    {ROLE_LABELS[user.role] ?? user.role}
                  </Badge>
                </Group>

                <Group gap="xs" c="dimmed">
                  <IconMail size={16} />
                  <Text fz="sm" style={{ wordBreak: 'break-all' }}>
                    {user.email}
                  </Text>
                </Group>

                {user.tenantName && (
                  <Group gap="xs" c="dimmed">
                    <IconBuilding size={16} />
                    <Text fz="sm">{user.tenantName}</Text>
                  </Group>
                )}
              </Stack>
            </Group>
          ) : null}
        </Card>

        {/* Change password card */}
        <Card withBorder padding="lg">
          <Group gap="sm" mb="xs">
            <ThemeIcon size="md" radius="md" variant="light" color="amber">
              <IconLock size={18} />
            </ThemeIcon>
            <Title order={4}>Cambia password</Title>
          </Group>
          <Text fz="sm" c="dimmed" mb="md">
            Usa una password sicura: almeno 8 caratteri, con una lettera minuscola, una
            maiuscola e una cifra.
          </Text>

          <Divider mb="md" />

          <form onSubmit={handleSubmit}>
            <Stack gap="md" maw={460}>
              <PasswordInput
                label="Password attuale"
                placeholder="••••••••"
                withAsterisk
                autoComplete="current-password"
                {...form.getInputProps('currentPassword')}
              />
              <PasswordInput
                label="Nuova password"
                placeholder="••••••••"
                withAsterisk
                autoComplete="new-password"
                {...form.getInputProps('newPassword')}
              />
              <PasswordInput
                label="Conferma nuova password"
                placeholder="••••••••"
                withAsterisk
                autoComplete="new-password"
                {...form.getInputProps('confirmPassword')}
              />

              <Group justify="flex-start" mt="xs">
                <Button
                  type="submit"
                  color="navy"
                  loading={submitting}
                  leftSection={<IconShieldCheck size={18} />}
                >
                  Aggiorna password
                </Button>
              </Group>
            </Stack>
          </form>
        </Card>
      </Stack>
    </Container>
  );
}
