import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  Anchor,
  Badge,
  Box,
  Breadcrumbs,
  Card,
  Container,
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
  IconBuilding,
  IconCheck,
  IconMapPin,
} from '@tabler/icons-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  regioni,
  getRegione,
  getProvinceByRegione,
  comuni,
} from '@/data/italia';
import { buildPublicMetadata } from '@/lib/seo';
import { CtaBanner, PUB_GRADIENT } from '@/components/public/PublicUI';

export async function generateStaticParams() {
  const locales = ['it', 'en', 'fr', 'pt'];
  const params: { locale: string; regione: string }[] = [];

  for (const locale of locales) {
    for (const regione of regioni) {
      params.push({ locale, regione: regione.slug });
    }
  }

  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; regione: string }>;
}): Promise<Metadata> {
  const { locale, regione: regioneSlug } = await params;
  const regione = getRegione(regioneSlug);
  const t = await getTranslations({ locale, namespace: 'public.cities.region' });

  if (!regione) {
    return { title: t('notFound') };
  }

  // Regioni senza province popolate nel dataset: pagina sottile → noindex
  const hasProvince = getProvinceByRegione(regioneSlug).length > 0;

  return buildPublicMetadata({
    locale,
    path: `/citta/${regioneSlug}`,
    title: t('metaTitle', { region: regione.nome }),
    description: t('metaDescription', { region: regione.nome }),
    noindex: !hasProvince,
  });
}

