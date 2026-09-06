import { Metadata } from 'next';
import {
  Container,
  Title,
  Text,
  SimpleGrid,
  Card,
  Stack,
  Group,
  ThemeIcon,
  Box,
  rem,
} from '@mantine/core';
import {
  IconCalculator,
  IconCalendar,
  IconClipboardCheck,
  IconFileText,
  IconClock,
  IconCurrencyEuro,
  IconId,
  IconTable,
} from '@tabler/icons-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { ElementType } from 'react';
import { buildPublicMetadata } from '@/lib/seo';
import { CtaBanner, PageHero } from '@/components/public/PublicUI';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'public.tools.meta' });
  return {
    ...buildPublicMetadata({
      locale,
      path: '/tools',
      title: t('title'),
      description: t('description'),
    }),
    keywords: [
      'strumenti scuola gratuiti',
      'calcolatore media voti',
      'calcolatore presenze',
      'generatore calendario scolastico',
      'validatore codice fiscale',
    ],
  };
}

// Dati non testuali dei tool (slug, icone, categoria); i testi vivono in
// messages/*.json sotto public.tools.items.<slug>.
type ToolCategory = 'calculators' | 'generators' | 'validators';

const TOOLS: { slug: string; icon: ElementType; category: ToolCategory }[] = [
  { slug: 'calcolatore-media-voti', icon: IconCalculator, category: 'calculators' },
  { slug: 'calcolatore-presenze', icon: IconClipboardCheck, category: 'calculators' },
  { slug: 'calcolatore-costo-studente', icon: IconCurrencyEuro, category: 'calculators' },
  { slug: 'validatore-codice-fiscale', icon: IconId, category: 'validators' },
  { slug: 'generatore-calendario-scolastico', icon: IconCalendar, category: 'generators' },
  { slug: 'generatore-orario-settimanale', icon: IconTable, category: 'generators' },
  { slug: 'calcolatore-ore-corso', icon: IconClock, category: 'calculators' },
  { slug: 'generatore-comunicazioni', icon: IconFileText, category: 'generators' },
];

const CATEGORIES: ToolCategory[] = ['calculators', 'generators', 'validators'];

export default async function ToolsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'public.tools' });

  const toolTexts = (slug: string) => ({
    title: t(`items.${slug}.title`),
    description: t(`items.${slug}.description`),
  });

  // JSON-LD for SEO
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t('meta.title'),
    description: t('meta.description'),
    publisher: {
      '@type': 'Organization',
      name: 'InsegnaMi.pro',
      url: 'https://insegnami.pro',
    },
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: TOOLS.map((tool, index) => ({
        '@type': 'SoftwareApplication',
        position: index + 1,
        name: toolTexts(tool.slug).title,
        description: toolTexts(tool.slug).description,
        applicationCategory: 'EducationalApplication',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'EUR',
        },
      })),
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <PageHero
        badge={t('index.badge')}
        title={t('index.title')}
        highlight={t('index.highlight')}
        subtitle={t('index.subtitle')}
      />

      {/* Strumenti per categoria */}
      <Container size="xl" py={{ base: 32, sm: 48 }}>
        <Stack gap={48}>
          {CATEGORIES.map((category) => {
            const categoryTools = TOOLS.filter((tool) => tool.category === category);
            if (categoryTools.length === 0) return null;

            return (
              <Box key={category}>
                <Group align="baseline" gap="sm" mb="lg">
                  <Title order={2} fz={rem(24)} fw={800} c="var(--pub-ink)">
                    {t(`index.categories.${category}`)}
                  </Title>
                  <Text size="sm" c="dimmed">
                    {t('index.toolCount', { count: categoryTools.length })}
                  </Text>
                </Group>
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                  {categoryTools.map((tool) => {
                    const ToolIcon = tool.icon;
                    const texts = toolTexts(tool.slug);
                    return (
                      <Card
                        key={tool.slug}
                        component={Link}
                        href={`/${locale}/tools/${tool.slug}`}
                        padding="xl"
                        radius="lg"
                        bg="white"
                        className="pub-card"
                        h="100%"
                        style={{ textDecoration: 'none' }}
                      >
                        <ThemeIcon size={52} radius="md" variant="light" color="indigo" mb="md">
                          <ToolIcon size={28} />
                        </ThemeIcon>
                        <Title order={3} fz={rem(20)} fw={700} c="var(--pub-ink)" mb={6}>
                          {texts.title}
                        </Title>
                        <Text size="sm" c="dimmed" lh={1.6}>
                          {texts.description}
                        </Text>
                      </Card>
                    );
                  })}
                </SimpleGrid>
              </Box>
            );
          })}
        </Stack>
      </Container>

      {/* CTA finale */}
      <CtaBanner locale={locale} title={t('index.ctaTitle')} subtitle={t('index.ctaSubtitle')} />
    </>
  );
}
