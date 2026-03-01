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
  IconRefresh,
  IconDeviceFloppy,
  IconSettings,
  IconMail,
  IconBrandStripe,
  IconFlag,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';

interface Settings {
  defaultTrialDays: number;
  maxTenantsPerPlan: Record<string, number>;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowNewRegistrations: boolean;
  defaultFeatureFlags: Record<string, boolean>;
  emailSettings: {
    fromName: string;
    fromEmail: string;
    replyTo: string;
  };
  stripeSettings: {
    webhookEnabled: boolean;
    testMode: boolean;
  };
}

interface PlatformInfo {
  totalTenants: number;
  activeSubscriptions: number;
  activePlans: number;
  environment: string;
  version: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      defaultTrialDays: 14,
      maintenanceMode: false,
      maintenanceMessage: '',
      allowNewRegistrations: true,
      emailFromName: '',
      emailFromEmail: '',
      emailReplyTo: '',
      stripeWebhookEnabled: true,
      stripeTestMode: true,
      // Feature flags
      featureAdvancedReporting: false,
      featureApiAccess: false,
      featureCustomBranding: false,
      featureMultiLanguage: true,
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
      setSettings(data.settings);
      setPlatformInfo(data.platformInfo);

      form.setValues({
        defaultTrialDays: data.settings.defaultTrialDays,
        maintenanceMode: data.settings.maintenanceMode,
        maintenanceMessage: data.settings.maintenanceMessage,
        allowNewRegistrations: data.settings.allowNewRegistrations,
        emailFromName: data.settings.emailSettings.fromName,
        emailFromEmail: data.settings.emailSettings.fromEmail,
        emailReplyTo: data.settings.emailSettings.replyTo,
        stripeWebhookEnabled: data.settings.stripeSettings.webhookEnabled,
        stripeTestMode: data.settings.stripeSettings.testMode,
        featureAdvancedReporting: data.settings.defaultFeatureFlags.advancedReporting,
        featureApiAccess: data.settings.defaultFeatureFlags.apiAccess,
        featureCustomBranding: data.settings.defaultFeatureFlags.customBranding,
        featureMultiLanguage: data.settings.defaultFeatureFlags.multiLanguage,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/superadmin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultTrialDays: form.values.defaultTrialDays,
          maintenanceMode: form.values.maintenanceMode,
          maintenanceMessage: form.values.maintenanceMessage,
          allowNewRegistrations: form.values.allowNewRegistrations,
          emailSettings: {
            fromName: form.values.emailFromName,
            fromEmail: form.values.emailFromEmail,
            replyTo: form.values.emailReplyTo,
          },
          stripeSettings: {
            webhookEnabled: form.values.stripeWebhookEnabled,
            testMode: form.values.stripeTestMode,
          },
          defaultFeatureFlags: {
            advancedReporting: form.values.featureAdvancedReporting,
            apiAccess: form.values.featureApiAccess,
            customBranding: form.values.featureCustomBranding,
            multiLanguage: form.values.featureMultiLanguage,
          },
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

  const handleReset = async () => {
    if (!confirm('Sei sicuro di voler resettare le impostazioni ai valori predefiniti?')) {
      return;
    }

    try {
      const response = await fetch('/api/superadmin/settings?action=reset', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Reset fallito');
      }

      notifications.show({
        title: 'Successo',
        message: 'Impostazioni resettate',
        color: 'green',
      });

      loadSettings();
    } catch (err) {
      notifications.show({
        title: 'Errore',
        message: err instanceof Error ? err.message : 'Reset fallito',
        color: 'red',
      });
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
          <Group>
            <Button variant="light" onClick={handleReset}>
              Reset Predefiniti
            </Button>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={handleSave}
              loading={saving}
            >
              Salva Modifiche
            </Button>
          </Group>
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

        {/* General Settings */}
        <Paper withBorder p="lg" radius="md">
          <Group mb="md">
            <IconSettings size={20} />
            <Title order={3}>Impostazioni Generali</Title>
          </Group>
          <Stack gap="md">
            <NumberInput
              label="Giorni Trial Predefiniti"
              description="Numero di giorni di prova gratuita per i nuovi tenant"
              min={0}
              max={90}
              {...form.getInputProps('defaultTrialDays')}
              w={200}
            />
            <Switch
              label="Permetti Nuove Registrazioni"
              description="Disabilita per bloccare le nuove iscrizioni alla piattaforma"
              {...form.getInputProps('allowNewRegistrations', { type: 'checkbox' })}
            />
            <Divider />
            <Switch
              label="Modalità Manutenzione"
              description="Abilita per mostrare una pagina di manutenzione agli utenti"
              color="red"
              {...form.getInputProps('maintenanceMode', { type: 'checkbox' })}
            />
            {form.values.maintenanceMode && (
              <TextInput
                label="Messaggio Manutenzione"
                placeholder="Stiamo effettuando manutenzione programmata..."
                {...form.getInputProps('maintenanceMessage')}
              />
            )}
          </Stack>
        </Paper>

        {/* Email Settings */}
        <Paper withBorder p="lg" radius="md">
          <Group mb="md">
            <IconMail size={20} />
            <Title order={3}>Impostazioni Email</Title>
          </Group>
          <SimpleGrid cols={{ base: 1, md: 3 }}>
            <TextInput
              label="Nome Mittente"
              placeholder="InsegnaMi.pro"
              {...form.getInputProps('emailFromName')}
            />
            <TextInput
              label="Email Mittente"
              placeholder="noreply@insegnami.pro"
              {...form.getInputProps('emailFromEmail')}
            />
            <TextInput
              label="Reply-To"
              placeholder="support@insegnami.pro"
              {...form.getInputProps('emailReplyTo')}
            />
          </SimpleGrid>
        </Paper>

        {/* Stripe Settings */}
        <Paper withBorder p="lg" radius="md">
          <Group mb="md">
            <IconBrandStripe size={20} />
            <Title order={3}>Impostazioni Stripe</Title>
          </Group>
          <Stack gap="md">
            <Switch
              label="Webhook Abilitato"
              description="Ricevi notifiche da Stripe per aggiornamenti pagamenti"
              {...form.getInputProps('stripeWebhookEnabled', { type: 'checkbox' })}
            />
            <Switch
              label="Modalità Test"
              description="Usa le chiavi API di test di Stripe"
              color="yellow"
              {...form.getInputProps('stripeTestMode', { type: 'checkbox' })}
            />
          </Stack>
        </Paper>

        {/* Feature Flags */}
        <Paper withBorder p="lg" radius="md">
          <Group mb="md">
            <IconFlag size={20} />
            <Title order={3}>Feature Flags Predefiniti</Title>
          </Group>
          <Text size="sm" c="dimmed" mb="md">
            Queste impostazioni si applicano ai nuovi tenant. I tenant esistenti mantengono le loro
            configurazioni.
          </Text>
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Switch
              label="Report Avanzati"
              description="Abilita report e analytics avanzati"
              {...form.getInputProps('featureAdvancedReporting', { type: 'checkbox' })}
            />
            <Switch
              label="Accesso API"
              description="Abilita accesso alle API REST"
              {...form.getInputProps('featureApiAccess', { type: 'checkbox' })}
            />
            <Switch
              label="Branding Personalizzato"
              description="Permetti personalizzazione logo e colori"
              {...form.getInputProps('featureCustomBranding', { type: 'checkbox' })}
            />
            <Switch
              label="Multi-Lingua"
              description="Supporto per più lingue nell'interfaccia"
              {...form.getInputProps('featureMultiLanguage', { type: 'checkbox' })}
            />
          </SimpleGrid>
        </Paper>
      </Stack>
    </Container>
  );
}
