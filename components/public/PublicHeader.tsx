'use client';

import { Box, Burger, Button, Container, Divider, Drawer, Group, Stack, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import Link from 'next/link';
import { PUB_GRADIENT } from './PublicUI';

function Logo() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/logo.svg" alt="InsegnaMi.pro" height={34} style={{ height: 34, width: 'auto', display: 'block' }} />;
}

export function PublicHeader({ locale }: { locale: string }) {
  const [opened, { toggle, close }] = useDisclosure(false);

  const navLinks = [
    { label: 'Funzionalità', href: `/${locale}/#features` },
    { label: 'Prezzi', href: `/${locale}/pricing` },
    { label: 'Strumenti', href: `/${locale}/tools` },
    { label: 'Blog', href: `/${locale}/blog` },
  ];

  return (
    <Box
      component="header"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--pub-border)',
      }}
    >
      <Container size="xl" h={64} display="flex" style={{ alignItems: 'center' }}>
        <Group justify="space-between" w="100%" wrap="nowrap">
          <Link href={`/${locale}`} style={{ textDecoration: 'none' }} aria-label="InsegnaMi.pro — Home">
            <Logo />
          </Link>

          {/* Nav desktop */}
          <Group gap={28} visibleFrom="md">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="pub-link" style={{ fontSize: 14 }}>
                {link.label}
              </Link>
            ))}
          </Group>

          <Group gap="sm" visibleFrom="md">
            <Button component={Link} href={`/${locale}/auth/login`} variant="subtle" color="gray" radius="xl">
              Accedi
            </Button>
            <Button
              component={Link}
              href={`/${locale}/auth/register`}
              variant="gradient"
              gradient={PUB_GRADIENT}
              radius="xl"
              fw={600}
            >
              Prova gratis
            </Button>
          </Group>

          <Burger opened={opened} onClick={toggle} hiddenFrom="md" size="sm" aria-label="Apri menu" />
        </Group>
      </Container>

      {/* Drawer mobile */}
      <Drawer opened={opened} onClose={close} size="xs" padding="lg" title={<Logo />} zIndex={200}>
        <Stack gap="md" mt="md">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} className="pub-link" onClick={close} style={{ fontSize: 16 }}>
              {link.label}
            </Link>
          ))}
          <Divider my="xs" />
          <Button
            component={Link}
            href={`/${locale}/auth/login`}
            variant="default"
            radius="xl"
            fullWidth
            onClick={close}
          >
            Accedi
          </Button>
          <Button
            component={Link}
            href={`/${locale}/auth/register`}
            variant="gradient"
            gradient={PUB_GRADIENT}
            radius="xl"
            fullWidth
            fw={600}
            onClick={close}
          >
            Prova gratis
          </Button>
        </Stack>
      </Drawer>
    </Box>
  );
}
