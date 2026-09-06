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
  TextInput,
  Button,
  Skeleton,
  Alert,
  ThemeIcon,
  Switch,
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
  IconBell,
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

// Tipi di notifica principali gestibili dalle preferenze
const NOTIFICATION_TYPE_LABELS: Array<{ key: string; label: string }> = [
  { key: 'PAYMENT', label: 'Pagamenti e scadenze' },
  { key: 'ATTENDANCE', label: 'Presenze e assenze' },
  { key: 'ANNOUNCEMENT', label: 'Avvisi e annunci' },
  { key: 'CLASS', label: 'Lezioni e classi' },
  { key: 'MESSAGE', label: 'Messaggi' },
  { key: 'REMINDER', label: 'Promemoria' },
];

interface NotificationPrefs {
  emailEnabled: boolean;
  typePreferences: Record<string, boolean>;
  quietHoursEnabled: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

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

  // Preferenze notifiche
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsSaving, setPrefsSaving] = useState(false);

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

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/notifications/preferences');
        if (!res.ok) throw new Error('Impossibile caricare le preferenze');
        const json = await res.json();
        if (active) {
          const d = json.data ?? {};
          setPrefs({
            emailEnabled: d.emailEnabled ?? true,
            typePreferences: (d.typePreferences as Record<string, boolean>) ?? {},
            quietHoursEnabled: d.quietHoursEnabled ?? false,
            quietHoursStart: d.quietHoursStart ?? null,
            quietHoursEnd: d.quietHoursEnd ?? null,
          });
        }
      } catch {
        // Non blocca il resto della pagina: default in memoria
        if (active) {
          setPrefs({
            emailEnabled: true,
            typePreferences: {},
            quietHoursEnabled: false,
            quietHoursStart: null,
            quietHoursEnd: null,
          });
        }
      } finally {
        if (active) setPrefsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const savePrefs = async () => {
    if (!prefs) return;
    if (prefs.quietHoursEnabled && (!prefs.quietHoursStart || !prefs.quietHoursEnd)) {
      notifications.show({
        title: 'Ore di silenzio incomplete',
        message: 'Imposta orario di inizio e fine (formato HH:MM)',
        color: 'red',
      });
      return;
    }
    setPrefsSaving(true);
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailEnabled: prefs.emailEnabled,
          typePreferences: prefs.typePreferences,
          quietHoursEnabled: prefs.quietHoursEnabled,
          quietHoursStart: prefs.quietHoursStart || null,
          quietHoursEnd: prefs.quietHoursEnd || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notifications.show({
          title: 'Errore',
          message: data?.error || 'Impossibile salvare le preferenze',
          color: 'red',
        });
        return;
      }
      notifications.show({
        title: 'Preferenze salvate',
        message: 'Le tue preferenze di notifica sono state aggiornate',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Errore',
        message: 'Errore di rete durante il salvataggio delle preferenze',
        color: 'red',
      });
    } finally {
      setPrefsSaving(false);
    }
  };

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

        {/* Notification preferences card */}
        <Card withBorder padding="lg">
          <Group gap="sm" mb="xs">
            <ThemeIcon size="md" radius="md" variant="light" color="teal">
              <IconBell size={18} />
            </ThemeIcon>
            <Title order={4}>Notifiche</Title>
          </Group>
          <Text fz="sm" c="dimmed" mb="md">
            Scegli quali notifiche ricevere via email e quando non essere disturbato.
            Le notifiche in-app restano sempre visibili nella campanella.
          </Text>

          <Divider mb="md" />

          {prefsLoading || !prefs ? (
            <Stack gap="xs" maw={460}>
              <Skeleton height={24} radius="sm" />
              <Skeleton height={24} radius="sm" />
              <Skeleton height={24} radius="sm" />
            </Stack>
          ) : (
            <Stack gap="md" maw={520}>
              <Switch
                label="Ricevi notifiche via email"
                description="Disattivando questa opzione nessuna notifica verrà inviata via email"
                checked={prefs.emailEnabled}
                onChange={(e) =>
                  setPrefs({ ...prefs, emailEnabled: e.currentTarget.checked })
                }
                data-testid="prefs-email-enabled"
              />

              <div>
                <Text fw={600} fz="sm" mb={6}>
                  Tipi di notifica
                </Text>
                <Stack gap="xs">
                  {NOTIFICATION_TYPE_LABELS.map(({ key, label }) => (
                    <Switch
                      key={key}
                      label={label}
                      size="sm"
                      disabled={!prefs.emailEnabled}
                      checked={prefs.typePreferences[key] !== false}
                      onChange={(e) =>
                        setPrefs({
                          ...prefs,
                          typePreferences: {
                            ...prefs.typePreferences,
                            [key]: e.currentTarget.checked,
                          },
                        })
                      }
                      data-testid={`prefs-type-${key.toLowerCase()}`}
                    />
                  ))}
                </Stack>
              </div>

              <div>
                <Switch
                  label="Ore di silenzio"
                  description="Le email vengono posticipate alla fine della finestra indicata"
                  checked={prefs.quietHoursEnabled}
                  onChange={(e) =>
                    setPrefs({ ...prefs, quietHoursEnabled: e.currentTarget.checked })
                  }
                  data-testid="prefs-quiet-hours-enabled"
                />
                {prefs.quietHoursEnabled && (
                  <Group gap="md" mt="sm">
                    <TextInput
                      label="Dalle"
                      placeholder="22:00"
                      w={110}
                      value={prefs.quietHoursStart ?? ''}
                      onChange={(e) =>
                        setPrefs({ ...prefs, quietHoursStart: e.currentTarget.value })
                      }
                      data-testid="prefs-quiet-hours-start"
                    />
                    <TextInput
                      label="Alle"
                      placeholder="08:00"
                      w={110}
                      value={prefs.quietHoursEnd ?? ''}
                      onChange={(e) =>
                        setPrefs({ ...prefs, quietHoursEnd: e.currentTarget.value })
                      }
                      data-testid="prefs-quiet-hours-end"
                    />
                  </Group>
                )}
              </div>

              <Group justify="flex-start" mt="xs">
                <Button
                  color="navy"
                  loading={prefsSaving}
                  onClick={savePrefs}
                  leftSection={<IconBell size={18} />}
                  data-testid="prefs-save"
                >
                  Salva preferenze
                </Button>
              </Group>
            </Stack>
          )}
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
