import { existsSync } from 'fs';
import path from 'path';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  Anchor,
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
import { IconArrowRight, IconPhoto } from '@tabler/icons-react';
import { getTranslations } from 'next-intl/server';
import { buildPublicMetadata, PUBLIC_LOCALES, SITE_URL } from '@/lib/seo';
import { breadcrumbJsonLd, faqPageJsonLd } from '@/lib/structured-data';
import { CtaBanner, PUB_GRADIENT, SectionHeader } from '@/components/public/PublicUI';
import { FEATURE_SLUGS, buildFeaturePage } from '../_content';

export async function generateStaticParams() {
  const params: { locale: string; slug: string }[] = [];
  for (const locale of PUBLIC_LOCALES) {
    for (const slug of FEATURE_SLUGS) {
      params.push({ locale, slug });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'public.features' });
  const feature = buildFeaturePage(slug, t);
  if (!feature) {
    return { title: t('detail.notFound') };
  }
  return buildPublicMetadata({
    locale,
    path: `/funzionalita/${feature.slug}`,
    title: feature.metaTitle,
    description: feature.metaDescription,
  });
}

/**
 * Screenshot con fallback: i PNG in public/images/screenshots/ vengono
 * generati da un processo separato; finché il file non esiste mostriamo
 * un placeholder grigio invece di un'immagine rotta.
 */
function FeatureScreenshot({
  src,
  alt,
  fallbackLabel,
}: {
  src: string;
  alt: string;
  fallbackLabel: string;
}) {
  const exists = existsSync(path.join(process.cwd(), 'public', src));

  return (
    <Card padding={0} radius="lg" withBorder style={{ overflow: 'hidden' }} maw={960} mx="auto">
      {exists ? (
        <Image
          src={src}
          alt={alt}
          width={1440}
          height={900}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        />
      ) : (
        <Stack
          align="center"
          justify="center"
          gap="sm"
          bg="gray.1"
          mih={320}
          role="img"
          aria-label={alt}
        >
          <ThemeIcon size={56} radius="xl" variant="light" color="gray">
            <IconPhoto size={30} />
          </ThemeIcon>
          <Text size="sm" c="dimmed">
            {fallbackLabel}
          </Text>
        </Stack>
      )}
    </Card>
  );
}

export default async function FunzionalitaDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const t = await getTranslations({ locale, namespace: 'public.features' });
  const feature = buildFeaturePage(slug, t);

  if (!feature) {
    notFound();
  }

  const breadcrumb = breadcrumbJsonLd([
    { name: t('detail.breadcrumbHome'), url: `${SITE_URL}/${locale}` },
    { name: t('detail.breadcrumbFeatures'), url: `${SITE_URL}/${locale}/funzionalita` },
    { name: feature.navLabel, url: `${SITE_URL}/${locale}/funzionalita/${feature.slug}` },
  ]);
  const faqJsonLd = faqPageJsonLd(feature.faqs);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* Hero */}
      <Box className="pub-hero" py={{ base: 56, sm: 80 }}>
        <Container size="xl">
          <Stack gap="md" align="center" ta="center" maw={780} mx="auto">
            <Breadcrumbs>
              <Anchor component={Link} href={`/${locale}`} size="sm" c="indigo.6" underline="hover">
                {t('detail.breadcrumbHome')}
              </Anchor>
              <Anchor
                component={Link}
                href={`/${locale}/funzionalita`}
                size="sm"
                c="indigo.6"
                underline="hover"
              >
                {t('detail.breadcrumbFeatures')}
              </Anchor>
              <Text size="sm" c="dimmed">
                {feature.navLabel}
              </Text>
            </Breadcrumbs>
            <Title fz={{ base: rem(34), sm: rem(46) }} fw={900} lh={1.12} c="var(--pub-ink)">
              {feature.h1}{' '}
              <span className="pub-gradient-text">{feature.h1Highlight}</span>
            </Title>
            <Text size="lg" c="dimmed" maw={640}>
              {feature.sub}
            </Text>
            <Group justify="center" gap="md" mt="xs">
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
                {t('detail.ctaTrial')}
              </Button>
              <Button
                component={Link}
                href={`/${locale}/pricing`}
                size="lg"
                radius="xl"
                variant="default"
              >
                {t('detail.ctaPricing')}
              </Button>
            </Group>
          </Stack>
        </Container>
      </Box>

      {/* Capacità */}
      <Box bg="white" py={{ base: 64, sm: 96 }}>
        <Container size="xl">
          <SectionHeader
            badge={feature.badge}
            title={t('detail.capTitle')}
            highlight={t('detail.capHighlight')}
          />
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {feature.capabilities.map((cap) => (
              <Card key={cap.title} padding="xl" radius="lg" className="pub-card" h="100%">
                <Stack gap="sm">
                  <ThemeIcon size={44} radius="md" variant="light" color="indigo">
                    <cap.icon size={24} />
                  </ThemeIcon>
                  <Title order={3} fz={rem(18)} fw={700} c="var(--pub-ink)">
                    {cap.title}
                  </Title>
                  <Text size="sm" c="dimmed" lh={1.6}>
                    {cap.text}
                  </Text>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* Screenshot */}
      <Box bg="var(--pub-surface)" py={{ base: 64, sm: 96 }}>
        <Container size="xl">
          <SectionHeader
            title={t('detail.uiTitle')}
            highlight={t('detail.uiHighlight')}
            subtitle={t('detail.uiSubtitle')}
          />
          <FeatureScreenshot
            src={feature.screenshot.src}
            alt={feature.screenshot.alt}
            fallbackLabel={t('detail.screenshotFallback')}
          />
        </Container>
      </Box>

      {/* Mini FAQ */}
      <Box bg="white" py={{ base: 64, sm: 96 }}>
        <Container size="md">
          <SectionHeader title={t('detail.faqTitle')} highlight={t('detail.faqHighlight')} />
          <Stack gap="md">
            {feature.faqs.map((faq) => (
              <Card key={faq.question} padding="xl" radius="lg" withBorder>
                <Title order={3} fz={rem(18)} fw={700} c="var(--pub-ink)" mb="xs">
                  {faq.question}
                </Title>
                <Text size="sm" c="dimmed" lh={1.6}>
                  {faq.answer}
                </Text>
              </Card>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* CTA trial */}
      <CtaBanner locale={locale} />
    </>
  );
}
