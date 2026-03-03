'use client';

import { useEffect, useState } from 'react';
import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Stack,
  Card,
  Badge,
  ThemeIcon,
  Box,
  Center,
  SimpleGrid,
  rem,
  Loader,
  Alert,
  Switch,
  Paper,
  Divider,
  Anchor,
  Grid
} from '@mantine/core';
import {
  IconCheck,
  IconStar,
  IconRocket,
  IconAlertCircle,
  IconArrowRight,
  IconMail
} from '@tabler/icons-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface Plan {
  id: string;
  name: string;
  slug: string;
  stripePriceId: string;
  price: number;
  interval: string;
  maxStudents: number | null;
  maxTeachers: number | null;
  maxClasses: number | null;
  features: Record<string, boolean>;
  description: string | null;
  isPopular: boolean;
}

const planColors: Record<string, string> = {
  starter: 'blue',
  professional: 'green',
  enterprise: 'violet'
};

const planFeatures: Record<string, string[]> = {
  starter: [
    'Funzionalità base complete',
    'Supporto email',
    'Backup automatico giornaliero',
    '14 giorni di prova gratuita'
  ],
  professional: [
    'Tutto di Starter',
    'Analytics avanzate',
    'API & integrazioni',
    'White-label personalizzabile',
    'Supporto prioritario'
  ],
  enterprise: [
    'Tutto di Professional',
    'Multi-sede/campus',
    'SLA 99.9% garantito',
    'Supporto dedicato 24/7',
    'Integrazioni custom'
  ]
};