export default async function RegionePage({
  params,
}: {
  params: Promise<{ locale: string; regione: string }>;
}) {
  const { locale, regione: regioneSlug } = await params;
  const regione = getRegione(regioneSlug);

  if (!regione) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'public.cities.region' });
  const tIndex = await getTranslations({ locale, namespace: 'public.cities.index' });
  const province = getProvinceByRegione(regioneSlug);

  // Conteggio comuni per provincia
  const provinceWithCounts = province.map((prov) => ({
    ...prov,
    comuniCount: comuni.filter((c) => c.provincia === prov.codice).length,
  }));

  const featuresList = t.raw('featuresList') as string[];
  const advantagesList = t.raw('advantagesList') as string[];

  // JSON-LD for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t('metaTitle', { region: regione.nome }),
    description: t('metaDescription', { region: regione.nome }),
    publisher: {
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
          item: `https://insegnami.pro/${locale}/citta/${regioneSlug}`,
        },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
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
              <Text size="sm" c="dimmed">
                {regione.nome}
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
                  {t('title', { region: regione.nome })}
                </Title>
                <Text size="lg" c="dimmed">
                  {province.length > 0
                    ? t('subtitleProvinces', { count: province.length })
                    : t('subtitleNoProvinces', { region: regione.nome })}
                </Text>
              </Box>
            </Group>
          </Stack>
        </Container>
      </Box>

      {/* Elenco province */}
      <Box bg="white" py={{ base: 32, sm: 48 }}>
        <Container size="xl">
          <Stack gap="xl">
            {/* Link di ritorno */}
            <Anchor
              component={Link}
              href={`/${locale}/citta`}
              size="sm"
              c="indigo.6"
              fw={500}
              underline="hover"
              display="inline-block"
            >
              <Group gap={6} wrap="nowrap">
                <IconArrowLeft size={16} />
                {t('backLink')}
              </Group>
            </Anchor>

            {/* Introduzione */}
            <Box>
              <Title order={2} fz={{ base: rem(26), sm: rem(30) }} fw={800} c="var(--pub-ink)" mb="md">
                {provinceWithCounts.length > 0
                  ? t('provincesTitle', { region: regione.nome })
                  : t('noProvincesTitle', { region: regione.nome })}
              </Title>
              <Text size="lg" c="dimmed" maw={800}>
                {provinceWithCounts.length > 0
                  ? t('provincesIntro', { region: regione.nome })
                  : t('noProvincesIntro', { region: regione.nome })}
              </Text>
            </Box>

            {/* Griglia province */}
            {provinceWithCounts.length > 0 ? (
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg">
                {provinceWithCounts.map((prov) => (
                  <Card
                    key={prov.codice}
                    component={Link}
                    href={`/${locale}/citta/${regioneSlug}/${prov.slug}`}
                    padding="xl"
                    radius="lg"
                    className="pub-card"
                    h="100%"
                    style={{ textDecoration: 'none' }}
                  >
                    <Stack gap="sm" h="100%">
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Group gap="sm" wrap="nowrap">
                          <ThemeIcon size={36} radius="md" variant="light" color="indigo">
                            <IconBuilding size={20} />
                          </ThemeIcon>
                          <Title order={3} fz={rem(20)} fw={700} c="var(--pub-ink)">
                            {prov.nome}
                          </Title>
                        </Group>
                        <Badge color="gray" variant="light" radius="xl" style={{ flexShrink: 0 }}>
                          {prov.sigla}
                        </Badge>
                      </Group>
                      <Text size="sm" c="dimmed">
                        {t('provinceCardText', { province: prov.nome })}
                      </Text>
                      <Group justify="space-between" mt="auto">
                        {prov.comuniCount > 0 ? (
                          <Badge color="indigo" variant="light" size="sm" radius="xl">
                            {t('comuniCount', { count: prov.comuniCount })}
                          </Badge>
                        ) : (
                          <span />
                        )}
                        <IconArrowRight size={18} color="var(--mantine-color-indigo-6)" />
                      </Group>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
            ) : (
              <Card withBorder padding="xl" radius="lg">
                <Stack gap="sm">
                  <Title order={3} fz={rem(20)} fw={700} c="var(--pub-ink)">
                    {t('everywhereTitle', { region: regione.nome })}
                  </Title>
                  <Text c="dimmed">
                    {t('everywhereText')}
                  </Text>
                  <Anchor
                    component={Link}
                    href={`/${locale}/contact`}
                    size="sm"
                    c="indigo.6"
                    fw={600}
                    underline="hover"
                  >
                    {t('contactCta')}
                  </Anchor>
                </Stack>
              </Card>
            )}
          </Stack>
        </Container>
      </Box>

      {/* Contenuto SEO */}
      <Box bg="var(--pub-surface)" py={{ base: 64, sm: 96 }}>
        <Container size="xl">
          <Card padding="xl" radius="lg" withBorder bg="white">
            <Title order={2} fz={{ base: rem(26), sm: rem(30) }} fw={800} c="var(--pub-ink)" mb="md">
              {t('seoTitle', { region: regione.nome })}
            </Title>
            <Text mb="md" c="dimmed">
              {t('seoText', { region: regione.nome })}
            </Text>
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" mt="lg">
              <Stack gap="sm">
                <Title order={4} fz={rem(18)} fw={700} c="var(--pub-ink)">
                  {t('featuresTitle')}
                </Title>
                <List
                  spacing={8}
                  size="sm"
                  c="dimmed"
                  icon={
                    <ThemeIcon size={20} radius="xl" color="teal" variant="light">
                      <IconCheck size={12} />
                    </ThemeIcon>
                  }
                >
                  {featuresList.map((item) => (
                    <ListItem key={item}>{item}</ListItem>
                  ))}
                </List>
              </Stack>
              <Stack gap="sm">
                <Title order={4} fz={rem(18)} fw={700} c="var(--pub-ink)">
                  {t('advantagesTitle', { region: regione.nome })}
                </Title>
                <List
                  spacing={8}
                  size="sm"
                  c="dimmed"
                  icon={
                    <ThemeIcon size={20} radius="xl" color="teal" variant="light">
                      <IconCheck size={12} />
                    </ThemeIcon>
                  }
                >
                  {advantagesList.map((item) => (
                    <ListItem key={item}>{item}</ListItem>
                  ))}
                </List>
              </Stack>
            </SimpleGrid>
          </Card>
        </Container>
      </Box>

      {/* CTA finale */}
      <CtaBanner
        locale={locale}
        title={t('ctaTitle')}
        subtitle={t('ctaSubtitle', { region: regione.nome })}
      />
    </>
  );
}
