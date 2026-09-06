'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Paper,
  Text,
  Group,
  Stack,
  Badge,
  Button,
  TextInput,
  NumberInput,
  Switch,
  Divider,
  Loader,
  Alert,
  Card,
  SimpleGrid,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import {
  IconAlertCircle,
  IconDeviceFloppy,
  IconSettings,
  IconMail,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

// Campi reali del singleton PlatformSettings (id 'platform'):
// defaultTrialDays, allowNewRegistrations, maintenanceMode,
// senderName/senderEmail/replyTo, graceDays.
interface Settings {
  defaultTrialDays: number;
  allowNewRegistrations: boolean;
  maintenanceMode: boolean;
  senderName: string | null;
  senderEmail: string | null;
  replyTo: string | null;
  graceDays: number;
}

interface PlatformInfo {
  totalTenants: number;
  activeSubscriptions: number;
  activePlans: number;
  environment: string;
  version: string;
}

export default function SettingsPage() {
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      defaultTrialDays: 14,
      allowNewRegistrations: true,
      maintenanceMode: false,
      senderName: '',
      senderEmail: '',
      replyTo: '',
      graceDays: 7,
    },
  });

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/superadmin/settings');
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Accesso negato. Solo SUPERADMIN.');
        }
        throw new Error('Errore nel caricamento');
      }

      const data = await response.json();
      const settings: Settings = data.settings;
      setPlatformInfo(data.platformInfo);

      form.setValues({
        defaultTrialDays: settings.defaultTrialDays,
        allowNewRegistrations: settings.allowNewRegistrations,
        maintenanceMode: settings.maintenanceMode,
        senderName: settings.senderName ?? '',
        senderEmail: settings.senderEmail ?? '',
        replyTo: settings.replyTo ?? '',
        graceDays: settings.graceDays,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/superadmin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultTrialDays: form.values.defaultTrialDays,
          allowNewRegistrations: form.values.allowNewRegistrations,
          maintenanceMode: form.values.maintenanceMode,
          senderName: form.values.senderName || null,
          senderEmail: form.values.senderEmail || null,
          replyTo: form.values.replyTo || null,
          graceDays: form.values.graceDays,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Salvataggio fallito');
      }

      notifications.show({
        title: 'Successo',
        message: 'Impostazioni salvate',
        color: 'green',
      });

      loadSettings();
    } catch (err) {
      notifications.show({
        title: 'Errore',
        message: err instanceof Error ? err.message : 'Salvataggio fallito',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Stack align="center">
          <Loader size="lg" />
        </Stack>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" py="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Errore" color="red">
          {error}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <div>
            <Title order={1}>Impostazioni Sistema</Title>
            <Text c="dimmed" size="sm">
              Configurazione globale della piattaforma
            </Text>
          </div>
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            onClick={handleSave}
            loading={saving}
            data-testid="platform-settings-save"
          >
            Salva Modifiche
          </Button>
        </Group>

        {/* Platform Info */}
        {platformInfo && (
          <SimpleGrid cols={{ base: 2, md: 5 }}>
            <Card withBorder p="md" radius="md">
              <Text size="xs" c="dimmed" tt="uppercase">
                Tenant
              </Text>
              <Text size="xl" fw={700}>
                {platformInfo.totalTenants}
              </Text>
            </Card>
            <Card withBorder p="md" radius="md">
              <Text size="xs" c="dimmed" tt="uppercase">
                Abbonamenti Attivi
              </Text>
              <Text size="xl" fw={700}>
                {platformInfo.activeSubscriptions}
              </Text>
            </Card>
            <Card withBorder p="md" radius="md">
              <Text size="xs" c="dimmed" tt="uppercase">
                Piani Attivi
              </Text>
              <Text size="xl" fw={700}>
                {platformInfo.activePlans}
              </Text>
            </Card>
            <Card withBorder p="md" radius="md">
              <Text size="xs" c="dimmed" tt="uppercase">
                Ambiente
              </Text>
              <Badge size="lg" color={platformInfo.environment === 'production' ? 'green' : 'yellow'}>
                {platformInfo.environment}
              </Badge>
            </Card>
            <Card withBorder p="md" radius="md">
              <Text size="xs" c="dimmed" tt="uppercase">
                Versione
              </Text>
              <Text size="xl" fw={700}>
                {platformInfo.version}
              </Text>
            </Card>
          </SimpleGrid>
        )}

        {/* Impostazioni generali */}
        <Paper withBorder p="lg" radius="md">
          <Group mb="md">
            <IconSettings size={20} />
            <Title order={3}>Impostazioni Generali</Title>
          </Group>
          <Stack gap="md">
            <NumberInput
              label="Giorni Trial Predefiniti"
              description="Giorni di prova gratuita assegnati ai nuovi tenant alla registrazione"
              min={0}
              max={90}
              {...form.getInputProps('defaultTrialDays')}
              w={220}
              data-testid="platform-settings-trial-days"
            />
            <NumberInput
              label="Giorni di Grazia (dunning)"
              description="Giorni di tolleranza dopo un pagamento fallito (PAST_DUE) prima del blocco"
              min={0}
              max={60}
              {...form.getInputProps('graceDays')}
              w={220}
              data-testid="platform-settings-grace-days"
            />
            <Switch
              label="Permetti Nuove Registrazioni"
              description="Disabilita per bloccare le nuove iscrizioni alla piattaforma"
              {...form.getInputProps('allowNewRegistrations', { type: 'checkbox' })}
              data-testid="platform-settings-allow-registrations"
            />
            <Divider />
            <Switch
              label="Modalità Manutenzione"
              description="Mostra un banner di manutenzione a tutti gli utenti (i SUPERADMIN mantengono l'accesso)"
              color="red"
              {...form.getInputProps('maintenanceMode', { type: 'checkbox' })}
              data-testid="platform-settings-maintenance-mode"
            />
          </Stack>
        </Paper>

        {/* Mittente email piattaforma */}
        <Paper withBorder p="lg" radius="md">
          <Group mb="md">
            <IconMail size={20} />
            <Title order={3}>Mittente Email</Title>
          </Group>
          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <TextInput
              label="Nome Mittente"
              placeholder="InsegnaMi.pro"
              {...form.getInputProps('senderName')}
            />
            <TextInput
              label="Email Mittente"
              placeholder="noreply@insegnami.pro"
              {...form.getInputProps('senderEmail')}
            />
            <TextInput
              label="Reply-To"
              placeholder="support@insegnami.pro"
              {...form.getInputProps('replyTo')}
            />
          </SimpleGrid>
        </Paper>
      </Stack>
    </Container>
  );
}
