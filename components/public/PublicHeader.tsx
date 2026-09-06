'use client';

import {
  Box,
  Burger,
  Button,
  Container,
  Divider,
  Drawer,
  Group,
  Menu,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconChevronDown } from '@tabler/icons-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FEATURE_SLUGS } from '@/app/[locale]/(public)/funzionalita/_content';
import { PUB_GRADIENT } from './PublicUI';

function Logo() {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/images/logo.svg" alt="InsegnaMi.pro" height={34} style={{ height: 34, width: 'auto', display: 'block' }} />;
}

export function PublicHeader({ locale }: { locale: string }) {
  const [opened, { toggle, close }] = useDisclosure(false);
  const t = useTranslations('public.header');
  const tf = useTranslations('public.features');

  const featureLinks = FEATURE_SLUGS.map((slug) => ({
    label: tf(`pages.${slug}.navLabel`),
    href: `/${locale}/funzionalita/${slug}`,
  }));

  const navLinks = [
    { label: t('pricing'), href: `/${locale}/pricing` },
    { label: t('tools'), href: `/${locale}/tools` },
    { label: t('blog'), href: `/${locale}/blog` },
    { label: t('contact'), href: `/${locale}/contact` },
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
            <Menu trigger="click-hover" openDelay={80} closeDelay={150} radius="md" shadow="md" width={280}>
              <Menu.Target>
                <UnstyledButton className="pub-link" style={{ fontSize: 14 }} aria-label={t('openFeaturesMenu')}>
                  <Group gap={4} wrap="nowrap">
                    {t('features')}
                    <IconChevronDown size={14} />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                {featureLinks.map((link) => (
                  <Menu.Item key={link.href} component={Link} href={link.href}>
                    {link.label}
                  </Menu.Item>
                ))}
                <Menu.Divider />
                <Menu.Item component={Link} href={`/${locale}/funzionalita`} fw={600}>
                  {t('allFeatures')}
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="pub-link" style={{ fontSize: 14 }}>
                {link.label}
              </Link>
            ))}
          </Group>

          <Group gap="sm" visibleFrom="md">
            <Button component={Link} href={`/${locale}/auth/login`} variant="subtle" color="gray" radius="xl">
              {t('login')}
            </Button>
            <Button
              component={Link}
              href={`/${locale}/auth/register`}
              variant="gradient"
              gradient={PUB_GRADIENT}
              radius="xl"
              fw={600}
            >
              {t('signup')}
            </Button>
          </Group>

          <Burger opened={opened} onClick={toggle} hiddenFrom="md" size="sm" aria-label={t('openMenu')} />
        </Group>
      </Container>

      {/* Drawer mobile */}
      <Drawer opened={opened} onClose={close} size="xs" padding="lg" title={<Logo />} zIndex={200}>
        <Stack gap="md" mt="md">
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">
            {t('features')}
          </Text>
          {featureLinks.map((link) => (
            <Link key={link.href} href={link.href} className="pub-link" onClick={close} style={{ fontSize: 15 }}>
              {link.label}
            </Link>
          ))}
          <Link
            href={`/${locale}/funzionalita`}
            className="pub-link"
            onClick={close}
            style={{ fontSize: 15, fontWeight: 600 }}
          >
            {t('allFeatures')}
          </Link>
          <Divider my="xs" />
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
            {t('login')}
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
            {t('signup')}
          </Button>
        </Stack>
      </Drawer>
    </Box>
  );
}
