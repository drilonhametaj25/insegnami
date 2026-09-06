import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  Anchor,
  Badge,
  Box,
  Breadcrumbs,
  Button,
  Card,
  Container,
  Grid,
  GridCol,
  Group,
  List,
  ListItem,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  rem,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconArrowRight,
  IconCalendar,
  IconCheck,
  IconCreditCard,
  IconMapPin,
  IconMessage,
  IconSchool,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ElementType } from 'react';
import { comuni, getComuneWithContext } from '@/data/italia';
import { buildPublicMetadata } from '@/lib/seo';
import { faqPageJsonLd } from '@/lib/structured-data';
import { CtaBanner, PUB_GRADIENT } from '@/components/public/PublicUI';

export async function generateStaticParams() {
  const locales = ['it', 'en', 'fr', 'pt'];
  const params: { locale: string; regione: string; provincia: string; comune: string }[] = [];

  for (const locale of locales) {
    for (const comune of comuni) {
      const context = getComuneWithContext(comune.slug);
      if (context) {
        params.push({
          locale,
          regione: context.regione.slug,
          provincia: context.provincia.slug,
          comune: comune.slug,
        });
      }
    }
  }

  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; regione: string; provincia: string; comune: string }>;
}): Promise<Metadata> {
  const { locale, comune: comuneSlug } = await params;
  const context = getComuneWithContext(comuneSlug);
  const t = await getTranslations({ locale, namespace: 'public.cities.city' });

  if (!context) {
    return { title: t('notFound') };
  }

  const { comune, provincia, regione } = context;

  return {
    ...buildPublicMetadata({
      locale,
      path: `/citta/${regione.slug}/${provincia.slug}/${comune.slug}`,
      title: t('metaTitle', { city: comune.nome }),
      description: t('metaDescription', { city: comune.nome, province: provincia.nome }),
    }),
    keywords: [
      `software gestione scuola ${comune.nome}`,
      `gestionale scolastico ${comune.nome}`,
      `scuola privata ${comune.nome}`,
      `registro elettronico ${comune.nome}`,
      `software scuola ${provincia.sigla}`,
    ],
  };
}

// Icone delle feature (testi in public.cities.city.features.*)
const FEATURE_ICONS: { key: string; icon: ElementType }[] = [
  { key: 'students', icon: IconSchool },
  { key: 'teachers', icon: IconUsers },
  { key: 'billing', icon: IconCreditCard },
  { key: 'calendar', icon: IconCalendar },
  { key: 'communications', icon: IconMessage },
];

