'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
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
  Modal,
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
import { AddonsManager } from '@/components/billing/AddonsManager';

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
  description?: string | null;
  isPopular?: boolean;
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
  const locale = useLocale();
  const searchParams = useSearchParams();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [changingPlan, setChangingPlan] = useState<string | null>(null);
  // Checkout Stripe per i tenant SENZA abbonamento attivo (trial / no_subscription)
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [checkoutInterval, setCheckoutInterval] = useState<'monthly' | 'yearly'>('monthly');
  // Annullamento/riattivazione self-service dell'abbonamento
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [eligibility, setEligibility] = useState<
    Record<string, { allowed: boolean; message?: string }>
  >({});

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
    fetchPlans();
    fetchEligibility();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/subscriptions/plans');
      if (!res.ok) return;
      const result = await res.json();
      setPlans(result.plans || []);
    } catch {
      // non-blocking
    }
  };

  // Per ogni piano: il passaggio è permesso con le risorse attualmente in uso?
  const fetchEligibility = async () => {
    try {
      const res = await fetch('/api/subscriptions/change-plan');
      if (!res.ok) return;
      const result = await res.json();
      const map: Record<string, { allowed: boolean; message?: string }> = {};
      for (const e of result.eligibility || []) {
        map[e.planSlug] = { allowed: e.allowed, message: e.message };
      }
      setEligibility(map);
    } catch {
      // non-blocking
    }
  };

  const handleChangePlan = async (targetPlanSlug: string) => {
    setChangingPlan(targetPlanSlug);
    try {
      const res = await fetch('/api/subscriptions/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPlanSlug }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Errore nel cambio piano');
      notifications.show({
        title: 'Piano aggiornato',
        message: `Sei passato al piano ${result.newPlan?.name || targetPlanSlug}.`,
        color: 'green',
        icon: <IconCheck size={18} />,
      });
      await fetchSubscription();
      await fetchEligibility();
    } catch (err) {
      notifications.show({
        title: 'Errore',
        message: err instanceof Error ? err.message : 'Errore imprevisto',
        color: 'red',
      });
    } finally {
      setChangingPlan(null);
    }
  };

  // Avvia il checkout Stripe REALE per un piano scelto. Endpoint verificato:
  // POST /api/subscriptions/checkout  body { planId, interval } → { url, ... }.
  // In dev-billing l'endpoint attiva la subscription e ritorna comunque una url.
  const handleStartCheckout = async (planId: string) => {
    setCheckoutPlan(planId);
    try {
      const res = await fetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, interval: checkoutInterval }),
      });
      const result = await res.json();
      if (!res.ok || !result.url) {
        throw new Error(result.error || 'Errore nell\'avvio del checkout');
      }
      // Redirect verso Stripe Checkout (o, in dev-billing, verso billing?success).
      window.location.href = result.url;
    } catch (err) {
      notifications.show({
        title: 'Errore',
        message: err instanceof Error ? err.message : 'Errore imprevisto',
        color: 'red',
        icon: <IconAlertTriangle size={18} />,
      });
      setCheckoutPlan(null);
    }
  };

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

      // In dev billing mode la gestione avviene in-app (sezioni qui sotto).
      if (result.dev) {
        notifications.show({
          title: 'Gestione abbonamento',
          message: 'Cambia piano e gestisci gli add-on nelle sezioni qui sotto.',
          color: 'blue',
        });
        document.querySelector('[data-testid="addons-section"]')?.scrollIntoView({ behavior: 'smooth' });
        return;
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

  // Annulla l'abbonamento a fine periodo (resta attivo fino alla scadenza)
  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    try {
      const res = await fetch('/api/subscriptions/cancel', { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Errore nell'annullamento dell'abbonamento");
      notifications.show({
        title: 'Abbonamento annullato',
        message: `L'abbonamento resterà attivo fino al ${
          data?.subscription ? formatDate(data.subscription.currentPeriodEnd) : 'termine del periodo'
        } e non verrà rinnovato.`,
        color: 'orange',
        icon: <IconCheck size={18} />
      });
      setCancelModalOpen(false);
      await fetchSubscription();
    } catch (err) {
      notifications.show({
        title: 'Errore',
        message: err instanceof Error ? err.message : 'Errore imprevisto',
        color: 'red'
      });
    } finally {
      setCancelLoading(false);
    }
  };

  // Riattiva un abbonamento in annullamento (prima della scadenza del periodo)
  const handleReactivateSubscription = async () => {
    setReactivateLoading(true);
    try {
      const res = await fetch('/api/subscriptions/reactivate', { method: 'POST' });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Errore nella riattivazione dell'abbonamento");
      notifications.show({
        title: 'Abbonamento riattivato',
        message: 'Il rinnovo automatico è stato ripristinato.',
        color: 'green',
        icon: <IconCheck size={18} />
      });
      await fetchSubscription();
    } catch (err) {
      notifications.show({
        title: 'Errore',
        message: err instanceof Error ? err.message : 'Errore imprevisto',
        color: 'red'
      });
    } finally {
      setReactivateLoading(false);
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

  // Il checkout Stripe è destinato a chi NON ha un abbonamento attivo/in prova
  // gestito da Stripe: trial-tenant senza subscription, trial scaduto,
  // abbonamento cancellato/insoluto. Per ACTIVE/TRIALING reali si usa
  // "Cambia piano" (change-plan) o il portale di fatturazione.
  const canCheckout =
    !subscription || ['cancelled', 'unpaid', 'past_due', 'no_subscription'].includes(status);
  // In prova (con o senza subscription Stripe) mostriamo comunque i piani per
  // permettere l'attivazione anticipata, tranne quando la subscription Stripe
  // è già TRIALING (in quel caso l'endpoint checkout blocca: si usa change-plan/portale).
  const showCheckoutPlans =
    canCheckout || (status === 'trialing' && !subscription);

  const scrollToCheckout = () => {
    document
      .querySelector('[data-testid="checkout-plans-section"]')
      ?.scrollIntoView({ behavior: 'smooth' });
  };

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

        {/* Blocco accesso: il layout dashboard redirige qui quando il tenant
            è sospeso (trial scaduto / pagamento fallito / cancellato) */}
        {searchParams.get('blocked') && (
          <Alert
            icon={<IconAlertTriangle />}
            color="red"
            title="Accesso sospeso"
          >
            {searchParams.get('blocked') === 'trial-expired' &&
              'Il periodo di prova è terminato: scegli un piano qui sotto per continuare a usare InsegnaMi.'}
            {searchParams.get('blocked') === 'subscription-past-due' &&
              "L'ultimo pagamento non è riuscito: aggiorna il metodo di pagamento dal portale di fatturazione per riattivare il servizio."}
            {searchParams.get('blocked') === 'subscription-cancelled' &&
              "L'abbonamento non è attivo: riattivalo o scegli un piano per continuare."}
            {!['trial-expired', 'subscription-past-due', 'subscription-cancelled'].includes(
              searchParams.get('blocked') || ''
            ) && 'La scuola è temporaneamente sospesa. Contatta il supporto.'}
          </Alert>
        )}

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

        {/* Abbonamento in annullamento a fine periodo: riattivabile fino alla scadenza */}
        {subscription?.cancelAtPeriodEnd && (
          <Alert
            icon={<IconAlertTriangle />}
            color="orange"
            title="Abbonamento in annullamento"
            data-testid="cancel-at-period-end-alert"
          >
            L'abbonamento non verrà rinnovato e terminerà il {formatDate(subscription.currentPeriodEnd)}.
            Puoi riattivarlo in qualsiasi momento prima di quella data.
          </Alert>
        )}

        {(status === 'trialing' || status === 'no_subscription') && tenant?.trialUntil && !subscription && (
          <Alert
            icon={<IconClock />}
            color="navy"
            title="Periodo di Prova"
          >
            {new Date(tenant.trialUntil) > new Date()
              ? `Stai utilizzando la versione di prova. La prova termina il ${formatDate(tenant.trialUntil)} (${getDaysRemaining(tenant.trialUntil)} giorni rimasti).`
              : `Il tuo periodo di prova è terminato il ${formatDate(tenant.trialUntil)}. Scegli un piano per continuare a usare InsegnaMi.`}
            <Button
              size="xs"
              variant="filled"
              color="amber"
              mt="sm"
              onClick={scrollToCheckout}
              data-testid="trial-choose-plan-button"
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
                    <ThemeIcon size="lg" radius="md" color="navy" variant="light">
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
                    <Text size={rem(36)} fw={900} c="navy">
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
                        color={getUsagePercentage(usage.classes, plan.maxClasses) > 80 ? 'orange' : 'navy'}
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
                    leftSection={<IconCrown size={18} />}
                    variant="filled"
                    color="navy"
                    onClick={scrollToCheckout}
                    data-testid="choose-plan-button"
                  >
                    Scegli un Piano
                  </Button>
                )}
                {subscription && (
                  <Button
                    onClick={() =>
                      document
                        .querySelector('[data-testid="plan-change-section"]')
                        ?.scrollIntoView({ behavior: 'smooth' })
                    }
                    variant="light"
                    color="navy"
                    leftSection={<IconTrendingUp size={18} />}
                  >
                    Cambia Piano
                  </Button>
                )}
                {/* Annulla: visibile su abbonamento attivo/in prova non già in annullamento */}
                {subscription &&
                  ['active', 'trialing'].includes(status) &&
                  !subscription.cancelAtPeriodEnd && (
                    <Button
                      color="red"
                      variant="outline"
                      leftSection={<IconX size={18} />}
                      onClick={() => setCancelModalOpen(true)}
                      data-testid="cancel-subscription-button"
                    >
                      Annulla abbonamento
                    </Button>
                  )}
                {/* Riattiva: visibile quando l'abbonamento è in annullamento a fine periodo */}
                {subscription && subscription.cancelAtPeriodEnd && (
                  <Button
                    color="green"
                    leftSection={<IconRefresh size={18} />}
                    loading={reactivateLoading}
                    onClick={handleReactivateSubscription}
                    data-testid="reactivate-subscription-button"
                  >
                    Riattiva abbonamento
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
              <Card p="lg" radius="md" withBorder bg="var(--mantine-color-body)">
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

        {/* Scegli un piano → Stripe Checkout (tenant in prova / senza abbonamento attivo) */}
        {showCheckoutPlans && plans.length > 0 && (
          <Paper p="xl" radius="md" withBorder data-testid="checkout-plans-section">
            <Group justify="space-between" align="flex-start" mb="xs" wrap="wrap">
              <div>
                <Title order={3} mb={4}>
                  Scegli il tuo piano
                </Title>
                <Text c="dimmed" size="sm">
                  Attiva un abbonamento per continuare a usare InsegnaMi senza interruzioni.
                </Text>
              </div>
              {/* Toggle intervallo: mensile / annuale */}
              <Button.Group>
                <Button
                  variant={checkoutInterval === 'monthly' ? 'filled' : 'default'}
                  color="navy"
                  size="sm"
                  onClick={() => setCheckoutInterval('monthly')}
                  data-testid="checkout-interval-monthly"
                >
                  Mensile
                </Button>
                <Button
                  variant={checkoutInterval === 'yearly' ? 'filled' : 'default'}
                  color="navy"
                  size="sm"
                  onClick={() => setCheckoutInterval('yearly')}
                  data-testid="checkout-interval-yearly"
                >
                  Annuale
                </Button>
              </Button.Group>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mt="lg">
              {plans.map((p) => (
                <Card
                  key={p.id}
                  withBorder
                  radius="md"
                  p="lg"
                  data-testid={`checkout-plan-${p.slug}`}
                  style={
                    p.isPopular
                      ? { borderColor: 'var(--mantine-color-amber-5)', borderWidth: 2 }
                      : undefined
                  }
                >
                  <Group justify="space-between" mb="xs">
                    <Text fw={700}>{p.name}</Text>
                    {p.isPopular && (
                      <Badge color="amber" variant="filled">
                        Consigliato
                      </Badge>
                    )}
                  </Group>
                  {p.description && (
                    <Text size="xs" c="dimmed" mb="xs">
                      {p.description}
                    </Text>
                  )}
                  <Text size="xl" fw={900} c="navy" mb="xs">
                    €{p.price}
                    <Text span size="sm" c="dimmed" fw={400}>
                      /{p.interval === 'MONTHLY' ? 'mese' : 'anno'}
                    </Text>
                  </Text>
                  <Stack gap={4} mb="md">
                    <Group gap="xs">
                      <IconUsers size={14} />
                      <Text size="xs" c="dimmed">
                        {p.maxStudents ?? '∞'} studenti
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <IconSchool size={14} />
                      <Text size="xs" c="dimmed">
                        {p.maxTeachers ?? '∞'} docenti
                      </Text>
                    </Group>
                    <Group gap="xs">
                      <IconBook size={14} />
                      <Text size="xs" c="dimmed">
                        {p.maxClasses ?? '∞'} classi
                      </Text>
                    </Group>
                  </Stack>
                  <Button
                    fullWidth
                    color="amber"
                    leftSection={<IconCreditCard size={16} />}
                    loading={checkoutPlan === p.id}
                    disabled={checkoutPlan !== null && checkoutPlan !== p.id}
                    onClick={() => handleStartCheckout(p.id)}
                    data-testid={`checkout-plan-button-${p.slug}`}
                  >
                    Attiva abbonamento
                  </Button>
                </Card>
              ))}
            </SimpleGrid>
          </Paper>
        )}

        {/* Plan change (in-app upgrade/downgrade) */}
        {subscription && plans.length > 0 && (
          <Paper p="xl" radius="md" withBorder data-testid="plan-change-section">
            <Title order={3} mb="xs">Cambia Piano</Title>
            <Text c="dimmed" size="sm" mb="lg">
              Passa a un piano superiore o inferiore. La modifica è immediata.
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
              {plans.map((p) => {
                const isCurrent = p.slug === plan?.slug;
                const blocked = !isCurrent && eligibility[p.slug]?.allowed === false;
                return (
                  <Card key={p.id} withBorder radius="md" p="lg" data-testid={`plan-option-${p.slug}`}>
                    <Group justify="space-between" mb="xs">
                      <Text fw={700}>{p.name}</Text>
                      {isCurrent && <Badge color="navy">Attuale</Badge>}
                    </Group>
                    <Text size="xl" fw={900} c="navy" mb="xs">
                      €{p.price}
                      <Text span size="sm" c="dimmed" fw={400}>
                        /{p.interval === 'MONTHLY' ? 'mese' : 'anno'}
                      </Text>
                    </Text>
                    <Stack gap={4} mb="md">
                      <Text size="xs" c="dimmed">{p.maxStudents ?? '∞'} studenti</Text>
                      <Text size="xs" c="dimmed">{p.maxTeachers ?? '∞'} docenti</Text>
                      <Text size="xs" c="dimmed">{p.maxClasses ?? '∞'} classi</Text>
                    </Stack>
                    <Button
                      fullWidth
                      variant={isCurrent ? 'light' : 'filled'}
                      color="navy"
                      disabled={isCurrent || blocked || changingPlan !== null}
                      loading={changingPlan === p.slug}
                      onClick={() => handleChangePlan(p.slug)}
                      data-testid={`plan-change-${p.slug}`}
                    >
                      {isCurrent ? 'Piano attuale' : 'Scegli'}
                    </Button>
                    {blocked && (
                      <Text size="xs" c="red" mt="xs" data-testid={`plan-change-blocked-${p.slug}`}>
                        {eligibility[p.slug]?.message}
                      </Text>
                    )}
                  </Card>
                );
              })}
            </SimpleGrid>
          </Paper>
        )}

        {/* Add-on / espansioni */}
        {subscription && (
          <AddonsManager onChange={() => { fetchSubscription(); fetchUsage(); fetchEligibility(); }} />
        )}
      </Stack>

      {/* Modal di conferma annullamento abbonamento */}
      <Modal
        opened={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="Annulla abbonamento"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Sei sicuro di voler annullare l'abbonamento? Resterà attivo fino al{' '}
            <Text span fw={600}>
              {subscription ? formatDate(subscription.currentPeriodEnd) : 'termine del periodo'}
            </Text>
            {' '}e non verrà rinnovato. Potrai riattivarlo in qualsiasi momento prima di quella data.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setCancelModalOpen(false)} disabled={cancelLoading}>
              Mantieni abbonamento
            </Button>
            <Button
              color="red"
              loading={cancelLoading}
              onClick={handleCancelSubscription}
              data-testid="confirm-cancel-subscription"
            >
              Annulla abbonamento
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
