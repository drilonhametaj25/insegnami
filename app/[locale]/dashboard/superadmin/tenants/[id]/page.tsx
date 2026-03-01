'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Container,
  Title,
  Paper,
  Text,
  Group,
  Stack,
  Badge,
  Button,
  Grid,
  Card,
  Loader,
  Alert,
  Tabs,
  Table,
  ActionIcon,
  Tooltip,
  SimpleGrid,
  Progress,
  TextInput,
  Switch,
  NumberInput,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import { useForm } from '@mantine/form';
import {
  IconArrowLeft,
  IconEdit,
  IconUsers,
  IconCoin,
  IconCalendar,
  IconAlertCircle,
  IconCheck,
  IconX,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  domain: string | null;
  plan: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  setupStage: string;
  setupCompletedAt: string | null;
  stripeCustomerId: string | null;
  featureFlags: Record<string, boolean>;
  trialUntil: string | null;
  isTrialing: boolean;
  trialDaysLeft: number;
  subscription: any;
  users: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    status: string;
    lastLogin: string | null;
    joinedAt: string;
  }>;
  usage: {
    users: number;
    students: number;
    teachers: number;
    classes: number;
    courses: number;
    lessons: number;
    payments: number;
  };
  revenue: {
    total: number;
    paymentsCount: number;
  };
  recentPayments: Array<{
    id: string;
    amount: number;
    status: string;
    description: string;
    createdAt: string;
  }>;
}

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);

  const form = useForm({
    initialValues: {
      name: '',
      slug: '',
      domain: '',
      isActive: true,
      trialUntil: null as Date | null,
    },
  });

  const loadTenant = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/superadmin/tenants/${params.id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Tenant non trovato');
        }
        throw new Error('Errore nel caricamento');
      }

      const data = await response.json();
      setTenant(data.tenant);
      form.setValues({
        name: data.tenant.name,
        slug: data.tenant.slug,
        domain: data.tenant.domain || '',
        isActive: data.tenant.isActive,
        trialUntil: data.tenant.trialUntil ? new Date(data.tenant.trialUntil) : null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.id) {
      loadTenant();
    }
  }, [params.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/superadmin/tenants/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form.values,
          domain: form.values.domain || null,
          trialUntil: form.values.trialUntil?.toISOString() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Salvataggio fallito');
      }

      notifications.show({
        title: 'Successo',
        message: 'Tenant aggiornato',
        color: 'green',
      });

      setEditMode(false);
      loadTenant();
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

  const handleAction = async (action: string, value?: string) => {
    try {
      const response = await fetch(`/api/superadmin/tenants/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, value }),
      });

      if (!response.ok) throw new Error('Azione fallita');

      const data = await response.json();
      notifications.show({
        title: 'Successo',
        message: data.message,
        color: 'green',
      });

      loadTenant();
    } catch {
      notifications.show({
        title: 'Errore',
        message: 'Azione non riuscita',
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

  if (!tenant) return null;

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Group>
            <ActionIcon
              variant="subtle"
              component={Link}
              href="/dashboard/superadmin/tenants"
            >
              <IconArrowLeft size={20} />
            </ActionIcon>
            <div>
              <Group gap="sm">
                <Title order={1}>{tenant.name}</Title>
                <Badge color={tenant.isActive ? 'green' : 'red'}>
                  {tenant.isActive ? 'Attivo' : 'Sospeso'}
                </Badge>
                {tenant.isTrialing && (
                  <Badge color="yellow">Trial ({tenant.trialDaysLeft}gg)</Badge>
                )}
              </Group>
              <Text c="dimmed" size="sm">
                {tenant.slug}
                {tenant.domain && ` - ${tenant.domain}`}
              </Text>
            </div>
          </Group>
          <Group>
            {editMode ? (
              <>
                <Button variant="light" onClick={() => setEditMode(false)}>
                  Annulla
                </Button>
                <Button onClick={handleSave} loading={saving}>
                  Salva
                </Button>
              </>
            ) : (
              <Button leftSection={<IconEdit size={16} />} onClick={() => setEditMode(true)}>
                Modifica
              </Button>
            )}
          </Group>
        </Group>

        {/* Quick Actions */}
        {!editMode && (
          <Paper withBorder p="md" radius="md">
            <Group>
              <Text fw={500}>Azioni rapide:</Text>
              <Button
                size="xs"
                variant="light"
                onClick={() => handleAction('extend_trial', '14')}
              >
                +14gg Trial
              </Button>
              <Button
                size="xs"
                variant="light"
                color={tenant.isActive ? 'orange' : 'green'}
                onClick={() => handleAction(tenant.isActive ? 'suspend' : 'activate')}
              >
                {tenant.isActive ? 'Sospendi' : 'Riattiva'}
              </Button>
              <Button
                size="xs"
                variant="light"
                onClick={() => handleAction('reset_setup')}
              >
                Reset Setup
              </Button>
            </Group>
          </Paper>
        )}

        <Tabs defaultValue="overview">
          <Tabs.List>
            <Tabs.Tab value="overview" leftSection={<IconCalendar size={16} />}>
              Panoramica
            </Tabs.Tab>
            <Tabs.Tab value="users" leftSection={<IconUsers size={16} />}>
              Utenti ({tenant.usage.users})
            </Tabs.Tab>
            <Tabs.Tab value="payments" leftSection={<IconCoin size={16} />}>
              Pagamenti
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" pt="lg">
            <Grid>
              <Grid.Col span={{ base: 12, md: 8 }}>
                {editMode ? (
                  <Paper withBorder p="lg" radius="md">
                    <Stack>
                      <TextInput
                        label="Nome"
                        {...form.getInputProps('name')}
                      />
                      <TextInput
                        label="Slug"
                        {...form.getInputProps('slug')}
                      />
                      <TextInput
                        label="Dominio"
                        placeholder="example.com"
                        {...form.getInputProps('domain')}
                      />
                      <DateInput
                        label="Fine Trial"
                        placeholder="Seleziona data"
                        clearable
                        {...form.getInputProps('trialUntil')}
                      />
                      <Switch
                        label="Attivo"
                        {...form.getInputProps('isActive', { type: 'checkbox' })}
                      />
                    </Stack>
                  </Paper>
                ) : (
                  <Stack gap="md">
                    {/* Usage Stats */}
                    <Paper withBorder p="lg" radius="md">
                      <Title order={4} mb="md">
                        Utilizzo
                      </Title>
                      <SimpleGrid cols={4}>
                        <div>
                          <Text c="dimmed" size="xs" tt="uppercase">
                            Studenti
                          </Text>
                          <Text size="xl" fw={700}>
                            {tenant.usage.students}
                          </Text>
                        </div>
                        <div>
                          <Text c="dimmed" size="xs" tt="uppercase">
                            Docenti
                          </Text>
                          <Text size="xl" fw={700}>
                            {tenant.usage.teachers}
                          </Text>
                        </div>
                        <div>
                          <Text c="dimmed" size="xs" tt="uppercase">
                            Classi
                          </Text>
                          <Text size="xl" fw={700}>
                            {tenant.usage.classes}
                          </Text>
                        </div>
                        <div>
                          <Text c="dimmed" size="xs" tt="uppercase">
                            Lezioni
                          </Text>
                          <Text size="xl" fw={700}>
                            {tenant.usage.lessons}
                          </Text>
                        </div>
                      </SimpleGrid>
                    </Paper>

                    {/* Subscription Info */}
                    <Paper withBorder p="lg" radius="md">
                      <Title order={4} mb="md">
                        Abbonamento
                      </Title>
                      {tenant.subscription ? (
                        <Stack gap="sm">
                          <Group justify="space-between">
                            <Text>Piano</Text>
                            <Badge>{tenant.subscription.plan?.name || 'N/A'}</Badge>
                          </Group>
                          <Group justify="space-between">
                            <Text>Stato</Text>
                            <Badge
                              color={
                                tenant.subscription.status === 'ACTIVE'
                                  ? 'green'
                                  : tenant.subscription.status === 'TRIALING'
                                    ? 'yellow'
                                    : 'red'
                              }
                            >
                              {tenant.subscription.status}
                            </Badge>
                          </Group>
                          <Group justify="space-between">
                            <Text>Scadenza periodo</Text>
                            <Text>
                              {new Date(
                                tenant.subscription.currentPeriodEnd
                              ).toLocaleDateString('it-IT')}
                            </Text>
                          </Group>
                        </Stack>
                      ) : (
                        <Text c="dimmed">Nessun abbonamento attivo</Text>
                      )}
                    </Paper>
                  </Stack>
                )}
              </Grid.Col>

              <Grid.Col span={{ base: 12, md: 4 }}>
                <Stack gap="md">
                  {/* Info Card */}
                  <Paper withBorder p="lg" radius="md">
                    <Title order={4} mb="md">
                      Dettagli
                    </Title>
                    <Stack gap="xs">
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          Creato
                        </Text>
                        <Text size="sm">
                          {new Date(tenant.createdAt).toLocaleDateString('it-IT')}
                        </Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          Setup
                        </Text>
                        <Badge size="sm" variant="outline">
                          {tenant.setupStage}
                        </Badge>
                      </Group>
                      {tenant.stripeCustomerId && (
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">
                            Stripe ID
                          </Text>
                          <Text size="xs" ff="monospace">
                            {tenant.stripeCustomerId.slice(0, 12)}...
                          </Text>
                        </Group>
                      )}
                    </Stack>
                  </Paper>

                  {/* Revenue Card */}
                  <Paper withBorder p="lg" radius="md">
                    <Title order={4} mb="md">
                      Revenue
                    </Title>
                    <Text size="xl" fw={700} c="green">
                      €{parseFloat(tenant.revenue.total?.toString() || '0').toLocaleString('it-IT')}
                    </Text>
                    <Text size="sm" c="dimmed">
                      da {tenant.revenue.paymentsCount} pagamenti
                    </Text>
                  </Paper>
                </Stack>
              </Grid.Col>
            </Grid>
          </Tabs.Panel>

          <Tabs.Panel value="users" pt="lg">
            <Paper withBorder radius="md">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Nome</Table.Th>
                    <Table.Th>Email</Table.Th>
                    <Table.Th>Ruolo</Table.Th>
                    <Table.Th>Stato</Table.Th>
                    <Table.Th>Ultimo accesso</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {tenant.users.map((user) => (
                    <Table.Tr key={user.id}>
                      <Table.Td>
                        {user.firstName} {user.lastName}
                      </Table.Td>
                      <Table.Td>{user.email}</Table.Td>
                      <Table.Td>
                        <Badge variant="outline" size="sm">
                          {user.role}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {user.status === 'ACTIVE' ? (
                          <IconCheck size={16} color="green" />
                        ) : (
                          <IconX size={16} color="red" />
                        )}
                      </Table.Td>
                      <Table.Td>
                        {user.lastLogin
                          ? new Date(user.lastLogin).toLocaleDateString('it-IT')
                          : '-'}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          </Tabs.Panel>

          <Tabs.Panel value="payments" pt="lg">
            <Paper withBorder radius="md">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Data</Table.Th>
                    <Table.Th>Descrizione</Table.Th>
                    <Table.Th>Importo</Table.Th>
                    <Table.Th>Stato</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {tenant.recentPayments.length > 0 ? (
                    tenant.recentPayments.map((payment) => (
                      <Table.Tr key={payment.id}>
                        <Table.Td>
                          {new Date(payment.createdAt).toLocaleDateString('it-IT')}
                        </Table.Td>
                        <Table.Td>{payment.description}</Table.Td>
                        <Table.Td>€{parseFloat(payment.amount?.toString() || '0').toFixed(2)}</Table.Td>
                        <Table.Td>
                          <Badge
                            color={
                              payment.status === 'PAID'
                                ? 'green'
                                : payment.status === 'PENDING'
                                  ? 'yellow'
                                  : 'red'
                            }
                          >
                            {payment.status}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))
                  ) : (
                    <Table.Tr>
                      <Table.Td colSpan={4}>
                        <Text c="dimmed" ta="center" py="md">
                          Nessun pagamento
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Paper>
          </Tabs.Panel>
        </Tabs>
      </Stack>
    </Container>
  );
}
