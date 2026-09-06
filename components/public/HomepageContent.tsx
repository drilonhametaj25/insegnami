'use client';

import {
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
  Text,
  ThemeIcon,
  Title,
  rem,
} from '@mantine/core';
import {
  IconArrowRight,
  IconBell,
  IconCalculator,
  IconCalendar,
  IconCertificate,
  IconChartBar,
  IconCheck,
  IconClipboardCheck,
  IconCreditCard,
  IconFileInvoice,
  IconFileSpreadsheet,
  IconRocket,
  IconSchool,
  IconSparkles,
  IconStar,
  IconTable,
  IconUserPlus,
  IconUsers,
} from '@tabler/icons-react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ElementType, ReactNode } from 'react';
import type { PublicPlan } from '@/lib/billing/public-plans';
import { type FeatureKey } from '@/lib/billing/feature-catalog';
import { faqPageJsonLd } from '@/lib/structured-data';
import { CtaBanner, PUB_GRADIENT, SectionHeader } from './PublicUI';

// ─────────────────────────────────────────────────────────────────────────────
// I testi vivono in messages/*.json sotto `public.home`; qui restano solo i
// dati non testuali (icone, slug, immagini) allineati per indice agli array
// dei messaggi.
// ─────────────────────────────────────────────────────────────────────────────

const PATH_CARDS: { icon: ElementType; slug: string }[] = [
  { icon: IconSchool, slug: 'gestionale-scuole-di-lingue' },
  { icon: IconCertificate, slug: 'registro-elettronico' },
];

const HOW_ICONS: ElementType[] = [IconUserPlus, IconFileSpreadsheet, IconRocket];

const BLOCK_MEDIA: { icon: ElementType; image: string; slug: string }[] = [
  {
    icon: IconClipboardCheck,
    image: '/images/screenshots/registro-lezione.png',
    slug: 'gestione-presenze',
  },
  { icon: IconChartBar, image: '/images/screenshots/voti.png', slug: 'registro-elettronico' },
  {
    icon: IconCreditCard,
    image: '/images/screenshots/pagamenti.png',
    slug: 'gestione-pagamenti-scuola',
  },
  {
    icon: IconBell,
    image: '/images/screenshots/comunicazioni.png',
    slug: 'comunicazioni-scuola-famiglia',
  },
  {
    icon: IconFileInvoice,
    image: '/images/screenshots/dashboard-admin.png',
    slug: 'gestione-pagamenti-scuola',
  },
  {
    icon: IconUsers,
    image: '/images/screenshots/portale-genitori.png',
    slug: 'comunicazioni-scuola-famiglia',
  },
];

const TOOL_CARDS: { slug: string; icon: ElementType }[] = [
  { slug: 'calcolatore-media-voti', icon: IconCalculator },
  { slug: 'calcolatore-presenze', icon: IconClipboardCheck },
  { slug: 'generatore-calendario-scolastico', icon: IconCalendar },
  { slug: 'generatore-orario-settimanale', icon: IconTable },
];

// Feature chiave da mostrare nei bullet dei piani, in ordine di priorità per
// slug. Filtrate SEMPRE su plan.features: mai promettere feature non attive.
const PLAN_FEATURE_PRIORITY: Record<string, FeatureKey[]> = {
  starter: ['paymentReminders', 'einvoicing', 'analytics', 'bulkImport'],
  professional: ['einvoicing', 'analytics', 'bulkImport', 'hoursPackages'],
  enterprise: ['automationsConfig', 'whiteLabel', 'auditTrail', 'analytics'],
};

const ALL_FEATURE_KEYS_ORDERED: FeatureKey[] = [
  'paymentReminders',
  'einvoicing',
  'payroll',
  'accounting',
  'hoursPackages',
  'analytics',
  'scheduleGenerator',
  'bulkImport',
  'absenceJustifications',
  'automationsConfig',
  'whiteLabel',
  'auditTrail',
];

function planFeatureKeys(plan: PublicPlan): FeatureKey[] {
  const priority = PLAN_FEATURE_PRIORITY[plan.slug] ?? [];
  const fallback = ALL_FEATURE_KEYS_ORDERED.filter((key) => !priority.includes(key));
  return [...priority, ...fallback]
    .filter((key) => plan.features?.[key] === true)
    .slice(0, 4);
}

