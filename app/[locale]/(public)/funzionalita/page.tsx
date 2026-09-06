import type { Metadata } from 'next';
import {
  Box,
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
import { IconArrowRight } from '@tabler/icons-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { buildPublicMetadata, SITE_URL } from '@/lib/seo';
import { breadcrumbJsonLd } from '@/lib/structured-data';
import { CtaBanner, PageHero, PUB_GRADIENT } from '@/components/public/PublicUI';
import { buildFeaturePages } from './_content';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'public.features.index' });
  return buildPublicMetadata({
    locale,
    path: '/funzionalita',
    title: t('metaTitle'),
    description: t('metaDescription'),
  });
}

export default async function FunzionalitaIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'public.features.index' });
  const tFeatures = await getTranslations({ locale, namespace: 'public.features' });
  const featurePages = buildFeaturePages(tFeatures);

  const jsonLd = breadcrumbJsonLd([
    { name: 'Home', url: `${SITE_URL}/${locale}` },
    { name: t('badge'), url: `${SITE_URL}/${locale}/funzionalita` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHero
        badge={t('badge')}
        title={t('h1')}
        highlight={t('h1Highlight')}
        subtitle={t('sub')}
      >
        <Button
          component={Link}
          href={`/${locale}/auth/register`}
          size="lg"
          radius="xl"
          variant="gradient"
          gradient={PUB_GRADIENT}
          fw={700}
          rightSection={<IconArrowRight size={18} />}
          data-testid="funzionalita-cta-trial"
        >
          {t('ctaTrial')}
        </Button>
      </PageHero>

      <Box bg="white" py={{ base: 64, sm: 96 }}>
        <Container size="xl">
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {featurePages.map((feature) => {
              const FirstIcon = feature.capabilities[0].icon;
              return (
                <Card
                  key={feature.slug}
                  component={Link}
                  href={`/${locale}/funzionalita/${feature.slug}`}
                  padding="xl"
                  radius="lg"
                  className="pub-card"
                  h="100%"
                  style={{ textDecoration: 'none' }}
                >
                  <Stack gap="md" h="100%">
                    <ThemeIcon size={48} radius="md" variant="gradient" gradient={PUB_GRADIENT}>
                      <FirstIcon size={26} />
                    </ThemeIcon>
                    <Title order={2} fz={rem(20)} fw={700} c="var(--pub-ink)">
                      {feature.navLabel}
                    </Title>
                    <Text size="sm" c="dimmed" lh={1.6}>
                      {feature.cardText}
                    </Text>
                    <Group justify="flex-end" mt="auto">
                      <Group gap={6}>
                        <Text size="sm" fw={600} c="indigo.6">
                          {t('discoverMore')}
                        </Text>
                        <IconArrowRight size={16} color="var(--mantine-color-indigo-6)" />
                      </Group>
                    </Group>
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        </Container>
      </Box>

      <CtaBanner locale={locale} />
    </>
  );
}
