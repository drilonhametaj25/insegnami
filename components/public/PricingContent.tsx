'use client';

import { useEffect, useState } from 'react';
import {
  Accordion,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Divider,
  Grid,
  Group,
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
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CtaBanner, PUB_GRADIENT, PageHero, SectionHeader } from '@/components/public/PublicUI';
import type { PublicPlan } from '@/lib/billing/public-plans';
import { ALL_FEATURE_KEYS } from '@/lib/billing/feature-catalog';

export interface PricingFaqItem {
  question: string;
  answer: string;
}

/**
 * Client island della pagina /pricing: i piani arrivano dal server (getPublicPlans)
 * come prop, così i prezzi stanno nell'HTML iniziale. Qui restano solo
 * interattività (toggle mensile/annuale, checkout, highlight ?plan=).
 */
export function PricingContent({
  plans,
  locale,
  preselectedPlan,
  faqs,
}: {
  plans: PublicPlan[];
  locale: string;
  preselectedPlan: string | null;
  faqs: PricingFaqItem[];
}) {
  const { status } = useSession();
  const router = useRouter();
  const t = useTranslations('public.pricing');
  const tPlanFeature = useTranslations('public.planFeatures');

  // Bullet derivati dai dati REALI del piano (DB): limiti numerici + feature
  // attive tradotte da public.planFeatures. Niente mappa hardcoded per slug:
  // la pagina non può divergere dal catalogo.
  const planBullets = (plan: {
    maxStudents: number | null;
    maxTeachers: number | null;
    maxClasses: number | null;
    features: Record<string, boolean> | null;
  }): string[] => {
    const limits = [
      plan.maxStudents
        ? t('limits.studentsUpTo', { count: plan.maxStudents })
        : t('limits.studentsUnlimited'),
      plan.maxTeachers
        ? t('limits.teachersUpTo', { count: plan.maxTeachers })
        : t('limits.teachersUnlimited'),
      plan.maxClasses
        ? t('limits.classesUpTo', { count: plan.maxClasses })
        : t('limits.classesUnlimited'),
    ];
    const featureLabels = ALL_FEATURE_KEYS.filter((key) => plan.features?.[key] === true).map(
      (key) => tPlanFeature(key)
    );
    return [...limits, ...featureLabels];
  };
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [highlightedPlan, setHighlightedPlan] = useState<string | null>(null);

  // Scroll ed evidenziazione del piano preselezionato (?plan=slug)
  useEffect(() => {
    if (preselectedPlan && plans.length > 0) {
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
  }, [preselectedPlan, plans]);

  const handleSubscribe = async (plan: PublicPlan) => {
    // Sessione ancora in caricamento: ignora il click invece di trattare
    // l'utente come anonimo (manderebbe un utente loggato alla registrazione)
    if (status === 'loading') return;
    // id nullo solo nel fallback da catalogo statico (DB non raggiungibile):
    // lo slug permette comunque al funnel di registrazione di riconoscere il piano
    const planId = plan.id ?? plan.slug;
    if (status !== 'authenticated') {
      // Non autenticato: redirect alla registrazione con piano E intervallo
      // scelti (il toggle annuale deve sopravvivere al funnel di signup)
      router.push(`/${locale}/auth/register?plan=${planId}&interval=${billingInterval}`);
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
        throw new Error(data.error || t('checkoutError'));
      }

      // Redirect a Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('unexpectedError'));
    } finally {
      setCheckoutLoading(null);
    }
  };

  const getDisplayPrice = (plan: PublicPlan): string => {
    // Annuale = 12 mesi al prezzo di 10 (stessa regola di catalogo e sync Stripe)
    const price = billingInterval === 'yearly' ? Math.round(plan.yearlyPrice) : plan.price;
    return `€${price}`;
  };

  const getStudentLimit = (plan: PublicPlan): string => {
    if (!plan.maxStudents) return t('limits.studentsUnlimited');
    return t('limits.studentsUpTo', { count: plan.maxStudents });
  };

  return (
    <Box style={{ overflow: 'hidden', minHeight: '100vh' }}>
      {/* Hero */}
      <PageHero
        badge={t('hero.badge')}
        title={t('hero.title')}
        highlight={t('hero.highlight')}
        subtitle={t('hero.subtitle')}
      >
        {/* Toggle fatturazione mensile/annuale */}
        <Group justify="center" mt="md">
          <Text fw={billingInterval === 'monthly' ? 700 : 400} c="var(--pub-ink)">
            {t('monthly')}
          </Text>
          <Switch
            size="lg"
            color="indigo"
            checked={billingInterval === 'yearly'}
            onChange={(e) => setBillingInterval(e.currentTarget.checked ? 'yearly' : 'monthly')}
          />
          <Group gap={6}>
            <Text fw={billingInterval === 'yearly' ? 700 : 400} c="var(--pub-ink)">
              {t('yearly')}
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

          {/* Piani SaaS */}
          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" maw={980} mx="auto">
            {plans.map((plan) => {
              const features = planBullets(plan);
              const isLoading = checkoutLoading === (plan.id ?? plan.slug);

              return (
                <Card
                  key={plan.slug}
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
                      {plan.isPopular ? t('popular') : plan.name}
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
                      {billingInterval === 'yearly' ? t('perYear') : t('perMonth')}
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
                    onClick={() => handleSubscribe(plan)}
                    rightSection={!isLoading && <IconRocket size={18} />}
                    data-testid={`subscribe-${plan.slug}`}
                  >
                    {status === 'authenticated' ? t('ctaAuth') : t('ctaGuest')}
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

          {/* Nota fiscale */}
          <Text ta="center" size="sm" c="dimmed" mt="lg">
            {t('vatNote')}
          </Text>

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
                  {t('selfHosted.badge')}
                </Badge>
                <Title order={2} c="white" fz={rem(28)} fw={800} mb="xs">
                  {t('selfHosted.title')}
                </Title>
                <Text c="gray.4" mb="lg">
                  {t('selfHosted.description')}
                </Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={8}>
                  {(t.raw('selfHosted.bullets') as string[]).map((item) => (
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
                    <Text c="gray.4">{t('selfHosted.oneTime')}</Text>
                  </Group>
                  <Text size="sm" c="gray.5" mb="md">
                    {t('selfHosted.setupLabel')}
                  </Text>
                  <Group align="baseline" gap={6}>
                    <Text fz={rem(40)} fw={900} c="white">
                      €299
                    </Text>
                    <Text c="gray.4">{t('perYear')}</Text>
                  </Group>
                  <Text size="sm" c="gray.5" mb="lg">
                    {t('selfHosted.maintenanceLabel')}
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
                    {t('selfHosted.cta')}
                  </Button>
                </Paper>
              </Grid.Col>
            </Grid>
          </Card>
        </Container>
      </Box>

      {/* FAQ */}
      <Box py={{ base: 64, sm: 96 }} bg="var(--pub-surface)">
        <Container size="md">
          <SectionHeader badge={t('faqBadge')} title={t('faqTitle')} highlight={t('faqHighlight')} />

          <Accordion
            variant="separated"
            radius="md"
            styles={{
              item: { backgroundColor: 'white', border: '1px solid var(--pub-border)' },
            }}
          >
            {faqs.map((faq) => (
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
      <CtaBanner locale={locale} title={t('ctaTitle')} />
    </Box>
  );
}
