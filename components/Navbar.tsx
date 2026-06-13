'use client';

import {
  Group,
  ActionIcon,
  Text,
  Burger,
  useMantineColorScheme,
  useComputedColorScheme,
} from '@mantine/core';
import {
  IconSettings,
  IconSearch,
  IconSun,
  IconMoon,
} from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { LanguageSelector } from './LanguageSelector';
import { NotificationBell } from './notifications/NotificationCenter';
import { BRAND } from '@/lib/theme';

interface NavbarProps {
  opened: boolean;
  toggle: () => void;
}

const iconBtnStyle = {
  color: 'white',
  backgroundColor: 'rgba(255, 255, 255, 0.12)',
  border: '1px solid rgba(255, 255, 255, 0.18)',
} as const;

export function Navbar({ opened, toggle }: NavbarProps) {
  const { data: session } = useSession();
  const locale = useLocale();
  const { setColorScheme } = useMantineColorScheme();
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true });

  const toggleColorScheme = () => setColorScheme(computed === 'dark' ? 'light' : 'dark');

  return (
    <div
      style={{
        height: '100%',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: BRAND.gradient,
      }}
    >
      <Group gap="md">
        <Burger
          opened={opened}
          onClick={toggle}
          hiddenFrom="sm"
          size="sm"
          color="white"
        />

        {/* Logo — leggibile anche nella navbar */}
        <img
          src="/images/logo-white.svg"
          alt="InsegnaMi.pro"
          height={38}
          style={{ height: 38, width: 'auto', display: 'block' }}
        />
      </Group>

      <Group gap="sm">
        <ActionIcon variant="default" size="lg" title="Cerca" style={iconBtnStyle}>
          <IconSearch size="1.2rem" />
        </ActionIcon>

        <LanguageSelector />

        {/* Theme toggle — ora collegato allo schema colori Mantine */}
        <ActionIcon
          size="lg"
          title={computed === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
          onClick={toggleColorScheme}
          style={iconBtnStyle}
        >
          {computed === 'dark' ? <IconSun size="1.2rem" /> : <IconMoon size="1.2rem" />}
        </ActionIcon>

        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: 8,
            display: 'flex',
          }}
        >
          <NotificationBell size={20} />
        </div>

        {/* Settings — ora naviga davvero alla pagina impostazioni */}
        <ActionIcon
          component={Link}
          href={`/${locale}/dashboard/settings`}
          size="lg"
          title="Impostazioni"
          style={iconBtnStyle}
        >
          <IconSettings size="1.2rem" />
        </ActionIcon>

        <Text size="sm" fw={500} hiddenFrom="sm" c="white">
          {session?.user?.firstName}
        </Text>
      </Group>
    </div>
  );
}
