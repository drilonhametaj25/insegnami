import { Anchor, Box, Container, Divider, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import Link from 'next/link';
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

  const columns: { title: string; links: { label: string; href: string }[] }[] = [
    {
      title: 'Prodotto',
      links: [
        { label: 'Funzionalità', href: `/${locale}/#features` },
        { label: 'Prezzi', href: `/${locale}/pricing` },
        { label: 'Blog', href: `/${locale}/blog` },
        { label: 'Scuole per città', href: `/${locale}/citta` },
      ],
    },
    {
      title: 'Strumenti gratuiti',
      links: [
        { label: 'Tutti gli strumenti', href: `/${locale}/tools` },
        { label: 'Calcolatore media voti', href: `/${locale}/tools/calcolatore-media-voti` },
        { label: 'Calcolatore presenze', href: `/${locale}/tools/calcolatore-presenze` },
        { label: 'Generatore orario', href: `/${locale}/tools/generatore-orario-settimanale` },
      ],
    },
    {
      title: 'Azienda e legale',
      links: [
        { label: 'Contatti', href: `/${locale}/contact` },
        { label: 'Privacy Policy', href: `/${locale}/privacy` },
        { label: 'Termini di servizio', href: `/${locale}/terms` },
        { label: 'Cookie Policy', href: `/${locale}/cookies` },
      ],
    },
  ];

  return (
    <Box component="footer" style={{ backgroundColor: 'var(--pub-ink)', marginTop: 'auto' }}>
      <Container size="xl" py={56}>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="xl">
          <Stack gap="sm">
            <Text size="xl" fw={800} variant="gradient" gradient={PUB_GRADIENT}>
              InsegnaMi.pro
            </Text>
            <Text size="sm" c="gray.5" maw={260}>
              Il gestionale all-in-one per scuole private, accademie e centri di formazione.
              Registro elettronico, presenze, pagamenti e comunicazioni.
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
            &copy; {currentYear} InsegnaMi.pro. Tutti i diritti riservati. | P.IVA: 07327360488
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
