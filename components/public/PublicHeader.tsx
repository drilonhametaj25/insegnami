'use client';

import { Container, Group, Text, Anchor, Box, Burger, Drawer, Stack, rem } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import Link from 'next/link';

export function PublicHeader({ locale }: { locale: string }) {
  const [opened, { toggle, close }] = useDisclosure(false);

  const navLinks = [
    { label: 'Blog', href: `/${locale}/blog` },
    { label: 'Prezzi', href: `/${locale}/pricing` },
    { label: 'Strumenti', href: `/${locale}/tools` },
  ];

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

          {/* Desktop nav */}
          <Group gap="lg" visibleFrom="sm">
            {navLinks.map((link) => (
              <Anchor key={link.href} component={Link} href={link.href} c="dark" size="sm">
                {link.label}
              </Anchor>
            ))}
            <Anchor
              component={Link}
              href={`/${locale}/auth/login`}
              c="dark"
              size="sm"
            >
              Accedi
            </Anchor>
            <Anchor
              component={Link}
              href={`/${locale}/auth/register`}
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

          {/* Mobile burger */}
          <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
        </Group>
      </Container>

      {/* Mobile drawer */}
      <Drawer
        opened={opened}
        onClose={close}
        size="xs"
        padding="md"
        title={
          <Text
            size="xl"
            fw={700}
            variant="gradient"
            gradient={{ from: 'blue', to: 'cyan', deg: 45 }}
          >
            InsegnaMi.pro
          </Text>
        }
        zIndex={200}
      >
        <Stack gap="lg" mt="md">
          {navLinks.map((link) => (
            <Anchor
              key={link.href}
              component={Link}
              href={link.href}
              c="dark"
              size="md"
              onClick={close}
            >
              {link.label}
            </Anchor>
          ))}
          <Anchor
            component={Link}
            href={`/${locale}/auth/login`}
            c="dark"
            size="md"
            onClick={close}
          >
            Accedi
          </Anchor>
          <Anchor
            component={Link}
            href={`/${locale}/auth/register`}
            onClick={close}
            style={{
              backgroundColor: 'var(--mantine-color-blue-6)',
              color: 'white',
              padding: '0.75rem 1.5rem',
              borderRadius: 'var(--mantine-radius-md)',
              textDecoration: 'none',
              fontSize: 'var(--mantine-font-size-md)',
              textAlign: 'center',
              display: 'block',
            }}
          >
            Prova Gratis
          </Anchor>
        </Stack>
      </Drawer>
    </Box>
  );
}
