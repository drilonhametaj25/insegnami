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
  Group,
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
  IconMapPin,
  IconUsers,
} from '@tabler/icons-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  regioni,
  province,
  getRegione,
  getProvincia,
  getComuniByProvincia,
} from '@/data/italia';
import { buildPublicMetadata } from '@/lib/seo';
import { CtaBanner, PUB_GRADIENT, SectionHeader } from '@/components/public/PublicUI';

export async function generateStaticParams() {
  const locales = ['it', 'en', 'fr', 'pt'];
  const params: { locale: string; regione: string; provincia: string }[] = [];

  for (const locale of locales) {
    for (const prov of province) {
      const regione = regioni.find((r) => r.codice === prov.regione);
      if (regione) {
        params.push({
          locale,
          regione: regione.slug,
          provincia: prov.slug,
        });
      }
    }
  }

  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; regione: string; provincia: string }>;
}): Promise<Metadata> {
  const { locale, regione: regioneSlug, provincia: provinciaSlug } = await params;
  const regione = getRegione(regioneSlug);
  const provincia = getProvincia(provinciaSlug);
  const t = await getTranslations({ locale, namespace: 'public.cities.province' });

  if (!regione || !provincia) {
    return { title: t('notFound') };
  }

  // Province senza comuni popolati nel dataset: pagina sottile → noindex
  const hasComuni = getComuniByProvincia(provinciaSlug).length > 0;

  return buildPublicMetadata({
    locale,
    path: `/citta/${regioneSlug}/${provinciaSlug}`,
    title: t('metaTitle', { province: provincia.nome, sigla: provincia.sigla }),
    description: t('metaDescription', {
      province: provincia.nome,
      region: regione.nome,
    }),
    noindex: !hasComuni,
  });
}