export default function PricingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch('/api/subscriptions/plans');
      if (!response.ok) throw new Error('Errore nel caricamento dei piani');
      const data = await response.json();
      setPlans(data.plans);
    } catch (err) {
      setError('Impossibile caricare i piani. Riprova più tardi.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (status !== 'authenticated') {
      // Redirect to register with plan info
      router.push(`/it/auth/register?plan=${planId}`);
      return;
    }

    setCheckoutLoading(planId);
    setError(null);

    try {
      const response = await fetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, interval: billingInterval }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Errore durante la creazione del checkout');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore imprevisto');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const getDisplayPrice = (plan: Plan): string => {
    const price = billingInterval === 'yearly'
      ? Math.round(plan.price * 10) // 2 months free for yearly
      : plan.price;
    return `€${price}`;
  };

  const getStudentLimit = (plan: Plan): string => {
    if (!plan.maxStudents) return 'Studenti illimitati';
    return `Fino a ${plan.maxStudents} studenti`;
  };

  return (
    <Box style={{ overflow: 'hidden', minHeight: '100vh' }}>
      {/* Hero Section */}
      <Box style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
        position: 'relative'
      }} py={80}>
        <Container size="xl">
          <Center>
            <Stack gap="md" style={{ textAlign: 'center', maxWidth: '700px' }}>
              <Badge size="lg" variant="light" color="yellow">Prezzi Trasparenti</Badge>
              <Title size={rem(48)} fw={900} c="white">
                Scegli il piano perfetto per la tua scuola
              </Title>
              <Text size="lg" style={{ color: 'rgba(255,255,255,0.8)' }}>
                Nessun costo nascosto. 14 giorni di prova gratuita. Cancella quando vuoi.
              </Text>

              {/* Billing Toggle */}
              <Group justify="center" mt="md">
                <Text c="white" fw={billingInterval === 'monthly' ? 700 : 400}>Mensile</Text>
                <Switch
                  size="lg"
                  checked={billingInterval === 'yearly'}
                  onChange={(e) => setBillingInterval(e.currentTarget.checked ? 'yearly' : 'monthly')}
                  color="green"
                />
                <Group gap={4}>
                  <Text c="white" fw={billingInterval === 'yearly' ? 700 : 400}>Annuale</Text>
                  <Badge size="sm" color="green" variant="filled">-17%</Badge>
                </Group>
              </Group>
            </Stack>
          </Center>
        </Container>
      </Box>

      {/* Plans Section */}
      <Box py={80} style={{ background: '#f8f9fa' }}>
        <Container size="xl">
          {error && (
            <Alert icon={<IconAlertCircle />} color="red" mb="xl" onClose={() => setError(null)} withCloseButton>
              {error}
            </Alert>
          )}

          {loading ? (
            <Center py={100}>
              <Loader size="xl" />
            </Center>
          ) : (
            <Grid gutter={30}>
              {/* SaaS Plans */}
              <Grid.Col span={{ base: 12, lg: 8 }}>
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg">
                  {plans.map((plan) => {
                    const color = planColors[plan.slug] || 'blue';
                    const features = planFeatures[plan.slug] || [];
                    const isLoading = checkoutLoading === plan.id;

                    return (
                      <Card
                        key={plan.id}
                        padding="xl"
                        radius="xl"
                        shadow="md"
                        style={{
                          position: 'relative',
                          transform: plan.isPopular ? 'scale(1.05)' : 'scale(1)',
                          border: plan.isPopular ? `2px solid var(--mantine-color-${color}-6)` : '1px solid #e2e8f0',
                          zIndex: plan.isPopular ? 1 : 0
                        }}
                      >
                        {plan.isPopular && (
                          <Badge
                            size="md"
                            variant="filled"
                            color={color}
                            mb="md"
                            leftSection={<IconStar size={14} />}
                          >
                            Più Popolare
                          </Badge>
                        )}

                        {!plan.isPopular && (
                          <Badge size="md" variant="light" color={color} mb="md">
                            {plan.name}
                          </Badge>
                        )}

                        <Group align="baseline" gap={4} mb="xs">
                          <Text size={rem(48)} fw={900} c="dark">
                            {getDisplayPrice(plan)}
                          </Text>
                          <Text c="dimmed">
                            /{billingInterval === 'yearly' ? 'anno' : 'mese'}
                          </Text>
                        </Group>

                        <Text c="dimmed" size="sm" mb="lg">
                          {getStudentLimit(plan)}
                        </Text>

                        <Button
                          fullWidth
                          radius="xl"
                          color={color}
                          variant={plan.isPopular ? 'filled' : 'light'}
                          mb="lg"
                          loading={isLoading}
                          onClick={() => handleSubscribe(plan.id)}
                          rightSection={!isLoading && <IconRocket size={18} />}
                        >
                          {status === 'authenticated' ? 'Inizia Ora' : 'Prova Gratis'}
                        </Button>

                        <Stack gap="xs">
                          {features.map((feature, i) => (
                            <Group key={i} gap="xs" wrap="nowrap">
                              <ThemeIcon size="sm" radius="xl" color={color} variant="light">
                                <IconCheck size={14} />
                              </ThemeIcon>
                              <Text size="sm">{feature}</Text>
                            </Group>
                          ))}
                        </Stack>
                      </Card>
                    );
                  })}
                </SimpleGrid>
              </Grid.Col>

              {/* Full Installation */}
              <Grid.Col span={{ base: 12, lg: 4 }}>
                <Card
                  padding="xl"
                  radius="xl"
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    height: '100%',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <Box style={{
                    position: 'absolute',
                    top: '-50px',
                    right: '-50px',
                    width: '200px',
                    height: '200px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: '50%'
                  }} />

                  <Stack style={{ position: 'relative', zIndex: 1 }}>
                    <Badge
                      size="lg"
                      variant="filled"
                      style={{
                        background: 'rgba(0,0,0,0.2)',
                        alignSelf: 'flex-start'
                      }}
                      leftSection={<IconStar size={16} />}
                    >
                      Self-Hosted
                    </Badge>

                    <Title order={2} c="white" size={rem(28)}>
                      Installazione Full
                    </Title>
                    <Text c="white" size="md" style={{ opacity: 0.95 }}>
                      La tua scuola, i tuoi server, il tuo controllo totale
                    </Text>

                    <Divider color="rgba(255,255,255,0.3)" my="md" />

                    <Stack gap="md">
                      <Box>
                        <Group align="baseline" gap={4}>
                          <Text size={rem(36)} fw={900} c="white">€699</Text>
                          <Text c="white" style={{ opacity: 0.9 }}>una tantum</Text>
                        </Group>
                        <Text size="sm" c="white" style={{ opacity: 0.8 }}>
                          Setup + installazione + formazione
                        </Text>
                      </Box>

                      <Box>
                        <Group align="baseline" gap={4}>
                          <Text size={rem(36)} fw={900} c="white">€299</Text>
                          <Text c="white" style={{ opacity: 0.9 }}>/anno</Text>
                        </Group>
                        <Text size="sm" c="white" style={{ opacity: 0.8 }}>
                          Manutenzione + aggiornamenti
                        </Text>
                      </Box>
                    </Stack>

                    <Divider color="rgba(255,255,255,0.3)" my="md" />

                    <SimpleGrid cols={2} spacing="xs">
                      {['Server proprietari', 'Codice sorgente', 'No limiti', 'Priorità supporto'].map((item, i) => (
                        <Group key={i} gap="xs" wrap="nowrap">
                          <ThemeIcon size="sm" radius="xl" style={{ background: 'rgba(255,255,255,0.2)' }}>
                            <IconCheck size={14} />
                          </ThemeIcon>
                          <Text size="sm" c="white">{item}</Text>
                        </Group>
                      ))}
                    </SimpleGrid>

                    <Button
                      size="lg"
                      fullWidth
                      radius="xl"
                      mt="md"
                      style={{
                        background: 'white',
                        color: '#d97706',
                        fontWeight: 700
                      }}
                      component="a"
                      href="mailto:info@insegnami.pro?subject=Richiesta%20Installazione%20Full"
                      rightSection={<IconArrowRight size={20} />}
                    >
                      Richiedi Preventivo
                    </Button>
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>
          )}
        </Container>
      </Box>

      {/* FAQ Section */}
      <Box py={80}>
        <Container size="md">
          <Center mb={40}>
            <Stack gap="md" style={{ textAlign: 'center' }}>
              <Title order={2} size={rem(36)} fw={900}>
                Domande Frequenti
              </Title>
            </Stack>
          </Center>

          <Stack gap="lg">
            <Paper p="lg" radius="md" withBorder>
              <Text fw={700} mb="xs">Posso provare prima di pagare?</Text>
              <Text c="dimmed" size="sm">
                Tutti i piani includono 14 giorni di prova gratuita. Non è richiesta carta di credito per iniziare.
              </Text>
            </Paper>
            <Paper p="lg" radius="md" withBorder>
              <Text fw={700} mb="xs">Posso cambiare piano in qualsiasi momento?</Text>
              <Text c="dimmed" size="sm">
                Puoi fare upgrade o downgrade del tuo piano in qualsiasi momento dalla dashboard di fatturazione.
              </Text>
            </Paper>
            <Paper p="lg" radius="md" withBorder>
              <Text fw={700} mb="xs">Cosa succede ai miei dati se cancello?</Text>
              <Text c="dimmed" size="sm">
                I tuoi dati rimangono disponibili per 30 giorni dopo la cancellazione. Puoi esportarli in qualsiasi momento.
              </Text>
            </Paper>
            <Paper p="lg" radius="md" withBorder>
              <Text fw={700} mb="xs">Quali metodi di pagamento accettate?</Text>
              <Text c="dimmed" size="sm">
                Accettiamo tutte le principali carte di credito/debito (Visa, Mastercard, American Express) tramite Stripe.
              </Text>
            </Paper>
          </Stack>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box py={80} style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}>
        <Container size="md">
          <Center>
            <Stack gap="xl" style={{ textAlign: 'center' }}>
              <Title order={2} size={rem(42)} fw={900} c="white">
                Pronto a digitalizzare la tua scuola?
              </Title>
              <Text size="xl" c="white" style={{ opacity: 0.95 }}>
                Unisciti a centinaia di scuole che hanno già semplificato la loro gestione
              </Text>
              <Group justify="center" gap="md">
                <Button
                  size="xl"
                  radius="xl"
                  style={{
                    background: 'white',
                    color: '#667eea',
                    fontWeight: 700,
                    padding: '0 50px'
                  }}
                  component={Link}
                  href="/it/auth/register"
                  rightSection={<IconRocket size={20} />}
                >
                  Inizia la Prova Gratuita
                </Button>
              </Group>
              <Group justify="center" gap={30}>
                <Group gap="xs">
                  <IconCheck size={20} color="white" />
                  <Text c="white" size="sm">14 giorni gratis</Text>
                </Group>
                <Group gap="xs">
                  <IconCheck size={20} color="white" />
                  <Text c="white" size="sm">No carta richiesta</Text>
                </Group>
                <Group gap="xs">
                  <IconCheck size={20} color="white" />
                  <Text c="white" size="sm">Cancella quando vuoi</Text>
                </Group>
              </Group>
            </Stack>
          </Center>
        </Container>
      </Box>

      {/* Footer */}
      <Box component="footer" style={{ background: '#0f172a', color: 'white' }} py={40}>
        <Container size="xl">
          <Group justify="space-between" align="center">
            <Group gap="xl">
              <Anchor component={Link} href="/" c="white" size="sm">Home</Anchor>
              <Anchor component={Link} href="/it/auth/login" c="dimmed" size="sm">Login</Anchor>
              <Anchor component={Link} href="/it/auth/register" c="dimmed" size="sm">Registrati</Anchor>
            </Group>
            <Group gap="xs">
              <ThemeIcon size="md" radius="xl" variant="light">
                <IconMail size={16} />
              </ThemeIcon>
              <Text size="sm" c="dimmed">info@insegnami.pro</Text>
            </Group>
          </Group>
          <Divider my="lg" color="rgba(255,255,255,0.1)" />
          <Text size="sm" c="dimmed" ta="center">
            © {new Date().getFullYear()} InsegnaMi.pro. Tutti i diritti riservati. | P.IVA: 07327360488
          </Text>
        </Container>
      </Box>
    </Box>
  );
}
