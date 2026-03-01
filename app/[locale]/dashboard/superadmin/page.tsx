'use client';

import { useState, useEffect } from 'react';
import {
  Container,
  Title,
  Grid,
  Paper,
  Text,
  Group,
  Stack,
  Badge,
  Card,
  Loader,
  Alert,
  ActionIcon,
  Tooltip,
  SimpleGrid,
  Progress,
  ThemeIcon,
} from '@mantine/core';
import {
  IconBuilding,
  IconUsers,
  IconCoin,
  IconTrendingUp,
  IconTrendingDown,
  IconRefresh,
  IconAlertCircle,
  IconCreditCard,
  IconChartBar,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

interface Analytics {
  period: { days: number; start: string; end: string };
  tenants: {
    total: number;
    active: number;
    inactive: number;
    newInPeriod: number;
    growthRate: number;
  };
  subscriptions: {
    total: number;
    active: number;
    trialing: number;
    cancelledInPeriod: number;
    churnRate: number;
  };
  users: {
    total: number;
    active: number;
    newInPeriod: number;
  };
  revenue: {
    mrr: number;
    arr: number;
    byPlan: Array<{ planName: string; subscriptions: number; mrr: number }>;
  };
  usage: {
    students: number;
    teachers: number;
    classes: number;
    lessons: number;
    payments: number;
  };
  recentActivity: {
    tenants: Array<{ id: string; name: string; slug: string; createdAt: string }>;
    subscriptions: Array<{
      id: string;
      tenantName: string;
      planName: string;
      status: string;
      createdAt: string;
    }>;
  };
}

function StatCard({
  title,
  value,
  icon,
  color,
  change,
  href,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  change?: number;
  href?: string;
}) {
  const content = (
    <Paper
      p="xl"
      radius="xl"
      style={{
        background: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(226, 232, 240, 0.8)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        cursor: href ? 'pointer' : 'default',
        transition: 'transform 0.2s',
      }}
    >
      <Group justify="space-between">
        <div>
          <Text c="dimmed" size="sm" fw={500} tt="uppercase">
            {title}
          </Text>
          <Text fw={700} size="xl">
            {value}
          </Text>
          {change !== undefined && (
            <Group gap={4} mt={5}>
              {change >= 0 ? <IconTrendingUp size={14} /> : <IconTrendingDown size={14} />}
              <Text c={change >= 0 ? 'teal' : 'red'} size="sm" fw={500}>
                {change >= 0 ? '+' : ''}
                {change.toFixed(1)}%
              </Text>
            </Group>
          )}
        </div>
        <ThemeIcon size={48} radius="xl" variant="light" color={color}>
          {icon}
        </ThemeIcon>
      </Group>
    </Paper>
  );

  if (href) {
    return <Link href={href} style={{ textDecoration: 'none' }}>{content}</Link>;
  }
  return content;
}

export default function SuperAdminDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/superadmin/analytics?period=30');
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Accesso negato. Solo SUPERADMIN.');
        }
        throw new Error('Errore nel caricamento dati');
      }
      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
      notifications.show({
        title: 'Errore',
        message: err instanceof Error ? err.message : 'Errore nel caricamento',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text>Caricamento dashboard...</Text>
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

  if (!analytics) return null;

  // Prepare chart data
  const revenueByPlanData = analytics.revenue.byPlan.map((p) => ({
    name: p.planName,
    mrr: p.mrr,
    subscriptions: p.subscriptions,
  }));

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <div>
            <Title order={1}>SuperAdmin Dashboard</Title>
            <Text c="dimmed" size="sm">
              Panoramica globale della piattaforma
            </Text>
          </div>
          <Tooltip label="Aggiorna dati">
            <ActionIcon variant="light" size="lg" onClick={loadAnalytics} loading={loading}>
              <IconRefresh size={20} />
            </ActionIcon>
          </Tooltip>
        </Group>

        {/* KPI Cards */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
          <StatCard
            title="Tenant Totali"
            value={analytics.tenants.total}
            icon={<IconBuilding size={24} />}
            color="blue"
            change={analytics.tenants.growthRate}
            href="/dashboard/superadmin/tenants"
          />
          <StatCard
            title="MRR"
            value={`€${analytics.revenue.mrr.toLocaleString('it-IT')}`}
            icon={<IconCoin size={24} />}
            color="green"
          />
          <StatCard
            title="Abbonamenti Attivi"
            value={analytics.subscriptions.active}
            icon={<IconCreditCard size={24} />}
            color="violet"
            href="/dashboard/superadmin/subscriptions"
          />
          <StatCard
            title="Utenti Totali"
            value={analytics.users.total}
            icon={<IconUsers size={24} />}
            color="orange"
          />
        </SimpleGrid>

        {/* Secondary Stats */}
        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Card withBorder p="lg" radius="md" h={350}>
              <Group justify="space-between" mb="md">
                <Title order={4}>Revenue per Piano</Title>
                <Badge variant="light">MRR Breakdown</Badge>
              </Group>
              {revenueByPlanData.length > 0 ? (
                <ResponsiveContainer width="100%" height="85%">
                  <AreaChart data={revenueByPlanData}>
                    <defs>
                      <linearGradient id="colorMrr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#339af0" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#339af0" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip formatter={(value) => [`€${value}`, 'MRR']} />
                    <Area
                      type="monotone"
                      dataKey="mrr"
                      stroke="#339af0"
                      fillOpacity={1}
                      fill="url(#colorMrr)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Stack align="center" justify="center" h="85%">
                  <IconChartBar size={48} color="gray" />
                  <Text c="dimmed">Nessun dato revenue disponibile</Text>
                </Stack>
              )}
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder p="lg" radius="md" h={350}>
              <Title order={4} mb="md">
                Metriche Chiave
              </Title>
              <Stack gap="md">
                <div>
                  <Group justify="space-between" mb={5}>
                    <Text size="sm">Churn Rate</Text>
                    <Badge color={analytics.subscriptions.churnRate > 5 ? 'red' : 'green'}>
                      {analytics.subscriptions.churnRate}%
                    </Badge>
                  </Group>
                  <Progress
                    value={Math.min(analytics.subscriptions.churnRate * 10, 100)}
                    color={analytics.subscriptions.churnRate > 5 ? 'red' : 'green'}
                    size="sm"
                  />
                </div>

                <div>
                  <Group justify="space-between" mb={5}>
                    <Text size="sm">Trial Attivi</Text>
                    <Text fw={500}>{analytics.subscriptions.trialing}</Text>
                  </Group>
                  <Progress
                    value={
                      analytics.subscriptions.total > 0
                        ? (analytics.subscriptions.trialing / analytics.subscriptions.total) * 100
                        : 0
                    }
                    color="yellow"
                    size="sm"
                  />
                </div>

                <div>
                  <Group justify="space-between" mb={5}>
                    <Text size="sm">Tenant Attivi</Text>
                    <Text fw={500}>
                      {analytics.tenants.active}/{analytics.tenants.total}
                    </Text>
                  </Group>
                  <Progress
                    value={
                      analytics.tenants.total > 0
                        ? (analytics.tenants.active / analytics.tenants.total) * 100
                        : 0
                    }
                    color="blue"
                    size="sm"
                  />
                </div>

                <Paper withBorder p="md" radius="md" mt="auto">
                  <Text size="sm" fw={500} mb="xs">
                    ARR Proiettato
                  </Text>
                  <Text size="xl" fw={700} c="green">
                    €{analytics.revenue.arr.toLocaleString('it-IT')}
                  </Text>
                </Paper>
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Usage Stats & Recent Activity */}
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card withBorder p="lg" radius="md">
              <Title order={4} mb="md">
                Utilizzo Piattaforma
              </Title>
              <SimpleGrid cols={2} spacing="md">
                <Paper withBorder p="md" radius="md">
                  <Text c="dimmed" size="xs" tt="uppercase">
                    Studenti
                  </Text>
                  <Text size="xl" fw={700}>
                    {analytics.usage.students.toLocaleString()}
                  </Text>
                </Paper>
                <Paper withBorder p="md" radius="md">
                  <Text c="dimmed" size="xs" tt="uppercase">
                    Docenti
                  </Text>
                  <Text size="xl" fw={700}>
                    {analytics.usage.teachers.toLocaleString()}
                  </Text>
                </Paper>
                <Paper withBorder p="md" radius="md">
                  <Text c="dimmed" size="xs" tt="uppercase">
                    Classi
                  </Text>
                  <Text size="xl" fw={700}>
                    {analytics.usage.classes.toLocaleString()}
                  </Text>
                </Paper>
                <Paper withBorder p="md" radius="md">
                  <Text c="dimmed" size="xs" tt="uppercase">
                    Lezioni
                  </Text>
                  <Text size="xl" fw={700}>
                    {analytics.usage.lessons.toLocaleString()}
                  </Text>
                </Paper>
              </SimpleGrid>
            </Card>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 6 }}>
            <Card withBorder p="lg" radius="md">
              <Group justify="space-between" mb="md">
                <Title order={4}>Nuovi Tenant</Title>
                <Badge variant="light">Ultimi 30 giorni</Badge>
              </Group>
              <Stack gap="xs">
                {analytics.recentActivity.tenants.length > 0 ? (
                  analytics.recentActivity.tenants.map((tenant) => (
                    <Paper key={tenant.id} withBorder p="sm" radius="sm">
                      <Group justify="space-between">
                        <div>
                          <Text size="sm" fw={500}>
                            {tenant.name}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {tenant.slug}
                          </Text>
                        </div>
                        <Text size="xs" c="dimmed">
                          {new Date(tenant.createdAt).toLocaleDateString('it-IT')}
                        </Text>
                      </Group>
                    </Paper>
                  ))
                ) : (
                  <Text c="dimmed" ta="center" py="md">
                    Nessun nuovo tenant nel periodo
                  </Text>
                )}
              </Stack>
            </Card>
          </Grid.Col>
        </Grid>

        {/* Quick Links */}
        <SimpleGrid cols={{ base: 2, md: 4 }}>
          <Paper
            component={Link}
            href="/dashboard/superadmin/tenants"
            withBorder
            p="md"
            radius="md"
            style={{ textDecoration: 'none', cursor: 'pointer' }}
          >
            <Group>
              <ThemeIcon size="lg" variant="light" color="blue">
                <IconBuilding size={20} />
              </ThemeIcon>
              <Text fw={500}>Gestione Tenant</Text>
            </Group>
          </Paper>
          <Paper
            component={Link}
            href="/dashboard/superadmin/plans"
            withBorder
            p="md"
            radius="md"
            style={{ textDecoration: 'none', cursor: 'pointer' }}
          >
            <Group>
              <ThemeIcon size="lg" variant="light" color="green">
                <IconCreditCard size={20} />
              </ThemeIcon>
              <Text fw={500}>Gestione Piani</Text>
            </Group>
          </Paper>
          <Paper
            component={Link}
            href="/dashboard/superadmin/subscriptions"
            withBorder
            p="md"
            radius="md"
            style={{ textDecoration: 'none', cursor: 'pointer' }}
          >
            <Group>
              <ThemeIcon size="lg" variant="light" color="violet">
                <IconCoin size={20} />
              </ThemeIcon>
              <Text fw={500}>Abbonamenti</Text>
            </Group>
          </Paper>
          <Paper
            component={Link}
            href="/dashboard/superadmin/settings"
            withBorder
            p="md"
            radius="md"
            style={{ textDecoration: 'none', cursor: 'pointer' }}
          >
            <Group>
              <ThemeIcon size="lg" variant="light" color="orange">
                <IconChartBar size={20} />
              </ThemeIcon>
              <Text fw={500}>Impostazioni</Text>
            </Group>
          </Paper>
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