/** Cornice "browser" (barra con pallini) per gli screenshot di prodotto. */
function BrowserFrame({
  src,
  alt,
  priority = false,
  shadow = '0 24px 48px rgba(15, 23, 42, 0.14)',
}: {
  src: string;
  alt: string;
  priority?: boolean;
  shadow?: string;
}) {
  return (
    <Box
      style={{
        border: '1px solid var(--pub-border)',
        borderRadius: rem(14),
        overflow: 'hidden',
        boxShadow: shadow,
        background: 'white',
      }}
    >
      <Group
        gap={6}
        px="md"
        py={10}
        style={{ borderBottom: '1px solid var(--pub-border)', background: 'var(--pub-surface)' }}
      >
        {['#fca5a5', '#fcd34d', '#6ee7b7'].map((color) => (
          <Box key={color} w={10} h={10} style={{ borderRadius: '50%', background: color }} />
        ))}
      </Group>
      <Image
        src={src}
        alt={alt}
        width={1440}
        height={900}
        priority={priority}
        style={{ width: '100%', height: 'auto', display: 'block' }}
      />
    </Box>
  );
}

function CheckItem({ children }: { children: ReactNode }) {
  return (
    <Group gap="xs" wrap="nowrap" align="flex-start">
      <ThemeIcon size={20} radius="xl" color="teal" variant="light" mt={2}>
        <IconCheck size={12} />
      </ThemeIcon>
      <Text size="sm" c="gray.7">
        {children}
      </Text>
    </Group>
  );
}

