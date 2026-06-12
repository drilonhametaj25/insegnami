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
  IconCalendarEvent,
  IconChartBar,
  IconCheck,
  IconClipboardCheck,
  IconCreditCard,
  IconFileText,
  IconHeadset,
  IconSchool,
  IconShield,
  IconSparkles,
  IconStar,
  IconTable,
  IconTrendingUp,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { PLAN_CATALOG } from '@/lib/billing/plans-catalog';
import { CtaBanner, PUB_GRADIENT, SectionHeader } from './PublicUI';

const features = [
  {
    icon: IconUsers,
    title: 'Gestione Studenti',
    description: 'Anagrafica completa, iscrizioni, classi e comunicazioni con i genitori',
  },
  {
    icon: IconCalendarEvent,
    title: 'Calendario & Lezioni',
    description: 'Pianificazione lezioni, calendario integrato e gestione orari',
  },
  {
    icon: IconClipboardCheck,
    title: 'Presenze Digitali',
    description: 'Registro presenze digitale con statistiche e notifiche automatiche',
  },
  {
    icon: IconCreditCard,
    title: 'Gestione Pagamenti',
    description: 'Fatturazione, rate, promemoria e tracking pagamenti',
  },
  {
    icon: IconBell,
    title: 'Comunicazioni',
    description: 'Bacheca, notifiche email/SMS e comunicazioni scuola-famiglia',
  },
  {
    icon: IconFileText,
    title: 'Materiali Didattici',
    description: 'Upload e condivisione di materiali, documenti e risorse',
  },
  {
    icon: IconChartBar,
    title: 'Report & Analytics',
    description: 'Dashboard con statistiche, report personalizzati e analytics',
  },
  {
    icon: IconShield,
    title: 'Sicurezza GDPR',
    description: 'Conforme alle normative privacy e protezione dati',
  },
];

const stats = [
  { value: '500+', label: 'Scuole attive', icon: IconSchool },
  { value: '50k+', label: 'Studenti gestiti', icon: IconUsers },
  { value: '99.9%', label: 'Uptime garantito', icon: IconTrendingUp },
  { value: '24/7', label: 'Supporto dedicato', icon: IconHeadset },
];

const toolsShowcase = [
  {
    slug: 'calcolatore-media-voti',
    title: 'Calcolatore Media Voti',
    description: 'Calcola la media dei voti con pesi personalizzati.',
    icon: IconCalculator,
  },
  {
    slug: 'calcolatore-presenze',
    title: 'Calcolatore Presenze',
    description: 'Calcola la percentuale di frequenza e verifica il monte ore.',
    icon: IconClipboardCheck,
  },
  {
    slug: 'generatore-calendario-scolastico',
    title: 'Generatore Calendario',
    description: 'Genera un calendario scolastico con festività e vacanze.',
    icon: IconCalendar,
  },
  {
    slug: 'generatore-orario-settimanale',
    title: 'Generatore Orario',
    description: 'Crea un orario settimanale delle lezioni da stampare.',
    icon: IconTable,
  },
];

// Bullet marketing per slug; prezzo, limiti e badge "popolare" arrivano dal
// catalogo canonico (lib/billing/plans-catalog), lo stesso di seed e sync
// Stripe: la homepage non può divergere da /pricing.
const planBullets: Record<string, string[]> = {
  starter: ['Funzionalità base', 'Supporto email', 'Backup automatico'],
  professional: ['Tutto di Starter', 'Analytics avanzate', 'API & integrazioni', 'White-label'],
  enterprise: ['Tutto di Professional', 'Multi-tenant', 'SLA 99.9%', 'Supporto dedicato'],
};

const plans = PLAN_CATALOG.map((plan) => ({
  name: plan.name,
  price: `€${plan.price}`,
  students:
    plan.maxStudents != null ? `Fino a ${plan.maxStudents} studenti` : 'Studenti illimitati',
  cta: plan.slug === 'enterprise' ? 'Contattaci' : 'Inizia ora',
  href: (locale: string) =>
    plan.slug === 'enterprise'
      ? `/${locale}/contact?subject=enterprise`
      : `/${locale}/pricing?plan=${plan.slug}`,
  items: planBullets[plan.slug] ?? [],
  popular: plan.isPopular,
}));