export default async function ProvinciaPage({
  params,
}: {
  params: Promise<{ locale: string; regione: string; provincia: string }>;
}) {
  const { locale, regione: regioneSlug, provincia: provinciaSlug } = await params;
  const regione = getRegione(regioneSlug);
  const provincia = getProvincia(provinciaSlug);

  if (!regione || !provincia) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'public.cities.province' });
  const tIndex = await getTranslations({ locale, namespace: 'public.cities.index' });
  const comuni = getComuniByProvincia(provinciaSlug);
  const cards = t.raw('cards') as { title: string; text: string }[];

  // JSON-LD for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t('metaTitle', { province: provincia.nome, sigla: provincia.sigla }),
    description: t('metaDescription', { province: provincia.nome, region: regione.nome }),
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
        {
          '@type': 'ListItem',
          position: 4,
          name: provincia.nome,
          item: `https://insegnami.pro/${locale}/citta/${regioneSlug}/${provinciaSlug}`,
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
              <Anchor
                component={Link}
                href={`/${locale}/citta/${regioneSlug}`}
                size="sm"
                c="indigo.6"
                underline="hover"
              >
                {regione.nome}
              </Anchor>
              <Text size="sm" c="dimmed">
                {provincia.nome}
              </Text>
            </Breadcrumbs>

            <Group gap="lg" wrap="nowrap" align="flex-start">
              <ThemeIcon size={64} radius="lg" variant="gradient" gradient={PUB_GRADIENT}>
                <IconMapPin size={34} />
              </ThemeIcon>
              <Box>
                <Badge size="lg" variant="light" color="indigo" radius="xl" mb="sm">
                  {t('badge', { sigla: provincia.sigla })}
                </Badge>
                <Title fz={{ base: rem(28), sm: rem(34) }} fw={900} lh={1.15} c="var(--pub-ink)" mb={8}>
                  {t('title', { province: provincia.nome })}
                </Title>
                <Text size="lg" c="dimmed">
                  {t('subtitle', { province: provincia.nome, region: regione.nome })}
                </Text>
              </Box>
            </Group>
          </Stack>
        </Container>
      </Box>

      {/* Elenco comuni */}
      <Box bg="white" py={{ base: 32, sm: 48 }}>
        <Container size="xl">
          <Stack gap="xl">
            {/* Link di ritorno */}
            <Anchor
              component={Link}
              href={`/${locale}/citta/${regioneSlug}`}
              size="sm"
              c="indigo.6"
              fw={500}
              underline="hover"
              display="inline-block"
            >
              <Group gap={6} wrap="nowrap">
                <IconArrowLeft size={16} />
                {t('backLink', { region: regione.nome })}
              </Group>
            </Anchor>

            {/* Introduzione */}
            <Box>
              <Title order={2} fz={{ base: rem(26), sm: rem(30) }} fw={800} c="var(--pub-ink)" mb="md">
                {comuni.length > 0
                  ? t('comuniTitle', { province: provincia.nome })
                  : t('noComuniTitle', { province: provincia.nome })}
              </Title>
              <Text size="lg" c="dimmed" maw={800}>
                {comuni.length > 0
                  ? t('comuniIntro', { province: provincia.nome })
                  : t('noComuniIntro', { province: provincia.nome })}
              </Text>
            </Box>

            {/* Griglia comuni */}
            {comuni.length > 0 ? (
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="lg">
                {comuni.map((comune) => (
                  <Card
                    key={comune.codice}
                    component={Link}
                    href={`/${locale}/citta/${regioneSlug}/${provinciaSlug}/${comune.slug}`}
                    padding="lg"
                    radius="lg"
                    className="pub-card"
                    h="100%"
                    style={{ textDecoration: 'none' }}
                  >
                    <Stack gap="xs" h="100%">
                      <Group justify="space-between" align="flex-start" wrap="nowrap">
                        <Title order={4} fz={rem(18)} fw={700} c="var(--pub-ink)">
                          {comune.nome}
                        </Title>
                        <IconArrowRight
                          size={16}
                          color="var(--mantine-color-indigo-6)"
                          style={{ flexShrink: 0 }}
                        />
                      </Group>
                      <Group gap="xs" mt="auto">
                        <Badge color="gray" variant="light" size="sm" radius="xl">
                          {t('capBadge', { cap: comune.cap })}
                        </Badge>
                        {comune.popolazione && (
                          <Badge
                            color="indigo"
                            variant="light"
                            size="sm"
                            radius="xl"
                            leftSection={<IconUsers size={12} />}
                          >
                            {t('populationBadge', {
                              population: comune.popolazione.toLocaleString('it-IT'),
                            })}
                          </Badge>
                        )}
                      </Group>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>
            ) : (
              <Card withBorder padding="xl" radius="lg">
                <Stack gap="md">
                  <Title order={3} fz={rem(20)} fw={700} c="var(--pub-ink)">
                    {t('everywhereTitle', { province: provincia.nome })}
                  </Title>
                  <Text c="dimmed">
                    {t('everywhereText', { province: provincia.nome, sigla: provincia.sigla })}
                  </Text>
                  <Group>
                    <Button
                      component={Link}
                      href={`/${locale}/contact`}
                      variant="light"
                      color="indigo"
                      radius="xl"
                    >
                      {t('contactCta')}
                    </Button>
                  </Group>
                </Stack>
              </Card>
            )}
          </Stack>
        </Container>
      </Box>

      {/* Contenuto SEO */}
      <Box bg="var(--pub-surface)" py={{ base: 64, sm: 96 }}>
        <Container size="xl">
          <SectionHeader
            title={t('seoTitle')}
            highlight={provincia.nome}
            subtitle={t('seoSubtitle', { province: provincia.nome })}
          />
          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg">
            {cards.map((item) => (
              <Card key={item.title} padding="xl" radius="lg" withBorder bg="white" h="100%">
                <Title order={4} fz={rem(20)} fw={700} c="var(--pub-ink)" mb="xs">
                  {item.title}
                </Title>
                <Text size="sm" c="dimmed" lh={1.6}>
                  {item.text}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* CTA finale */}
      <CtaBanner
        locale={locale}
        title={t('ctaTitle', { province: provincia.nome })}
        subtitle={t('ctaSubtitle', { province: provincia.nome })}
      />
    </>
  );
}