export function HomepageContent({ locale, plans }: { locale: string; plans: PublicPlan[] }) {
  const t = useTranslations('public.home');
  const tPlanFeature = useTranslations('public.planFeatures');

  const microTrust = t.raw('hero.microTrust') as string[];
  const pathCards = t.raw('paths.cards') as {
    title: string;
    description: string;
    bullets: string[];
    linkLabel: string;
  }[];
  const howSteps = t.raw('how.steps') as { title: string; description: string }[];
  const blockItems = t.raw('blocks.items') as {
    title: string;
    description: string;
    alt: string;
  }[];
  const toolItems = t.raw('tools.items') as { title: string; description: string }[];
  const faqItems = t.raw('faq.items') as { question: string; answer: string }[];
  const selfHostedBullets = t.raw('selfHosted.bullets') as string[];

  const planStudentsLabel = (plan: PublicPlan): string =>
    plan.maxStudents != null
      ? t('pricing.studentsUpTo', { count: plan.maxStudents })
      : t('pricing.unlimitedStudents');

  return (
    <Box style={{ overflow: 'hidden' }}>
      {/* FAQ structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd(faqItems)) }}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <Box className="pub-hero">
        <Container size="xl" py={{ base: 56, sm: 96 }}>
          <Grid align="center" gutter={{ base: 32, md: 48 }}>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Badge
                size="lg"
                variant="light"
                color="navy"
                radius="xl"
                leftSection={<IconSparkles size={14} />}
                mb="lg"
              >
                {t('hero.badge')}
              </Badge>

              <Title fz={{ base: rem(36), sm: rem(50) }} fw={900} lh={1.1} c="var(--pub-ink)" mb="lg">
                {t('hero.titleStart')}{' '}
                <span className="pub-gradient-text">{t('hero.titleHighlight')}</span>
              </Title>

              <Text size="xl" c="dimmed" mb={32} maw={560}>
                {t('hero.subtitle')}
              </Text>

              <Group gap="md">
                <Button
                  component={Link}
                  href={`/${locale}/auth/register`}
                  size="lg"
                  radius="xl"
                  variant="gradient"
                  gradient={PUB_GRADIENT}
                  fw={700}
                  rightSection={<IconArrowRight size={18} />}
                  data-testid="home-cta-trial"
                >
                  {t('hero.ctaPrimary')}
                </Button>
                <Button
                  component={Link}
                  href={`/${locale}/auth/login?demo=true`}
                  size="lg"
                  radius="xl"
                  variant="default"
                  data-testid="home-cta-demo"
                >
                  {t('hero.ctaSecondary')}
                </Button>
              </Group>

              <Group mt={28} gap={20}>
                {microTrust.map((item) => (
                  <Group key={item} gap={6}>
                    <ThemeIcon size={18} radius="xl" variant="light" color="teal">
                      <IconCheck size={12} />
                    </ThemeIcon>
                    <Text size="sm" c="gray.7" fw={500}>
                      {item}
                    </Text>
                  </Group>
                ))}
              </Group>

              <Text mt="lg" size="sm" c="dimmed">
                {t('hero.loginPrompt')}{' '}
                <Text
                  component={Link}
                  href={`/${locale}/auth/login`}
                  inherit
                  fw={600}
                  c="navy.6"
                  style={{ textDecoration: 'none' }}
                >
                  {t('hero.loginLink')}
                </Text>
              </Text>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 6 }}>
              <BrowserFrame
                src="/images/screenshots/dashboard-admin.png"
                alt={t('hero.screenshotAlt')}
                priority
              />
            </Grid.Col>
          </Grid>
        </Container>
      </Box>

      {/* ── Due percorsi ─────────────────────────────────────────────────── */}
      <Box py={{ base: 64, sm: 96 }} bg="white">
        <Container size="xl">
          <SectionHeader
            badge={t('paths.badge')}
            title={t('paths.title')}
            highlight={t('paths.highlight')}
            subtitle={t('paths.subtitle')}
          />

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="xl" maw={980} mx="auto">
            {PATH_CARDS.map((card, index) => {
              const CardIcon = card.icon;
              const texts = pathCards[index];
              return (
                <Card key={card.slug} padding="xl" radius="lg" className="pub-card" h="100%">
                  <ThemeIcon size={52} radius="md" color="navy" variant="light" mb="md">
                    <CardIcon size={28} />
                  </ThemeIcon>
                  <Text fw={700} size="xl" mb={6} c="var(--pub-ink)">
                    {texts.title}
                  </Text>
                  <Text size="sm" c="dimmed" lh={1.6} mb="md">
                    {texts.description}
                  </Text>
                  <Stack gap={10} mb="lg">
                    {texts.bullets.map((bullet) => (
                      <CheckItem key={bullet}>{bullet}</CheckItem>
                    ))}
                  </Stack>
                  <Text
                    component={Link}
                    href={`/${locale}/funzionalita/${card.slug}`}
                    size="sm"
                    fw={600}
                    c="navy.6"
                    style={{ textDecoration: 'none' }}
                  >
                    {texts.linkLabel} →
                  </Text>
                </Card>
              );
            })}
          </SimpleGrid>
        </Container>
      </Box>

      {/* ── Come funziona ────────────────────────────────────────────────── */}
      <Box py={{ base: 64, sm: 96 }} bg="var(--pub-surface)">
        <Container size="xl">
          <SectionHeader
            badge={t('how.badge')}
            title={t('how.title')}
            highlight={t('how.highlight')}
            subtitle={t('how.subtitle')}
          />

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" maw={980} mx="auto">
            {howSteps.map((step, index) => {
              const StepIcon = HOW_ICONS[index];
              return (
                <Card key={step.title} padding="xl" radius="lg" bg="white" className="pub-card" h="100%">
                  <Group gap="sm" mb="md">
                    <ThemeIcon size={40} radius="xl" variant="gradient" gradient={PUB_GRADIENT}>
                      <Text fw={800} fz="md" c="white">
                        {index + 1}
                      </Text>
                    </ThemeIcon>
                    <ThemeIcon size={40} radius="md" color="navy" variant="light">
                      <StepIcon size={22} />
                    </ThemeIcon>
                  </Group>
                  <Text fw={700} size="lg" mb={6} c="var(--pub-ink)">
                    {step.title}
                  </Text>
                  <Text size="sm" c="dimmed" lh={1.6}>
                    {step.description}
                  </Text>
                </Card>
              );
            })}
          </SimpleGrid>
        </Container>
      </Box>

      {/* ── Blocchi feature con screenshot ───────────────────────────────── */}
      <Box id="features" py={{ base: 64, sm: 96 }} bg="white">
        <Container size="xl">
          <SectionHeader
            badge={t('blocks.badge')}
            title={t('blocks.title')}
            highlight={t('blocks.highlight')}
            subtitle={t('blocks.subtitle')}
          />

          <Stack gap={80}>
            {BLOCK_MEDIA.map((block, index) => {
              const BlockIcon = block.icon;
              const texts = blockItems[index];
              return (
                <Grid key={texts.title} align="center" gutter={{ base: 24, md: 56 }}>
                  <Grid.Col
                    span={{ base: 12, md: 5 }}
                    order={{ base: 1, md: index % 2 === 0 ? 1 : 2 }}
                  >
                    <ThemeIcon size={52} radius="md" color="navy" variant="light" mb="md">
                      <BlockIcon size={28} />
                    </ThemeIcon>
                    <Title order={3} fz={rem(26)} fw={800} c="var(--pub-ink)" mb="sm">
                      {texts.title}
                    </Title>
                    <Text c="dimmed" lh={1.7} mb="md">
                      {texts.description}
                    </Text>
                    <Text
                      component={Link}
                      href={`/${locale}/funzionalita/${block.slug}`}
                      size="sm"
                      fw={600}
                      c="navy.6"
                      style={{ textDecoration: 'none' }}
                    >
                      {t('blocks.linkLabel')} →
                    </Text>
                  </Grid.Col>
                  <Grid.Col
                    span={{ base: 12, md: 7 }}
                    order={{ base: 2, md: index % 2 === 0 ? 2 : 1 }}
                  >
                    <BrowserFrame
                      src={block.image}
                      alt={texts.alt}
                      shadow="0 16px 36px rgba(15, 23, 42, 0.1)"
                    />
                  </Grid.Col>
                </Grid>
              );
            })}
          </Stack>
        </Container>
      </Box>

      {/* ── Strumenti gratuiti ───────────────────────────────────────────── */}
      <Box py={{ base: 64, sm: 96 }} bg="var(--pub-surface)">
        <Container size="xl">
          <SectionHeader
            badge={t('tools.badge')}
            title={t('tools.title')}
            highlight={t('tools.highlight')}
            subtitle={t('tools.subtitle')}
          />

          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
            {TOOL_CARDS.map((tool, index) => {
              const ToolIcon = tool.icon;
              const texts = toolItems[index];
              return (
                <Card
                  key={tool.slug}
                  component={Link}
                  href={`/${locale}/tools/${tool.slug}`}
                  padding="xl"
                  radius="lg"
                  bg="white"
                  className="pub-card"
                  style={{ textDecoration: 'none' }}
                >
                  <ThemeIcon size={52} radius="md" color="navy" variant="light" mb="md">
                    <ToolIcon size={28} />
                  </ThemeIcon>
                  <Text fw={700} size="lg" mb={6} c="var(--pub-ink)">
                    {texts.title}
                  </Text>
                  <Text size="sm" c="dimmed" lh={1.6}>
                    {texts.description}
                  </Text>
                </Card>
              );
            })}
          </SimpleGrid>

          <Group justify="center" mt={40}>
            <Button
              component={Link}
              href={`/${locale}/tools`}
              variant="outline"
              color="navy"
              size="md"
              radius="xl"
              rightSection={<IconArrowRight size={16} />}
            >
              {t('tools.allToolsLabel')}
            </Button>
          </Group>
        </Container>
      </Box>

      {/* ── Prezzi (dati server: stessa fonte di /pricing) ───────────────── */}
      <Box id="pricing" py={{ base: 64, sm: 96 }} bg="white">
        <Container size="xl">
          <SectionHeader
            badge={t('pricing.badge')}
            title={t('pricing.title')}
            highlight={t('pricing.highlight')}
            subtitle={t('pricing.subtitle')}
          />

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" maw={980} mx="auto">
            {plans.map((plan) => (
              <Card
                key={plan.slug}
                padding="xl"
                radius="lg"
                className="pub-card"
                h="100%"
                style={
                  plan.isPopular
                    ? { border: '2px solid var(--pub-brand-from)', position: 'relative' }
                    : undefined
                }
              >
                <Group justify="space-between" mb="md">
                  <Badge
                    size="md"
                    variant={plan.isPopular ? 'gradient' : 'light'}
                    gradient={plan.isPopular ? PUB_GRADIENT : undefined}
                    color="navy"
                    radius="xl"
                    leftSection={plan.isPopular ? <IconStar size={12} /> : undefined}
                  >
                    {plan.isPopular ? t('pricing.popular') : plan.name}
                  </Badge>
                </Group>
                {plan.isPopular && (
                  <Text fw={700} size="sm" c="navy.6" mb={4}>
                    {plan.name}
                  </Text>
                )}
                <Group align="baseline" gap={4} mb={4}>
                  <Text fz={rem(44)} fw={900} c="var(--pub-ink)">
                    €{plan.price}
                  </Text>
                  <Text c="dimmed">{t('pricing.perMonth')}</Text>
                </Group>
                <Text c="dimmed" size="sm" mb="lg">
                  {planStudentsLabel(plan)}
                </Text>
                <Button
                  component={Link}
                  href={
                    plan.slug === 'enterprise'
                      ? `/${locale}/contact?subject=enterprise`
                      : `/${locale}/pricing?plan=${plan.slug}`
                  }
                  fullWidth
                  radius="xl"
                  variant={plan.isPopular ? 'gradient' : 'light'}
                  gradient={plan.isPopular ? PUB_GRADIENT : undefined}
                  color="navy"
                  fw={600}
                  mb="lg"
                  data-testid={`home-plan-${plan.slug}`}
                >
                  {plan.slug === 'enterprise' ? t('pricing.ctaEnterprise') : t('pricing.ctaDefault')}
                </Button>
                <Stack gap={10}>
                  <CheckItem>{t('pricing.coreIncluded')}</CheckItem>
                  {planFeatureKeys(plan).map((key) => (
                    <CheckItem key={key}>{tPlanFeature(key)}</CheckItem>
                  ))}
                </Stack>
              </Card>
            ))}
          </SimpleGrid>

          <Text ta="center" size="sm" c="dimmed" mt="lg">
            {t('pricing.vatNote')}
          </Text>

          <Group justify="center" mt="md">
            <Text
              component={Link}
              href={`/${locale}/pricing`}
              size="sm"
              fw={600}
              c="navy.6"
              style={{ textDecoration: 'none' }}
            >
              {t('pricing.compareLabel')} →
            </Text>
          </Group>
        </Container>
      </Box>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <Box py={{ base: 64, sm: 96 }} bg="var(--pub-surface)">
        <Container size="md">
          <SectionHeader
            badge={t('faq.badge')}
            title={t('faq.title')}
            highlight={t('faq.highlight')}
          />

          <Stack gap="sm">
            {faqItems.map((faq) => (
              <Card key={faq.question} padding="lg" radius="md" bg="white" className="pub-card">
                <Text fw={600} size="sm" mb={6} c="var(--pub-ink)">
                  {faq.question}
                </Text>
                <Text size="sm" c="dimmed" lh={1.6}>
                  {faq.answer}
                </Text>
              </Card>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ── Fascia self-hosted ───────────────────────────────────────────── */}
      <Box py={{ base: 48, sm: 72 }} bg="white">
        <Container size="xl">
          <Card
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
                <Title order={3} c="white" fz={rem(28)} fw={800} mb="xs">
                  {t('selfHosted.title')}
                </Title>
                <Text c="gray.4" mb="lg">
                  {t('selfHosted.description')}
                </Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={8}>
                  {selfHostedBullets.map((item) => (
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
                    <Text fz={rem(36)} fw={900} c="white">
                      €699
                    </Text>
                  </Group>
                  <Text size="sm" c="gray.5" mb="md">
                    {t('selfHosted.setupLabel')}
                  </Text>
                  <Group align="baseline" gap={6}>
                    <Text fz={rem(36)} fw={900} c="white">
                      €299
                    </Text>
                  </Group>
                  <Text size="sm" c="gray.5" mb="lg">
                    {t('selfHosted.yearlyLabel')}
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

      {/* ── CTA finale ───────────────────────────────────────────────────── */}
      <CtaBanner locale={locale} title={t('cta.title')} subtitle={t('cta.subtitle')} />
    </Box>
  );
}