export function HomepageContent({ locale }: { locale: string }) {
  return (
    <Box style={{ overflow: 'hidden' }}>
      {/* Hero */}
      <Box className="pub-hero">
        <Container size="xl" py={{ base: 64, sm: 110 }}>
          <Grid align="center" gutter={48}>
            <Grid.Col span={{ base: 12, md: 7 }}>
              <Badge
                size="lg"
                variant="light"
                color="indigo"
                radius="xl"
                leftSection={<IconSparkles size={14} />}
                mb="lg"
              >
                Il gestionale per scuole e centri di formazione
              </Badge>

              <Title fz={{ base: rem(38), sm: rem(54) }} fw={900} lh={1.1} c="var(--pub-ink)" mb="lg">
                La gestione della tua scuola,{' '}
                <span className="pub-gradient-text">finalmente semplice</span>
              </Title>

              <Text size="xl" c="dimmed" mb={32} maw={560}>
                La piattaforma all-in-one che trasforma la gestione della tua scuola. Studenti,
                presenze, pagamenti e comunicazioni: tutto in un unico posto.
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
                >
                  Inizia gratis
                </Button>
                <Button
                  component={Link}
                  href={`/${locale}/auth/login?demo=true`}
                  size="lg"
                  radius="xl"
                  variant="default"
                >
                  Demo live
                </Button>
              </Group>

              <Group mt={28} gap={24}>
                {['14 giorni gratis', 'Nessuna carta richiesta', 'Cancella quando vuoi'].map((item) => (
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
                Sei già registrato?{' '}
                <Text
                  component={Link}
                  href={`/${locale}/auth/login`}
                  inherit
                  fw={600}
                  c="indigo.6"
                  style={{ textDecoration: 'none' }}
                >
                  Accedi
                </Text>
              </Text>
            </Grid.Col>

            <Grid.Col span={{ base: 12, md: 5 }}>
              <Card
                radius="xl"
                p="xl"
                bg="white"
                style={{
                  border: '1px solid var(--pub-border)',
                  boxShadow: '0 24px 48px rgba(15, 23, 42, 0.1)',
                }}
              >
                <SimpleGrid cols={2} spacing="lg">
                  {stats.map((stat) => (
                    <Stack key={stat.label} gap={4} align="center" ta="center" py="sm">
                      <ThemeIcon size={44} radius="md" variant="light" color="indigo">
                        <stat.icon size={24} />
                      </ThemeIcon>
                      <Text fz={rem(28)} fw={900} c="var(--pub-ink)" mt={6}>
                        {stat.value}
                      </Text>
                      <Text size="sm" c="dimmed">
                        {stat.label}
                      </Text>
                    </Stack>
                  ))}
                </SimpleGrid>
              </Card>
            </Grid.Col>
          </Grid>
        </Container>
      </Box>

      {/* Funzionalità */}
      <Box id="features" py={{ base: 64, sm: 96 }} bg="white">
        <Container size="xl">
          <SectionHeader
            badge="Funzionalità complete"
            title="Tutto quello che ti serve,"
            highlight="in un unico posto"
            subtitle="Una piattaforma completa che semplifica ogni aspetto della gestione scolastica"
          />

          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
            {features.map((feature) => (
              <Card key={feature.title} padding="xl" radius="lg" className="pub-card" h="100%">
                <ThemeIcon size={52} radius="md" color="indigo" variant="light" mb="md">
                  <feature.icon size={28} />
                </ThemeIcon>
                <Text fw={700} size="lg" mb={6} c="var(--pub-ink)">
                  {feature.title}
                </Text>
                <Text size="sm" c="dimmed" lh={1.6}>
                  {feature.description}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* Strumenti gratuiti */}
      <Box py={{ base: 64, sm: 96 }} bg="var(--pub-surface)">
        <Container size="xl">
          <SectionHeader
            badge="100% gratuiti"
            title="Strumenti gratuiti"
            highlight="per la tua scuola"
            subtitle="Calcolatori e generatori utili per la gestione quotidiana. Nessuna registrazione richiesta."
          />

          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
            {toolsShowcase.map((tool) => (
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
                <ThemeIcon size={52} radius="md" color="violet" variant="light" mb="md">
                  <tool.icon size={28} />
                </ThemeIcon>
                <Text fw={700} size="lg" mb={6} c="var(--pub-ink)">
                  {tool.title}
                </Text>
                <Text size="sm" c="dimmed" lh={1.6}>
                  {tool.description}
                </Text>
              </Card>
            ))}
          </SimpleGrid>

          <Group justify="center" mt={40}>
            <Button
              component={Link}
              href={`/${locale}/tools`}
              variant="outline"
              color="indigo"
              size="md"
              radius="xl"
              rightSection={<IconArrowRight size={16} />}
            >
              Vedi tutti gli strumenti
            </Button>
          </Group>
        </Container>
      </Box>

      {/* Prezzi */}
      <Box id="pricing" py={{ base: 64, sm: 96 }} bg="white">
        <Container size="xl">
          <SectionHeader
            badge="Prezzi trasparenti"
            title="Scegli il piano"
            highlight="perfetto per te"
            subtitle="Nessun costo nascosto. Cancella quando vuoi."
          />

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="lg" maw={980} mx="auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                padding="xl"
                radius="lg"
                className="pub-card"
                h="100%"
                style={
                  plan.popular
                    ? { border: '2px solid var(--pub-brand-from)', position: 'relative' }
                    : undefined
                }
              >
                <Group justify="space-between" mb="md">
                  <Badge
                    size="md"
                    variant={plan.popular ? 'gradient' : 'light'}
                    gradient={plan.popular ? PUB_GRADIENT : undefined}
                    color="indigo"
                    radius="xl"
                    leftSection={plan.popular ? <IconStar size={12} /> : undefined}
                  >
                    {plan.popular ? 'Più popolare' : plan.name}
                  </Badge>
                </Group>
                {plan.popular && (
                  <Text fw={700} size="sm" c="indigo.6" mb={4}>
                    {plan.name}
                  </Text>
                )}
                <Group align="baseline" gap={4} mb={4}>
                  <Text fz={rem(44)} fw={900} c="var(--pub-ink)">
                    {plan.price}
                  </Text>
                  <Text c="dimmed">/mese</Text>
                </Group>
                <Text c="dimmed" size="sm" mb="lg">
                  {plan.students}
                </Text>
                <Button
                  component={Link}
                  href={plan.href(locale)}
                  fullWidth
                  radius="xl"
                  variant={plan.popular ? 'gradient' : 'light'}
                  gradient={plan.popular ? PUB_GRADIENT : undefined}
                  color="indigo"
                  fw={600}
                  mb="lg"
                >
                  {plan.cta}
                </Button>
                <Stack gap={10}>
                  {plan.items.map((item) => (
                    <Group key={item} gap="xs" wrap="nowrap">
                      <ThemeIcon size={20} radius="xl" color="teal" variant="light">
                        <IconCheck size={12} />
                      </ThemeIcon>
                      <Text size="sm" c="gray.7">
                        {item}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Card>
            ))}
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
                <Title order={3} c="white" fz={rem(28)} fw={800} mb="xs">
                  La tua scuola, i tuoi server, il tuo controllo totale
                </Title>
                <Text c="gray.4" mb="lg">
                  Setup, installazione e formazione inclusi. Codice sorgente, dati tuoi, nessun
                  limite.
                </Text>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing={8}>
                  {[
                    'Server proprietari',
                    'Personalizzazione',
                    'Codice sorgente',
                    'Dati tuoi',
                    'Nessun limite',
                    'Priorità supporto',
                    'Formazione inclusa',
                    'Integrazioni custom',
                  ].map((item) => (
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
        </Container>
      </Box>

      {/* CTA finale */}
      <CtaBanner
        locale={locale}
        title="Pronto a iniziare?"
        subtitle="Unisciti a centinaia di scuole che hanno già digitalizzato la loro gestione."
      />
    </Box>
  );
}
