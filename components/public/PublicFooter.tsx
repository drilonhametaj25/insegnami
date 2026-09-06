import { Anchor, Box, Container, Divider, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { FEATURE_SLUGS } from '@/app/[locale]/(public)/funzionalita/_content';
import { PUB_GRADIENT } from './PublicUI';

const linkStyle = { color: 'var(--mantine-color-gray-5)' };

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Anchor component={Link} href={href} size="sm" style={linkStyle} underline="hover">
      {children}
    </Anchor>
  );
}

export async function PublicFooter({ locale }: { locale: string }) {
  const currentYear = new Date().getFullYear();
  const t = await getTranslations({ locale, namespace: 'public.footer' });
  const tf = await getTranslations({ locale, namespace: 'public.features' });

  const columns: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: t('productTitle'),
      links: [
        { label: t('links.features'), href: `/${locale}/funzionalita` },
        { label: t('links.pricing'), href: `/${locale}/pricing` },
        { label: t('links.blog'), href: `/${locale}/blog` },
        { label: t('links.cities'), href: `/${locale}/citta` },
      ],
    },
    {
      title: t('featuresTitle'),
      links: FEATURE_SLUGS.map((slug) => ({
        label: tf(`pages.${slug}.navLabel`),
        href: `/${locale}/funzionalita/${slug}`,
      })),
    },
    {
      title: t('toolsTitle'),
      links: [
        { label: t('links.allTools'), href: `/${locale}/tools` },
        { label: t('links.gradeCalculator'), href: `/${locale}/tools/calcolatore-media-voti` },
        { label: t('links.attendanceCalculator'), href: `/${locale}/tools/calcolatore-presenze` },
        {
          label: t('links.scheduleGenerator'),
          href: `/${locale}/tools/generatore-orario-settimanale`,
        },
      ],
    },
    {
      title: t('legalTitle'),
      links: [
        { label: t('links.contact'), href: `/${locale}/contact` },
        { label: t('links.privacy'), href: `/${locale}/privacy` },
        { label: t('links.terms'), href: `/${locale}/terms` },
        { label: t('links.cookies'), href: `/${locale}/cookies` },
      ],
    },
  ];

  return (
    <Box component="footer" style={{ backgroundColor: 'var(--pub-ink)', marginTop: 'auto' }}>
      <Container size="xl" py={56}>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 5 }} spacing="xl">
          <Stack gap="sm">
            <Text size="xl" fw={800} variant="gradient" gradient={PUB_GRADIENT}>
              InsegnaMi.pro
            </Text>
            <Text size="sm" c="gray.5" maw={260}>
              {t('description')}
            </Text>
          </Stack>

          {columns.map((col) => (
            <Stack key={col.title} gap={10}>
              <Text fw={600} size="sm" c="white" mb={4}>
                {col.title}
              </Text>
              {col.links.map((link) => (
                <FooterLink key={link.href} href={link.href}>
                  {link.label}
                </FooterLink>
              ))}
            </Stack>
          ))}
        </SimpleGrid>

        <Divider my="xl" color="rgba(255,255,255,0.1)" />

        <Group justify="space-between" gap="md">
          <Text size="sm" c="gray.6">
            &copy; {currentYear} InsegnaMi.pro. {t('rights')} | P.IVA: 07327360488
          </Text>
          <Group gap={4}>
            {(['it', 'en', 'fr', 'pt'] as const).map((lang, i) => (
              <Group key={lang} gap={4}>
                {i > 0 && (
                  <Text c="gray.7" size="sm">
                    ·
                  </Text>
                )}
                <Anchor
                  component={Link}
                  href={`/${lang}`}
                  size="sm"
                  tt="uppercase"
                  fw={lang === locale ? 700 : 400}
                  style={{ color: lang === locale ? 'white' : 'var(--mantine-color-gray-6)' }}
                  underline="hover"
                >
                  {lang}
                </Anchor>
              </Group>
            ))}
          </Group>
        </Group>
      </Container>
    </Box>
  );
}
