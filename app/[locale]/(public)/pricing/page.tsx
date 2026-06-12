'use client';

import { useEffect, useState } from 'react';
import {
  Accordion,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Center,
  Container,
  Divider,
  Grid,
  Group,
  Loader,
  Paper,
  SimpleGrid,
  Stack,
  Switch,
  Text,
  ThemeIcon,
  Title,
  rem,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowRight,
  IconCheck,
  IconRocket,
  IconStar,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { CtaBanner, PUB_GRADIENT, PageHero, SectionHeader } from '@/components/public/PublicUI';

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

const faqItems = [
  {
    question: 'Posso provare prima di pagare?',
    answer:
      'Tutti i piani includono 14 giorni di prova gratuita. Non è richiesta carta di credito per iniziare.',
  },
  {
    question: 'Posso cambiare piano in qualsiasi momento?',
    answer:
      'Puoi fare upgrade o downgrade del tuo piano in qualsiasi momento dalla dashboard di fatturazione.',
  },
  {
    question: 'Cosa succede ai miei dati se cancello?',
    answer:
      'I tuoi dati rimangono disponibili per 30 giorni dopo la cancellazione. Puoi esportarli in qualsiasi momento.',
  },
  {
    question: 'Quali metodi di pagamento accettate?',
    answer:
      'Accettiamo tutte le principali carte di credito/debito (Visa, Mastercard, American Express) tramite Stripe.',
  },
];

export default function PricingPage() {
  const { data: session, status } = useSession();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [highlightedPlan, setHighlightedPlan] = useState<string | null>(null);

  // Piano preselezionato dai query param (?plan=...)
  const preselectedPlan = searchParams.get('plan');

  useEffect(() => {
    fetchPlans();
  }, []);

  // Scroll ed evidenziazione del piano preselezionato
  useEffect(() => {
    if (preselectedPlan && !loading && plans.length > 0) {
      setHighlightedPlan(preselectedPlan);
      const planElement = document.getElementById(`plan-${preselectedPlan}`);
      if (planElement) {
        setTimeout(() => {
          planElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
      // Rimuove l'evidenziazione dopo 3 secondi
      const timer = setTimeout(() => setHighlightedPlan(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [preselectedPlan, loading, plans]);

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
    // Sessione ancora in caricamento: ignora il click invece di trattare
    // l'utente come anonimo (manderebbe un utente loggato alla registrazione)
    if (status === 'loading') return;
    if (status !== 'authenticated') {
      // Non autenticato: redirect alla registrazione con il piano scelto
      router.push(`/${locale}/auth/register?plan=${planId}`);
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

      // Redirect a Stripe Checkout
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
      ? Math.round(plan.price * 10) // 2 mesi gratis con l'annuale
      : plan.price;
    return `€${price}`;
  };

  const getStudentLimit = (plan: Plan): string => {
    if (!plan.maxStudents) return 'Studenti illimitati';
    return `Fino a ${plan.maxStudents} studenti`;
  };

  return (
    <Box style={{ overflow: 'hidden', minHeight: '100vh' }}>
      {/* Hero */}
      <PageHero
        badge="Prezzi trasparenti"
        title="Scegli il piano perfetto"
        highlight="per la tua scuola"
        subtitle="Nessun costo nascosto. 14 giorni di prova gratuita. Cancella quando vuoi."
      >
        {/* Toggle fatturazione mensile/annuale */}
        <Group justify="center" mt="md">
          <Text fw={billingInterval === 'monthly' ? 700 : 400} c="var(--pub-ink)">
            Mensile
          </Text>
          <Switch
            size="lg"
            color="indigo"
            checked={billingInterval === 'yearly'}
            onChange={(e) => setBillingInterval(e.currentTarget.checked ? 'yearly' : 'monthly')}
          />
          <Group gap={6}>
            <Text fw={billingInterval === 'yearly' ? 700 : 400} c="var(--pub-ink)">
              Annuale
            </Text>
            <Badge size="sm" variant="light" color="teal">
              -17%
            </Badge>
          </Group>
        </Group>
      </PageHero>

      {/* Piani */}
      <Box py={{ base: 64, sm: 96 }} bg="white">
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
            <>
              {/* Piani SaaS */}
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" maw={980} mx="auto">
                {plans.map((plan) => {
                  const features = planFeatures[plan.slug] || [];
                  const isLoading = checkoutLoading === plan.id;

                  return (
                    <Card
                      key={plan.id}
                      id={`plan-${plan.slug}`}
                      padding="xl"
                      radius="lg"
                      className="pub-card"
                      h="100%"
                      style={
                        highlightedPlan === plan.slug
                          ? {
                              border: '2px solid var(--mantine-color-violet-5)',
                              boxShadow: '0 0 0 4px rgba(124, 58, 237, 0.15)',
                            }
                          : plan.isPopular
                          ? { border: '2px solid var(--pub-brand-from)', position: 'relative' }
                          : undefined
                      }
                    >
                      <Group justify="space-between" mb="md">
                        <Badge
                          size="md"
                          variant={plan.isPopular ? 'gradient' : 'light'}
                          gradient={plan.isPopular ? PUB_GRADIENT : undefined}
                          color="indigo"
                          radius="xl"
                          leftSection={plan.isPopular ? <IconStar size={12} /> : undefined}
                        >
                          {plan.isPopular ? 'Più popolare' : plan.name}
                        </Badge>
                      </Group>

                      {plan.isPopular && (
                        <Text fw={700} size="sm" c="indigo.6" mb={4}>
                          {plan.name}
                        </Text>
                      )}

                      <Group align="baseline" gap={4} mb={4}>
                        <Text fz={rem(44)} fw={900} c="var(--pub-ink)">
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
                        variant={plan.isPopular ? 'gradient' : 'light'}
                        gradient={plan.isPopular ? PUB_GRADIENT : undefined}
                        color="indigo"
                        fw={600}
                        mb="lg"
                        loading={isLoading}
                        disabled={status === 'loading'}
                        onClick={() => handleSubscribe(plan.id)}
                        rightSection={!isLoading && <IconRocket size={18} />}
                        data-testid={`subscribe-${plan.slug}`}
                      >
                        {status === 'authenticated' ? 'Inizia Ora' : 'Prova Gratis'}
                      </Button>

                      <Stack gap={10}>
                        {features.map((feature) => (
                          <Group key={feature} gap="xs" wrap="nowrap">
                            <ThemeIcon size={20} radius="xl" color="teal" variant="light">
                              <IconCheck size={12} />
                            </ThemeIcon>
                            <Text size="sm" c="gray.7">
                              {feature}
                            </Text>
                          </Group>
                        ))}
                      </Stack>
                    </Card>
                  );
                })}
              </SimpleGrid>

              {/* Installazione self-hosted */}
              <Card
                mt={40}
                padding={36}
                radius="xl"
                maw={980}
                mx="auto"
                style={{ background: 'var(--pub-ink)', overflow: 'hidden', position: 'relative' }}
              >
                <Box
                  style={{
                    position: 'absolute',
                    top: '-120px',
                    right: '-80px',
                    width: '320px',
                    height: '320px',
                    background: 'var(--pub-brand-gradient)',
                    opacity: 0.25,
                    borderRadius: '50%',
                    filter: 'blur(80px)',
                  }}
                />
                <Grid align="center" gutter={32} style={{ position: 'relative', zIndex: 1 }}>
                  <Grid.Col span={{ base: 12, md: 7 }}>
                    <Badge size="lg" variant="gradient" gradient={PUB_GRADIENT} radius="xl" mb="md">
                      Installazione Full
                    </Badge>
                    <Title order={2} c="white" fz={rem(28)} fw={800} mb="xs">
                      La tua scuola, i tuoi server, il tuo controllo totale
                    </Title>
                    <Text c="gray.4" mb="lg">
                      Setup, installazione e formazione inclusi. Codice sorgente, dati tuoi, nessun
                      limite.
                    </Text>
                    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={8}>
                      {['Server proprietari', 'Codice sorgente', 'No limiti', 'Priorità supporto'].map((item) => (
                        <Group key={item} gap="xs" wrap="nowrap">
                          <IconCheck size={16} color="var(--mantine-color-teal-4)" />
                          <Text size="sm" c="gray.3">
                            {item}
                          </Text>
                        </Group>
                      ))}
                    </SimpleGrid>
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, md: 5 }}>
                    <Paper p="xl" radius="lg" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <Group align="baseline" gap={6}>
                        <Text fz={rem(40)} fw={900} c="white">
                          €699
                        </Text>
                        <Text c="gray.4">una tantum</Text>
                      </Group>
                      <Text size="sm" c="gray.5" mb="md">
                        Setup + installazione + formazione
                      </Text>
                      <Group align="baseline" gap={6}>
                        <Text fz={rem(40)} fw={900} c="white">
                          €299
                        </Text>
                        <Text c="gray.4">/anno</Text>
                      </Group>
                      <Text size="sm" c="gray.5" mb="lg">
                        Manutenzione + aggiornamenti
                      </Text>
                      <Divider color="rgba(255,255,255,0.1)" mb="lg" />
                      <Button
                        component={Link}
                        href={`/${locale}/contact?subject=full-installation`}
                        fullWidth
                        size="md"
                        radius="xl"
                        variant="gradient"
                        gradient={PUB_GRADIENT}
                        fw={600}
                        rightSection={<IconArrowRight size={16} />}
                      >
                        Richiedi preventivo
                      </Button>
                    </Paper>
                  </Grid.Col>
                </Grid>
              </Card>
            </>
          )}
        </Container>
      </Box>

      {/* FAQ */}
      <Box py={{ base: 64, sm: 96 }} bg="var(--pub-surface)">
        <Container size="md">
          <SectionHeader badge="FAQ" title="Domande" highlight="frequenti" />

          <Accordion
            variant="separated"
            radius="md"
            styles={{
              item: { backgroundColor: 'white', border: '1px solid var(--pub-border)' },
            }}
          >
            {faqItems.map((faq) => (
              <Accordion.Item key={faq.question} value={faq.question}>
                <Accordion.Control>
                  <Text fw={600} size="sm">
                    {faq.question}
                  </Text>
                </Accordion.Control>
                <Accordion.Panel>
                  <Text size="sm" c="dimmed" lh={1.6}>
                    {faq.answer}
                  </Text>
                </Accordion.Panel>
              </Accordion.Item>
            ))}
          </Accordion>
        </Container>
      </Box>

      {/* CTA finale */}
      <CtaBanner locale={locale} title="Pronto a iniziare?" />
    </Box>
  );
}
