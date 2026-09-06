import { Metadata } from 'next';
import {
  Badge,
  Box,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Text,
  ThemeIcon,
  Title,
  rem,
} from '@mantine/core';
import {
  IconArrowRight,
  IconBuilding,
  IconHeadset,
  IconMapPin,
} from '@tabler/icons-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ElementType } from 'react';
import { regioni, province } from '@/data/italia';
import { buildPublicMetadata } from '@/lib/seo';
import { CtaBanner, PUB_GRADIENT, SectionHeader } from '@/components/public/PublicUI';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'public.cities.index' });

  return buildPublicMetadata({
    locale,
    path: '/citta',
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

// Icone dei punti di forza nell'hero (testi in public.cities.index.stats)
const HERO_STAT_ICONS: ElementType[] = [IconBuilding, IconMapPin, IconHeadset];

export default async function CittaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'public.cities.index' });

  const heroStats = t.raw('stats') as string[];
  const whyItems = t.raw('why') as { title: string; text: string }[];

  // Conteggio province per regione
  const provinceCount = regioni.map((regione) => ({
    ...regione,
    provinceCount: province.filter((p) => p.regione === regione.codice).length,
  }));

  // JSON-LD for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t('metaTitle'),
    description: t('metaDescription'),
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
          name: t('breadcrumbHome'),
          item: `https://insegnami.pro/${locale}`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: t('breadcrumbCities'),
          item: `https://insegnami.pro/${locale}/citta`,
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
          <Group gap="lg" wrap="nowrap" align="flex-start">
            <ThemeIcon size={64} radius="lg" variant="gradient" gradient={PUB_GRADIENT}>
              <IconMapPin size={34} />
            </ThemeIcon>
            <Box>
              <Badge size="lg" variant="light" color="indigo" radius="xl" mb="sm">
                {t('badge')}
              </Badge>
              <Title fz={{ base: rem(32), sm: rem(40) }} fw={900} lh={1.12} c="var(--pub-ink)" mb={8}>
                {t('title')}
              </Title>
              <Text size="lg" c="dimmed" maw={640}>
                {t('subtitle')}
              </Text>
              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" mt="xl" maw={640}>
                {heroStats.map((label, index) => {
                  const StatIcon = HERO_STAT_ICONS[index];
                  return (
                    <Group key={label} gap="sm" wrap="nowrap">
                      <ThemeIcon size={36} radius="md" variant="light" color="indigo">
                        <StatIcon size={20} />
                      </ThemeIcon>
                      <Text size="sm" fw={600} c="var(--pub-ink)">
                        {label}
                      </Text>
                    </Group>
                  );
                })}
              </SimpleGrid>
            </Box>
          </Group>
        </Container>
      </Box>

      {/* Griglia regioni */}
      <Box bg="white" py={{ base: 64, sm: 96 }}>
        <Container size="xl">
          <SectionHeader
            title={t('regionsTitle')}
            highlight={t('regionsHighlight')}
            subtitle={t('regionsSubtitle')}
          />

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="lg">
            {provinceCount.map((regione) => (
              <Card
                key={regione.codice}
                component={Link}
                href={`/${locale}/citta/${regione.slug}`}
                padding="xl"
                radius="lg"
                className="pub-card"
                h="100%"
                style={{ textDecoration: 'none' }}
              >
                <Stack gap="sm" h="100%">
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Title order={3} fz={rem(20)} fw={700} c="var(--pub-ink)">
                      {regione.nome}
                    </Title>
                    {regione.provinceCount > 0 && (
                      <Badge color="indigo" variant="light" radius="xl" style={{ flexShrink: 0 }}>
                        {t('provinceCount', { count: regione.provinceCount })}
                      </Badge>
                    )}
                  </Group>
                  <Text size="sm" c="dimmed">
                    {t('regionCardText', { region: regione.nome })}
                  </Text>
                  <Group justify="flex-end" mt="auto">
                    <IconArrowRight size={18} color="var(--mantine-color-indigo-6)" />
                  </Group>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* Contenuto SEO */}
      <Box bg="var(--pub-surface)" py={{ base: 64, sm: 96 }}>
        <Container size="xl">
          <SectionHeader
            title={t('whyTitle')}
            highlight={t('whyHighlight')}
          />
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            {whyItems.map((item) => (
              <Card key={item.title} padding="xl" radius="lg" withBorder bg="white">
                <Title order={4} fz={rem(20)} fw={700} c="var(--pub-ink)" mb="xs">
                  {item.title}
                </Title>
                <Text c="dimmed" lh={1.6}>
                  {item.text}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* CTA finale */}
      <CtaBanner locale={locale} title={t('ctaTitle')} subtitle={t('ctaSubtitle')} />
    </>
  );
}
