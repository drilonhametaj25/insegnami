'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  Container,
  Title,
  Text,
  Card,
  Stack,
  Group,
  Tabs,
  SegmentedControl,
  TextInput,
  Button,
  Divider,
  ThemeIcon,
  LoadingOverlay,
  useMantineColorScheme,
  useComputedColorScheme,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconPalette,
  IconSchool,
  IconUserCircle,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconArrowRight,
  IconDeviceFloppy,
} from '@tabler/icons-react';

// Ruoli che possono gestire i dati della scuola (allineato a ADMIN_ROLES lato server).
const SCHOOL_ROLES = ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'];

export default function SettingsPage() {
  const locale = useLocale();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const canManageSchool = !!role && SCHOOL_ROLES.includes(role);

  // --- Aspetto: controllo tema reale Mantine ---
  // colorScheme può essere 'light' | 'dark' | 'auto'
  const { setColorScheme, colorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true });

  // --- Scuola ---
  const [loadingSchool, setLoadingSchool] = useState(false);
  const [savingSchool, setSavingSchool] = useState(false);

  const form = useForm({
    initialValues: {
      name: '',
      address: '',
      phone: '',
      email: '',
    },
    validate: {
      name: (v) => (v.trim().length < 2 ? 'Nome scuola richiesto' : null),
      email: (v) =>
        v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Email non valida' : null,
    },
  });

  useEffect(() => {
    if (!canManageSchool) return;
    let active = true;
    setLoadingSchool(true);
    fetch('/api/onboarding')
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data) => {
        if (!active) return;
        const t = data?.tenant ?? {};
        form.setValues({
          name: t.name ?? '',
          address: t.address ?? '',
          phone: t.phone ?? '',
          email: t.email ?? '',
        });
      })
      .catch(() => {
        if (!active) return;
        notifications.show({
          title: 'Errore',
          message: 'Impossibile caricare i dati della scuola',
          color: 'red',
        });
      })
      .finally(() => {
        if (active) setLoadingSchool(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canManageSchool]);

  const handleSaveSchool = form.onSubmit(async (values) => {
    setSavingSchool(true);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name,
          address: values.address,
          phone: values.phone,
          email: values.email,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Salvataggio non riuscito');
      }
      notifications.show({
        title: 'Salvato',
        message: 'Dati della scuola aggiornati con successo',
        color: 'green',
      });
    } catch (e) {
      notifications.show({
        title: 'Errore',
        message: e instanceof Error ? e.message : 'Salvataggio non riuscito',
        color: 'red',
      });
    } finally {
      setSavingSchool(false);
    }
  });

  return (
    <Container size="lg" py="md">
      <Stack gap="xs" mb="lg">
        <Title order={2}>Impostazioni</Title>
        <Text c="dimmed" size="sm">
          Gestisci aspetto, dati della scuola e il tuo account.
        </Text>
      </Stack>

      <Tabs defaultValue="appearance" keepMounted={false} color="navy">
        <Tabs.List mb="md">
          <Tabs.Tab value="appearance" leftSection={<IconPalette size={16} />}>
            Aspetto
          </Tabs.Tab>
          {canManageSchool && (
            <Tabs.Tab value="school" leftSection={<IconSchool size={16} />}>
              Scuola
            </Tabs.Tab>
          )}
          <Tabs.Tab value="account" leftSection={<IconUserCircle size={16} />}>
            Account
          </Tabs.Tab>
        </Tabs.List>

        {/* ASPETTO */}
        <Tabs.Panel value="appearance">
          <Card withBorder>
            <Stack gap="md">
              <Group gap="sm">
                <ThemeIcon variant="light" color="navy" size="lg" radius="md">
                  <IconPalette size={20} />
                </ThemeIcon>
                <div>
                  <Text fw={600}>Tema</Text>
                  <Text size="sm" c="dimmed">
                    Scegli tra modalità chiara, scura o automatica (segue il sistema).
                  </Text>
                </div>
              </Group>

              <Divider />

              <SegmentedControl
                fullWidth
                value={colorScheme}
                onChange={(value) =>
                  setColorScheme(value as 'light' | 'dark' | 'auto')
                }
                data={[
                  {
                    value: 'light',
                    label: (
                      <Group gap={6} justify="center" wrap="nowrap">
                        <IconSun size={16} />
                        <span>Chiaro</span>
                      </Group>
                    ),
                  },
                  {
                    value: 'dark',
                    label: (
                      <Group gap={6} justify="center" wrap="nowrap">
                        <IconMoon size={16} />
                        <span>Scuro</span>
                      </Group>
                    ),
                  },
                  {
                    value: 'auto',
                    label: (
                      <Group gap={6} justify="center" wrap="nowrap">
                        <IconDeviceDesktop size={16} />
                        <span>Auto</span>
                      </Group>
                    ),
                  },
                ]}
              />

              <Text size="xs" c="dimmed">
                Tema attuale:{' '}
                {colorScheme === 'auto'
                  ? `Auto (${computed === 'dark' ? 'scuro' : 'chiaro'})`
                  : colorScheme === 'dark'
                    ? 'Scuro'
                    : 'Chiaro'}
              </Text>
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* SCUOLA */}
        {canManageSchool && (
          <Tabs.Panel value="school">
            <Card withBorder pos="relative">
              <LoadingOverlay visible={loadingSchool} zIndex={5} />
              <form onSubmit={handleSaveSchool}>
                <Stack gap="md">
                  <Group gap="sm">
                    <ThemeIcon variant="light" color="navy" size="lg" radius="md">
                      <IconSchool size={20} />
                    </ThemeIcon>
                    <div>
                      <Text fw={600}>Dati della scuola</Text>
                      <Text size="sm" c="dimmed">
                        Queste informazioni vengono usate in documenti, comunicazioni e fatture.
                      </Text>
                    </div>
                  </Group>

                  <Divider />

                  <TextInput
                    label="Nome scuola"
                    placeholder="Es. Istituto InsegnaMi"
                    withAsterisk
                    {...form.getInputProps('name')}
                  />
                  <TextInput
                    label="Indirizzo"
                    placeholder="Via, numero, città, CAP"
                    {...form.getInputProps('address')}
                  />
                  <Group grow align="flex-start">
                    <TextInput
                      label="Telefono"
                      placeholder="+39 ..."
                      {...form.getInputProps('phone')}
                    />
                    <TextInput
                      label="Email"
                      placeholder="info@scuola.it"
                      type="email"
                      {...form.getInputProps('email')}
                    />
                  </Group>

                  <Group justify="flex-end" mt="xs">
                    <Button
                      type="submit"
                      color="navy"
                      loading={savingSchool}
                      leftSection={<IconDeviceFloppy size={16} />}
                    >
                      Salva modifiche
                    </Button>
                  </Group>
                </Stack>
              </form>
            </Card>
          </Tabs.Panel>
        )}

        {/* ACCOUNT */}
        <Tabs.Panel value="account">
          <Card withBorder>
            <Stack gap="md">
              <Group gap="sm">
                <ThemeIcon variant="light" color="amber" size="lg" radius="md">
                  <IconUserCircle size={20} />
                </ThemeIcon>
                <div>
                  <Text fw={600}>Account personale</Text>
                  <Text size="sm" c="dimmed">
                    Gestisci i tuoi dati personali, l&apos;avatar e la password dal tuo profilo.
                  </Text>
                </div>
              </Group>

              <Divider />

              <Group justify="space-between" wrap="nowrap">
                <Text size="sm">
                  Vai al profilo per modificare nome, email e password.
                </Text>
                <Button
                  component={Link}
                  href={`/${locale}/dashboard/profile`}
                  variant="light"
                  color="navy"
                  rightSection={<IconArrowRight size={16} />}
                >
                  Apri profilo
                </Button>
              </Group>
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