export default async function ComunePage({
  params,
}: {
  params: Promise<{ locale: string; regione: string; provincia: string; comune: string }>;
}) {
  const { locale, comune: comuneSlug } = await params;
  const context = getComuneWithContext(comuneSlug);

  if (!context) {
    notFound();
  }

  const { comune, provincia, regione } = context;
  const t = await getTranslations({ locale, namespace: 'public.cities.city' });
  const tIndex = await getTranslations({ locale, namespace: 'public.cities.index' });

  // Comuni vicini (stessa provincia, comune diverso)
  const nearbyCities = comuni
    .filter((c) => c.provincia === provincia.codice && c.slug !== comune.slug)
    .slice(0, 6);

  // JSON-LD LocalBusiness schema for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'InsegnaMi.pro',
    description: t('metaTitle', { city: comune.nome }),
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      description: t('sidebar.trialTitle'),
    },
    areaServed: {
      '@type': 'City',
      name: comune.nome,
      containedInPlace: {
        '@type': 'AdministrativeArea',
        name: provincia.nome,
        containedInPlace: {
          '@type': 'AdministrativeArea',
          name: regione.nome,
          containedInPlace: {
            '@type': 'Country',
            name: 'Italia',
          },
        },
      },
    },
    provider: {
      '@type': 'Organization',
      name: 'InsegnaMi.pro',
      url: 'https://insegnami.pro',
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: tIndex('breadcrumbHome'),
          item: `https://insegnami.pro/${locale}`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: tIndex('breadcrumbCities'),
          item: `https://insegnami.pro/${locale}/citta`,
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: regione.nome,
          item: `https://insegnami.pro/${locale}/citta/${regione.slug}`,
        },
        {
          '@type': 'ListItem',
          position: 4,
          name: provincia.nome,
          item: `https://insegnami.pro/${locale}/citta/${regione.slug}/${provincia.slug}`,
        },
        {
          '@type': 'ListItem',
          position: 5,
          name: comune.nome,
          item: `https://insegnami.pro/${locale}/citta/${regione.slug}/${provincia.slug}/${comune.slug}`,
        },
      ],
    },
  };

  const features = FEATURE_ICONS.map(({ key, icon }) => ({
    icon,
    title: t(`features.${key}.title`),
    description: t(`features.${key}.text`, { city: comune.nome }),
  }));

  // Motivi della checklist "Perché scegliere InsegnaMi.pro"
  const reasons = t.raw('reasons') as { title: string; desc: string }[];

  // Bullet legati ai dati demografici del comune presenti nel dataset
  const gestionaleBullets = [
    comune.popolazione
      ? t('bulletPopulation', { population: comune.popolazione.toLocaleString('it-IT') })
      : t('bulletNoPopulation', { city: comune.nome }),
    t('bulletFamilies', {
      city: comune.nome,
      province: provincia.nome,
      sigla: provincia.sigla,
    }),
    t('bulletCloud', { city: comune.nome, cap: comune.cap }),
  ];

  // Strumenti gratuiti utili per chi gestisce una scuola
  const freeTools = [
    { label: t('toolGradeCalculator'), href: `/${locale}/tools/calcolatore-media-voti` },
    { label: t('toolAttendanceCalculator'), href: `/${locale}/tools/calcolatore-presenze` },
    { label: t('toolScheduleGenerator'), href: `/${locale}/tools/generatore-orario-settimanale` },
  ];

  // Mini-FAQ locale (anche in JSON-LD FAQPage)
  const localFaqs = [
    {
      question: t('faq1Question', { city: comune.nome }),
      answer: t('faq1Answer', { city: comune.nome }),
    },
    {
      question: t('faq2Question', { city: comune.nome }),
      answer: t('faq2Answer'),
    },
    {
      question: t('faq3Question', { city: comune.nome }),
      answer: t('faq3Answer'),
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd(localFaqs)) }}
      />

      {/* Hero */}
      <Box className="pub-hero" py={{ base: 40, sm: 56 }}>
        <Container size="xl">
          <Stack gap="lg">
            <Breadcrumbs>
              <Anchor component={Link} href={`/${locale}`} size="sm" c="indigo.6" underline="hover">
                {tIndex('breadcrumbHome')}
              </Anchor>
              <Anchor
                component={Link}
                href={`/${locale}/citta`}
                size="sm"
                c="indigo.6"
                underline="hover"
              >
                {tIndex('breadcrumbCities')}
              </Anchor>
              <Anchor
                component={Link}
                href={`/${locale}/citta/${regione.slug}`}
                size="sm"
                c="indigo.6"
                underline="hover"
              >
                {regione.nome}
              </Anchor>
              <Anchor
                component={Link}
                href={`/${locale}/citta/${regione.slug}/${provincia.slug}`}
                size="sm"
                c="indigo.6"
                underline="hover"
              >
                {provincia.nome}
              </Anchor>
              <Text size="sm" c="dimmed">
                {comune.nome}
              </Text>
            </Breadcrumbs>

            <Group gap="lg" wrap="nowrap" align="flex-start">
              <ThemeIcon size={64} radius="lg" variant="gradient" gradient={PUB_GRADIENT}>
                <IconMapPin size={34} />
              </ThemeIcon>
              <Box>
                <Badge size="lg" variant="light" color="indigo" radius="xl" mb="sm">
                  {t('badge')}
                </Badge>
                <Title fz={{ base: rem(28), sm: rem(34) }} fw={900} lh={1.15} c="var(--pub-ink)" mb={8}>
                  {t('title', { city: comune.nome })}
                </Title>
                <Text size="lg" c="dimmed">
                  {t('subtitle')}
                </Text>
                <Group gap="sm" mt="md">
                  <Badge variant="light" color="indigo" size="lg" radius="xl">
                    {provincia.sigla}
                  </Badge>
                  {comune.popolazione && (
                    <Badge
                      variant="light"
                      color="indigo"
                      size="lg"
                      radius="xl"
                      leftSection={<IconUsers size={14} />}
                    >
                      {t('populationBadge', {
                        population: comune.popolazione.toLocaleString('it-IT'),
                      })}
                    </Badge>
                  )}
                  <Badge variant="light" color="indigo" size="lg" radius="xl">
                    {t('capBadge', { cap: comune.cap })}
                  </Badge>
                </Group>
              </Box>
            </Group>
          </Stack>
        </Container>
      </Box>

      {/* Contenuto principale + sidebar */}
      <Box bg="white" py={{ base: 32, sm: 48 }}>
        <Container size="xl">
          <Stack gap="xl">
            {/* Link di ritorno */}
            <Anchor
              component={Link}
              href={`/${locale}/citta/${regione.slug}/${provincia.slug}`}
              size="sm"
              c="indigo.6"
              fw={500}
              underline="hover"
              display="inline-block"
            >
              <Group gap={6} wrap="nowrap">
                <IconArrowLeft size={16} />
                {t('backLink', { province: provincia.nome })}
              </Group>
            </Anchor>

            <Grid gutter={{ base: 'lg', md: 'xl' }}>
              {/* Colonna principale */}
              <GridCol span={{ base: 12, md: 8 }}>
                <Stack gap="xl">
                  {/* Introduzione */}
                  <Box>
                    <Title
                      order={2}
                      fz={{ base: rem(26), sm: rem(30) }}
                      fw={800}
                      c="var(--pub-ink)"
                      mb="md"
                    >
                      {t('introTitle', { city: comune.nome })}
                    </Title>
                    <Text size="lg" mb="md">
                      {t('introText1', { city: comune.nome })}
                    </Text>
                    <Text c="dimmed">
                      {t('introText2', {
                        city: comune.nome,
                        province: provincia.nome,
                        sigla: provincia.sigla,
                      })}
                    </Text>
                  </Box>

                  {/* Perché un gestionale: bullet legati ai dati del comune */}
                  <Card withBorder radius="lg" padding="xl">
                    <Title order={2} fz={rem(22)} fw={700} c="var(--pub-ink)" mb="md">
                      {t('whyTitle', { city: comune.nome })}
                    </Title>
                    <List
                      spacing="md"
                      icon={
                        <ThemeIcon size={24} radius="xl" color="indigo" variant="light">
                          <IconCheck size={14} />
                        </ThemeIcon>
                      }
                    >
                      {gestionaleBullets.map((bullet) => (
                        <ListItem key={bullet}>
                          <Text size="sm" c="dimmed" lh={1.6}>
                            {bullet}
                          </Text>
                        </ListItem>
                      ))}
                    </List>
                    <Text size="sm" fw={600} c="var(--pub-ink)" mt="lg" mb="xs">
                      {t('toolsPrompt')}
                    </Text>
                    <Group gap="sm">
                      {freeTools.map((tool) => (
                        <Anchor
                          key={tool.href}
                          component={Link}
                          href={tool.href}
                          size="sm"
                          c="indigo.6"
                          fw={600}
                          underline="hover"
                        >
                          {tool.label}
                        </Anchor>
                      ))}
                    </Group>
                  </Card>

                  {/* Funzionalità */}
                  <Box>
                    <Title
                      order={2}
                      fz={{ base: rem(26), sm: rem(30) }}
                      fw={800}
                      c="var(--pub-ink)"
                      mb="lg"
                    >
                      {t('featuresTitle', { city: comune.nome })}
                    </Title>
                    <Stack gap="md">
                      {features.map((feature) => {
                        const FeatureIcon = feature.icon;
                        return (
                          <Card key={feature.title} withBorder radius="lg" padding="lg">
                            <Group gap="md" align="flex-start" wrap="nowrap">
                              <ThemeIcon size={44} radius="md" variant="light" color="indigo">
                                <FeatureIcon size={24} />
                              </ThemeIcon>
                              <Box style={{ flex: 1 }}>
                                <Title order={4} fz={rem(18)} fw={700} c="var(--pub-ink)" mb={4}>
                                  {feature.title}
                                </Title>
                                <Text size="sm" c="dimmed" lh={1.6}>
                                  {feature.description}
                                </Text>
                              </Box>
                            </Group>
                          </Card>
                        );
                      })}
                    </Stack>
                  </Box>

                  {/* Perché sceglierci */}
                  <Card withBorder radius="lg" padding="xl">
                    <Title order={2} fz={rem(22)} fw={700} c="var(--pub-ink)" mb="lg">
                      {t('reasonsTitle')}
                    </Title>
                    <List
                      spacing="md"
                      icon={
                        <ThemeIcon size={24} radius="xl" color="teal" variant="light">
                          <IconCheck size={14} />
                        </ThemeIcon>
                      }
                    >
                      {reasons.map((item) => (
                        <ListItem key={item.title}>
                          <Text size="sm" fw={600} c="var(--pub-ink)">
                            {item.title}
                          </Text>
                          <Text size="sm" c="dimmed">
                            {item.desc}
                          </Text>
                        </ListItem>
                      ))}
                    </List>
                  </Card>

                  {/* Mini-FAQ locale */}
                  <Box>
                    <Title
                      order={2}
                      fz={{ base: rem(26), sm: rem(30) }}
                      fw={800}
                      c="var(--pub-ink)"
                      mb="lg"
                    >
                      {t('faqTitle', { city: comune.nome })}
                    </Title>
                    <Stack gap="md">
                      {localFaqs.map((faq) => (
                        <Card key={faq.question} withBorder radius="lg" padding="lg">
                          <Title order={3} fz={rem(17)} fw={700} c="var(--pub-ink)" mb={6}>
                            {faq.question}
                          </Title>
                          <Text size="sm" c="dimmed" lh={1.6}>
                            {faq.answer}
                          </Text>
                        </Card>
                      ))}
                    </Stack>
                  </Box>
                </Stack>
              </GridCol>

              {/* Sidebar */}
              <GridCol span={{ base: 12, md: 4 }}>
                <Stack gap="lg" style={{ position: 'sticky', top: 88 }}>
                  {/* Card CTA */}
                  <Card padding="xl" radius="lg" style={{ background: 'var(--pub-brand-gradient)' }}>
                    <Stack gap="md">
                      <Title order={3} fz={rem(20)} fw={700} c="white" ta="center">
                        {t('sidebar.trialTitle')}
                      </Title>
                      <Text ta="center" size="sm" c="white" opacity={0.9}>
                        {t('sidebar.trialText', { city: comune.nome })}
                      </Text>
                      <Button
                        component={Link}
                        href={`/${locale}/auth/register`}
                        variant="white"
                        c="indigo.7"
                        radius="xl"
                        fw={700}
                        fullWidth
                        rightSection={<IconArrowRight size={16} />}
                      >
                        {t('sidebar.trialCta')}
                      </Button>
                      <Text ta="center" size="xs" c="white" opacity={0.85}>
                        {t('sidebar.noCard')}
                      </Text>
                    </Stack>
                  </Card>

                  {/* Card informazioni */}
                  <Card withBorder radius="lg" padding="xl">
                    <Stack gap="sm">
                      <Title order={4} fz={rem(16)} fw={700} c="var(--pub-ink)">
                        {t('sidebar.infoTitle', { city: comune.nome })}
                      </Title>
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">{t('sidebar.provinceLabel')}</Text>
                        <Text size="sm" fw={500}>{provincia.nome} ({provincia.sigla})</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">{t('sidebar.regionLabel')}</Text>
                        <Text size="sm" fw={500}>{regione.nome}</Text>
                      </Group>
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">{t('sidebar.capLabel')}</Text>
                        <Text size="sm" fw={500}>{comune.cap}</Text>
                      </Group>
                      {comune.popolazione && (
                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">{t('sidebar.populationLabel')}</Text>
                          <Text size="sm" fw={500}>
                            {comune.popolazione.toLocaleString('it-IT')}
                          </Text>
                        </Group>
                      )}
                    </Stack>
                  </Card>

                  {/* Card contatti */}
                  <Card withBorder radius="lg" padding="xl">
                    <Stack gap="sm">
                      <Title order={4} fz={rem(16)} fw={700} c="var(--pub-ink)">
                        {t('sidebar.questionsTitle')}
                      </Title>
                      <Text size="sm" c="dimmed">
                        {t('sidebar.questionsText', { city: comune.nome })}
                      </Text>
                      <Button
                        component={Link}
                        href={`/${locale}/contact`}
                        variant="light"
                        color="indigo"
                        radius="xl"
                        fullWidth
                      >
                        {t('sidebar.contactCta')}
                      </Button>
                    </Stack>
                  </Card>
                </Stack>
              </GridCol>
            </Grid>
          </Stack>
        </Container>
      </Box>

      {/* Comuni vicini */}
      {nearbyCities.length > 0 && (
        <Box bg="var(--pub-surface)" py={{ base: 32, sm: 48 }}>
          <Container size="xl">
            <Title
              order={2}
              fz={{ base: rem(26), sm: rem(30) }}
              fw={800}
              c="var(--pub-ink)"
              mb="lg"
            >
              {t('nearbyTitle', { province: provincia.nome })}
            </Title>
            <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
              {nearbyCities.map((city) => (
                <Card
                  key={city.codice}
                  component={Link}
                  href={`/${locale}/citta/${regione.slug}/${provincia.slug}/${city.slug}`}
                  className="pub-card"
                  padding="md"
                  radius="lg"
                  bg="white"
                  style={{ textDecoration: 'none' }}
                >
                  <Text size="sm" fw={600} c="var(--pub-ink)" ta="center">
                    {city.nome}
                  </Text>
                </Card>
              ))}
            </SimpleGrid>
          </Container>
        </Box>
      )}

      {/* CTA finale */}
      <CtaBanner
        locale={locale}
        title={t('ctaTitle', { city: comune.nome })}
        subtitle={t('ctaSubtitle', { city: comune.nome, province: provincia.nome })}
      />
    </>
  );
}
