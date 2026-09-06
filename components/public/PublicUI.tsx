import {
  Badge,
  Box,
  Button,
  Container,
  Group,
  Stack,
  Text,
  Title,
  rem,
} from '@mantine/core';
import { IconArrowRight, IconCheck } from '@tabler/icons-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

/**
 * Brand unico del sito pubblico (navy, accento ambra).
 * Da usare per Button variant="gradient" e Text variant="gradient":
 * mai gradienti hardcoded nelle singole pagine.
 */
export const PUB_GRADIENT = { from: 'navy.8', to: 'navy.6', deg: 135 } as const;

/** Intestazione di sezione: eyebrow + titolo (con parte evidenziata) + sottotitolo. */
export function SectionHeader({
  badge,
  title,
  highlight,
  subtitle,
  light = false,
}: {
  badge?: string;
  title: string;
  highlight?: string;
  subtitle?: string;
  light?: boolean;
}) {
  return (
    <Stack gap="sm" align="center" ta="center" maw={720} mx="auto" mb={56}>
      {badge && (
        <Badge size="lg" variant="light" color="navy" radius="xl">
          {badge}
        </Badge>
      )}
      <Title
        order={2}
        fz={{ base: rem(30), sm: rem(38) }}
        fw={800}
        lh={1.15}
        c={light ? 'white' : 'var(--pub-ink)'}
      >
        {title}
        {highlight && (
          <>
            {' '}
            <span className="pub-gradient-text">{highlight}</span>
          </>
        )}
      </Title>
      {subtitle && (
        <Text size="lg" c={light ? 'gray.4' : 'dimmed'} maw={620}>
          {subtitle}
        </Text>
      )}
    </Stack>
  );
}

/** Hero standard delle pagine interne (blog, strumenti, prezzi, città...). */
export function PageHero({
  badge,
  title,
  highlight,
  subtitle,
  children,
}: {
  badge?: string;
  title: string;
  highlight?: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <Box className="pub-hero" py={{ base: 56, sm: 80 }}>
      <Container size="xl">
        <Stack gap="md" align="center" ta="center" maw={780} mx="auto">
          {badge && (
            <Badge size="lg" variant="light" color="navy" radius="xl">
              {badge}
            </Badge>
          )}
          <Title fz={{ base: rem(34), sm: rem(46) }} fw={900} lh={1.12} c="var(--pub-ink)">
            {title}
            {highlight && (
              <>
                {' '}
                <span className="pub-gradient-text">{highlight}</span>
              </>
            )}
          </Title>
          {subtitle && (
            <Text size="lg" c="dimmed" maw={640}>
              {subtitle}
            </Text>
          )}
          {children}
        </Stack>
      </Container>
    </Box>
  );
}

/** Banda CTA finale, identica su tutte le pagine pubbliche. */
export function CtaBanner({
  locale,
  title,
  subtitle,
}: {
  locale: string;
  title?: string;
  subtitle?: string;
}) {
  // useTranslations funziona sia nei Server Component sia nei client island.
  const t = useTranslations('public.ui');
  const trust = t.raw('trust') as string[];
  const resolvedTitle = title ?? t('ctaTitle');
  const resolvedSubtitle = subtitle ?? t('ctaSubtitle');
  return (
    <Box py={{ base: 64, sm: 88 }} style={{ background: 'var(--pub-brand-gradient)' }}>
      <Container size="md">
        <Stack gap="lg" align="center" ta="center">
          <Title order={2} fz={{ base: rem(30), sm: rem(40) }} fw={900} c="white" lh={1.15}>
            {resolvedTitle}
          </Title>
          <Text size="lg" c="white" opacity={0.92} maw={560}>
            {resolvedSubtitle}
          </Text>
          <Group justify="center" gap="md">
            <Button
              component={Link}
              href={`/${locale}/auth/register`}
              size="lg"
              radius="xl"
              variant="white"
              c="navy.7"
              fw={700}
              rightSection={<IconArrowRight size={18} />}
            >
              {t('ctaPrimary')}
            </Button>
            <Button
              component={Link}
              href={`/${locale}/contact`}
              size="lg"
              radius="xl"
              variant="outline"
              color="white"
              style={{ borderColor: 'rgba(255,255,255,0.6)' }}
            >
              {t('ctaSecondary')}
            </Button>
          </Group>
          <Group justify="center" gap={28} mt={4}>
            {trust.map((item) => (
              <Group key={item} gap={6}>
                <IconCheck size={16} color="white" />
                <Text c="white" size="sm" opacity={0.92}>
                  {item}
                </Text>
              </Group>
            ))}
          </Group>
        </Stack>
      </Container>
    </Box>
  );
}
