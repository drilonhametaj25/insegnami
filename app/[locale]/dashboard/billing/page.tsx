'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import {
  Container,
  Title,
  Paper,
  Button,
  Group,
  Stack,
  Badge,
  Text,
  Card,
  Alert,
  LoadingOverlay,
  Skeleton,
  Grid,
  ThemeIcon,
  Progress,
  Divider,
  Box,
  SimpleGrid,
  rem
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconCreditCard,
  IconCalendar,
  IconCheck,
  IconAlertTriangle,
  IconCrown,
  IconUsers,
  IconSchool,
  IconBook,
  IconExternalLink,
  IconRefresh,
  IconTrendingUp,
  IconClock,
  IconX
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import Link from 'next/link';

interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  interval: string;
  maxStudents: number | null;
  maxTeachers: number | null;
  maxClasses: number | null;
  features: Record<string, boolean>;
}

interface Subscription {
  id: string;
  planId: string;
  plan: Plan;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

interface Tenant {
  id: string;
  name: string;
  plan: string;
  trialUntil: string | null;
  isActive: boolean;
  stripeCustomerId: string | null;
}

interface SubscriptionData {
  subscription: Subscription | null;
  tenant?: Tenant;
  status: string;
}

interface UsageStats {
  students: number;
  teachers: number;
  classes: number;
}

const statusColors: Record<string, string> = {
  active: 'green',
  trialing: 'blue',
  past_due: 'orange',
  cancelled: 'red',
  unpaid: 'red',
  no_subscription: 'gray'
};

const statusLabels: Record<string, string> = {
  active: 'Attivo',
  trialing: 'In Prova',
  past_due: 'Pagamento in Ritardo',
  cancelled: 'Cancellato',
  unpaid: 'Non Pagato',
  no_subscription: 'Nessun Abbonamento'
};

export default function BillingPage() {
  const t = useTranslations('billing');
  const searchParams = useSearchParams();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for success/cancelled from Stripe redirect
  useEffect(() => {
    const success = searchParams.get('success');
    const cancelled = searchParams.get('cancelled');

    if (success === 'true') {
      notifications.show({
        title: 'Abbonamento Attivato!',
        message: 'Il tuo abbonamento è stato attivato con successo. Benvenuto!',
        color: 'green',
        icon: <IconCheck size={18} />
      });
    } else if (cancelled === 'true') {
      notifications.show({
        title: 'Checkout Annullato',
        message: 'Il processo di checkout è stato annullato.',
        color: 'orange',
        icon: <IconX size={18} />
      });
    }
  }, [searchParams]);

  useEffect(() => {
    fetchSubscription();
    fetchUsage();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await fetch('/api/subscriptions');
      if (!response.ok) throw new Error('Errore nel caricamento abbonamento');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError('Impossibile caricare i dati dell\'abbonamento');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsage = async () => {
    try {
      // Fetch usage stats from dashboard API
      const [studentsRes, teachersRes, classesRes] = await Promise.all([
        fetch('/api/students?page=1&limit=1'),
        fetch('/api/teachers?page=1&limit=1'),
        fetch('/api/classes?page=1&limit=1')
      ]);

      // BUG-017 fix: Check response.ok before parsing JSON
      if (!studentsRes.ok || !teachersRes.ok || !classesRes.ok) {
        throw new Error('Failed to fetch usage statistics');
      }

      const studentsData = await studentsRes.json();
      const teachersData = await teachersRes.json();
      const classesData = await classesRes.json();

      setUsage({
        students: studentsData.total || 0,
        teachers: teachersData.total || 0,
        classes: classesData.total || 0
      });
    } catch (err) {
      // BUG-021 fix: Show error to user instead of silent console.error
      notifications.show({
        title: 'Errore',
        message: 'Impossibile caricare le statistiche di utilizzo',
        color: 'red',
        icon: <IconAlertTriangle size={18} />
      });
      console.error('Error fetching usage:', err);
    }
  };

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const response = await fetch('/api/subscriptions/portal', {
        method: 'POST'
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Errore nell\'apertura del portale');
      }

      // BUG-022 fix: Open in new tab instead of hard redirect to preserve app state
      window.open(result.url, '_blank');
    } catch (err) {
      notifications.show({
        title: 'Errore',
        message: err instanceof Error ? err.message : 'Errore imprevisto',
        color: 'red'
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const getUsagePercentage = (current: number, max: number | null): number => {
    if (!max) return 0;
    return Math.min((current / max) * 100, 100);
  };

  const formatDate = (dateStr: string): string => {
    return dayjs(dateStr).format('DD/MM/YYYY');
  };

  const getDaysRemaining = (dateStr: string): number => {
    return dayjs(dateStr).diff(dayjs(), 'day');
  };

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Stack gap="xl">
          <Skeleton height={40} width={200} />
          <Grid>
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Skeleton height={300} radius="md" />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Skeleton height={300} radius="md" />
            </Grid.Col>
          </Grid>
        </Stack>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" py="xl">
        <Alert icon={<IconAlertTriangle />} color="red" title="Errore">
          {error}
        </Alert>
      </Container>
    );
  }

  const subscription = data?.subscription;
  const tenant = data?.tenant;
  const status = data?.status || 'no_subscription';
  const plan = subscription?.plan;

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="center">
          <div>
            <Title order={2}>Fatturazione & Abbonamento</Title>
            <Text c="dimmed" size="sm" mt={4}>
              Gestisci il tuo piano e le informazioni di pagamento
            </Text>
          </div>
          <Button
            leftSection={<IconRefresh size={18} />}
            variant="light"
            onClick={() => {
              setLoading(true);
              fetchSubscription();
              fetchUsage();
            }}
          >
            Aggiorna
          </Button>
        </Group>

        {/* Trial/Status Alert */}
        {status === 'trialing' && subscription?.trialEnd && (
          <Alert
            icon={<IconClock />}
            color="blue"
            title="Periodo di Prova"
          >
            Il tuo periodo di prova termina il {formatDate(subscription.trialEnd)}.
            {getDaysRemaining(subscription.trialEnd) <= 3 && (
              <Text size="sm" mt="xs" fw={500}>
                Mancano solo {getDaysRemaining(subscription.trialEnd)} giorni! Aggiungi un metodo di pagamento per continuare.
              </Text>
            )}
          </Alert>
        )}

        {status === 'past_due' && (
          <Alert
            icon={<IconAlertTriangle />}
            color="orange"
            title="Pagamento in Ritardo"
          >
            Il tuo ultimo pagamento non è andato a buon fine. Aggiorna il metodo di pagamento per evitare l'interruzione del servizio.
          </Alert>
        )}

        {status === 'no_subscription' && tenant?.trialUntil && (
          <Alert
            icon={<IconClock />}
            color="blue"
            title="Periodo di Prova"
          >
            Stai utilizzando la versione di prova. La prova termina il {formatDate(tenant.trialUntil)}.
            <Button
              component={Link}
              href="/it/pricing"
              size="xs"
              variant="filled"
              color="blue"
              mt="sm"
            >
              Scegli un Piano
            </Button>
          </Alert>
        )}

        <Grid>
          {/* Main Subscription Card */}
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Paper p="xl" radius="md" withBorder>
              <Group justify="space-between" mb="xl">
                <div>
                  <Group gap="sm" mb="xs">
                    <ThemeIcon size="lg" radius="md" color="violet" variant="light">
                      <IconCrown size={20} />
                    </ThemeIcon>
                    <Title order={3}>
                      {plan?.name || tenant?.plan || 'Piano Free'}
                    </Title>
                  </Group>
                  <Badge color={statusColors[status]} size="lg">
                    {statusLabels[status]}
                  </Badge>
                </div>
                {plan && (
                  <div style={{ textAlign: 'right' }}>
                    <Text size={rem(36)} fw={900} c="violet">
                      €{plan.price}
                    </Text>
                    <Text size="sm" c="dimmed">
                      /{plan.interval === 'MONTHLY' ? 'mese' : 'anno'}
                    </Text>
                  </div>
                )}
              </Group>

              <Divider mb="xl" />

              {/* Subscription Details */}
              {subscription && (
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" mb="xl">
                  <Box>
                    <Group gap="xs" mb="xs">
                      <IconCalendar size={18} color="gray" />
                      <Text size="sm" c="dimmed">Periodo Corrente</Text>
                    </Group>
                    <Text fw={500}>
                      {formatDate(subscription.currentPeriodStart)} - {formatDate(subscription.currentPeriodEnd)}
                    </Text>
                  </Box>
                  <Box>
                    <Group gap="xs" mb="xs">
                      <IconTrendingUp size={18} color="gray" />
                      <Text size="sm" c="dimmed">Prossimo Rinnovo</Text>
                    </Group>
                    <Text fw={500}>
                      {subscription.cancelAtPeriodEnd
                        ? 'Non verrà rinnovato'
                        : formatDate(subscription.currentPeriodEnd)
                      }
                    </Text>
                  </Box>
                </SimpleGrid>
              )}

              {/* Usage Stats */}
              {plan && usage && (
                <>
                  <Text fw={600} mb="md">Utilizzo Risorse</Text>
                  <Stack gap="md">
                    <Box>
                      <Group justify="space-between" mb={4}>
                        <Group gap="xs">
                          <IconUsers size={16} />
                          <Text size="sm">Studenti</Text>
                        </Group>
                        <Text size="sm" c="dimmed">
                          {usage.students} / {plan.maxStudents || '∞'}
                        </Text>
                      </Group>
                      <Progress
                        value={getUsagePercentage(usage.students, plan.maxStudents)}
                        color={getUsagePercentage(usage.students, plan.maxStudents) > 80 ? 'orange' : 'blue'}
                        size="sm"
                        radius="xl"
                      />
                    </Box>
                    <Box>
                      <Group justify="space-between" mb={4}>
                        <Group gap="xs">
                          <IconSchool size={16} />
                          <Text size="sm">Insegnanti</Text>
                        </Group>
                        <Text size="sm" c="dimmed">
                          {usage.teachers} / {plan.maxTeachers || '∞'}
                        </Text>
                      </Group>
                      <Progress
                        value={getUsagePercentage(usage.teachers, plan.maxTeachers)}
                        color={getUsagePercentage(usage.teachers, plan.maxTeachers) > 80 ? 'orange' : 'green'}
                        size="sm"
                        radius="xl"
                      />
                    </Box>
                    <Box>
                      <Group justify="space-between" mb={4}>
                        <Group gap="xs">
                          <IconBook size={16} />
                          <Text size="sm">Classi</Text>
                        </Group>
                        <Text size="sm" c="dimmed">
                          {usage.classes} / {plan.maxClasses || '∞'}
                        </Text>
                      </Group>
                      <Progress
                        value={getUsagePercentage(usage.classes, plan.maxClasses)}
                        color={getUsagePercentage(usage.classes, plan.maxClasses) > 80 ? 'orange' : 'violet'}
                        size="sm"
                        radius="xl"
                      />
                    </Box>
                  </Stack>
                </>
              )}

              <Divider my="xl" />

              {/* Actions */}
              <Group>
                {subscription ? (
                  <Button
                    leftSection={<IconCreditCard size={18} />}
                    onClick={handleOpenPortal}
                    loading={portalLoading}
                    variant="filled"
                  >
                    Gestisci Abbonamento
                  </Button>
                ) : (
                  <Button
                    component={Link}
                    href="/it/pricing"
                    leftSection={<IconCrown size={18} />}
                    variant="filled"
                    color="violet"
                  >
                    Scegli un Piano
                  </Button>
                )}
                {subscription && (
                  <Button
                    component={Link}
                    href="/it/pricing"
                    variant="light"
                    leftSection={<IconTrendingUp size={18} />}
                  >
                    Cambia Piano
                  </Button>
                )}
              </Group>
            </Paper>
          </Grid.Col>

          {/* Side Cards */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="md">
              {/* Quick Stats Card */}
              <Card p="lg" radius="md" withBorder>
                <Text fw={600} mb="md">Il Tuo Piano Include</Text>
                <Stack gap="sm">
                  <Group gap="xs">
                    <ThemeIcon size="sm" radius="xl" color="green" variant="light">
                      <IconCheck size={12} />
                    </ThemeIcon>
                    <Text size="sm">
                      {plan?.maxStudents ? `${plan.maxStudents} studenti` : 'Studenti illimitati'}
                    </Text>
                  </Group>
                  <Group gap="xs">
                    <ThemeIcon size="sm" radius="xl" color="green" variant="light">
                      <IconCheck size={12} />
                    </ThemeIcon>
                    <Text size="sm">
                      {plan?.maxTeachers ? `${plan.maxTeachers} insegnanti` : 'Insegnanti illimitati'}
                    </Text>
                  </Group>
                  <Group gap="xs">
                    <ThemeIcon size="sm" radius="xl" color="green" variant="light">
                      <IconCheck size={12} />
                    </ThemeIcon>
                    <Text size="sm">
                      {plan?.maxClasses ? `${plan.maxClasses} classi` : 'Classi illimitate'}
                    </Text>
                  </Group>
                  <Group gap="xs">
                    <ThemeIcon size="sm" radius="xl" color="green" variant="light">
                      <IconCheck size={12} />
                    </ThemeIcon>
                    <Text size="sm">Backup automatici</Text>
                  </Group>
                  <Group gap="xs">
                    <ThemeIcon size="sm" radius="xl" color="green" variant="light">
                      <IconCheck size={12} />
                    </ThemeIcon>
                    <Text size="sm">Supporto email</Text>
                  </Group>
                </Stack>
              </Card>

              {/* Help Card */}
              <Card p="lg" radius="md" withBorder bg="gray.0">
                <Text fw={600} mb="sm">Hai bisogno di aiuto?</Text>
                <Text size="sm" c="dimmed" mb="md">
                  Il nostro team è qui per assisterti con qualsiasi domanda sulla fatturazione.
                </Text>
                <Button
                  component="a"
                  href="mailto:billing@insegnami.pro"
                  variant="light"
                  fullWidth
                  leftSection={<IconExternalLink size={16} />}
                >
                  Contatta Supporto
                </Button>
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
