'use client';

import { 
  Group, 
  ActionIcon, 
  Text, 
  Indicator, 
  Menu,
  Badge,
  rem,
  Burger,
  Button,
} from '@mantine/core';
import {
  IconBell,
  IconSettings,
  IconSearch,
  IconSun,
  IconMoon,
} from '@tabler/icons-react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { LanguageSelector } from './LanguageSelector';
import { NotificationBell } from './notifications/NotificationCenter';

interface NavbarProps {
  opened: boolean;
  toggle: () => void;
}

export function Navbar({ opened, toggle }: NavbarProps) {
  const { data: session } = useSession();
  const t = useTranslations('common');
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');

  const toggleColorScheme = () => {
    setColorScheme(colorScheme === 'dark' ? 'light' : 'dark');
  };

  return (
    <div
      style={{
        height: '100%',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderBottom: 'none',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
      }}
    >
      <Group>
        <Burger
          opened={opened}
          onClick={toggle}
          hiddenFrom="sm"
          size="sm"
          color="white"
          style={{ color: 'white' }}
        />
        
        {/* Logo - shown only on desktop when sidebar is present */}
        <Group visibleFrom="sm">
          <img 
            src="/images/logo-white.svg" 
            alt="InsegnaMi.pro" 
            height="32"
            style={{ 
              height: '32px', 
              width: 'auto',
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
            }}
          />
        </Group>
      </Group>

      <Group>
        {/* Search */}
        <ActionIcon
          variant="subtle"
          size="lg"
          title="Cerca"
          style={{
            color: 'white',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <IconSearch size="1.25rem" />
        </ActionIcon>

        {/* Language Selector */}
        <LanguageSelector />

        {/* Theme Toggle */}
        <ActionIcon
          size="lg"
          title="Cambia tema"
          onClick={toggleColorScheme}
          style={{
            color: 'white',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {colorScheme === 'dark' ? (
            <IconSun size="1.25rem" />
          ) : (
            <IconMoon size="1.25rem" />
          )}
        </ActionIcon>

        {/* Notifications */}
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <NotificationBell size={20} />
        </div>

        {/* Settings */}
        <ActionIcon
          size="lg"
          title="Impostazioni"
          style={{
            color: 'white',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <IconSettings size="1.25rem" />
        </ActionIcon>

        {/* User Info - Mobile */}
        <Text size="sm" fw={500} hiddenFrom="sm" style={{ color: 'white' }}>
          {session?.user?.firstName}
        </Text>
      </Group>
    </div>
  );
}
