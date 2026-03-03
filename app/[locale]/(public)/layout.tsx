import { Container, Group, Text, Anchor, Stack, Divider, SimpleGrid, Box } from '@mantine/core';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

async function PublicHeader({ locale }: { locale: string }) {
  return (
    <Box
      component="header"
      style={{
        borderBottom: '1px solid var(--mantine-color-gray-2)',
        backgroundColor: 'white',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <Container size="xl" py="md">
        <Group justify="space-between">
          <Anchor
            component={Link}
            href={`/${locale}`}
            style={{ textDecoration: 'none' }}
          >
            <Text
              size="xl"
              fw={700}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan', deg: 45 }}
            >
              InsegnaMi.pro
            </Text>
          </Anchor>

          <Group gap="lg">
            <Anchor component={Link} href={`/${locale}/blog`} c="dark" size="sm">
              Blog
            </Anchor>
            <Anchor component={Link} href={`/${locale}/pricing`} c="dark" size="sm">
              Prezzi
            </Anchor>
            <Anchor component={Link} href={`/${locale}/tools`} c="dark" size="sm">
              Strumenti
            </Anchor>
            <Anchor
              component={Link}
              href="/auth/login"
              c="dark"
              size="sm"
            >
              Accedi
            </Anchor>
            <Anchor
              component={Link}
              href="/auth/register"
              style={{
                backgroundColor: 'var(--mantine-color-blue-6)',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: 'var(--mantine-radius-md)',
                textDecoration: 'none',
                fontSize: 'var(--mantine-font-size-sm)',
              }}
            >
              Prova Gratis
            </Anchor>
          </Group>
        </Group>
      </Container>
    </Box>
  );
}

async function PublicFooter({ locale }: { locale: string }) {
  const currentYear = new Date().getFullYear();

  return (
    <Box
      component="footer"
      style={{
        backgroundColor: 'var(--mantine-color-gray-0)',
        borderTop: '1px solid var(--mantine-color-gray-2)',
        marginTop: 'auto',
      }}
    >
      <Container size="xl" py="xl">
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="lg">
          {/* Brand */}
          <Stack gap="sm">
            <Text
              size="xl"
              fw={700}
              variant="gradient"
              gradient={{ from: 'blue', to: 'cyan', deg: 45 }}
            >
              InsegnaMi.pro
            </Text>
            <Text size="sm" c="dimmed">
              Il software gestionale per scuole private, accademie e centri di formazione.
            </Text>
          </Stack>

          {/* Product */}
          <Stack gap="xs">
            <Text fw={500} mb="xs">
              Prodotto
            </Text>
            <Anchor component={Link} href={`/${locale}/pricing`} c="dimmed" size="sm">
              Prezzi
            </Anchor>
            <Anchor component={Link} href={`/${locale}/tools`} c="dimmed" size="sm">
              Strumenti gratuiti
            </Anchor>
            <Anchor component={Link} href={`/${locale}/blog`} c="dimmed" size="sm">
              Blog
            </Anchor>
          </Stack>

          {/* Company */}
          <Stack gap="xs">
            <Text fw={500} mb="xs">
              Azienda
            </Text>
            <Anchor component={Link} href={`/${locale}/contact`} c="dimmed" size="sm">
              Contatti
            </Anchor>
          </Stack>

          {/* Legal */}
          <Stack gap="xs">
            <Text fw={500} mb="xs">
              Legale
            </Text>
            <Anchor component={Link} href={`/${locale}/privacy`} c="dimmed" size="sm">
              Privacy Policy
            </Anchor>
            <Anchor component={Link} href={`/${locale}/terms`} c="dimmed" size="sm">
              Termini di servizio
            </Anchor>
            <Anchor component={Link} href={`/${locale}/cookies`} c="dimmed" size="sm">
              Cookie Policy
            </Anchor>
          </Stack>
        </SimpleGrid>

        <Divider my="lg" />

        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            &copy; {currentYear} InsegnaMi.pro. Tutti i diritti riservati. | P.IVA: 07327360488
          </Text>
          <Group gap="xs">
            <Anchor component={Link} href={`/it`} c="dimmed" size="sm">
              IT
            </Anchor>
            <Text c="dimmed" size="sm">
              |
            </Text>
            <Anchor component={Link} href={`/en`} c="dimmed" size="sm">
              EN
            </Anchor>
            <Text c="dimmed" size="sm">
              |
            </Text>
            <Anchor component={Link} href={`/fr`} c="dimmed" size="sm">
              FR
            </Anchor>
            <Text c="dimmed" size="sm">
              |
            </Text>
            <Anchor component={Link} href={`/pt`} c="dimmed" size="sm">
              PT
            </Anchor>
          </Group>
        </Group>
      </Container>
    </Box>
  );
}

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <PublicHeader locale={locale} />
      <main style={{ flex: 1 }}>{children}</main>
      <PublicFooter locale={locale} />
    </div>
  );
}
