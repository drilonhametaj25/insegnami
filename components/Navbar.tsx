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

interface NavbarProps {
  opened: boolean;
  toggle: () => void;
}

export function Navbar({ opened, toggle }: NavbarProps) {
  const { data: session } = useSession();
  const t = useTranslations('common');
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light');
  const [notifications] = useState([
    { id: 1, title: 'Nuovo studente iscritto', time: '5 min fa', unread: true },
    { id: 2, title: 'Pagamento ricevuto', time: '1 ora fa', unread: true },
    { id: 3, title: 'Lezione cancellata', time: '2 ore fa', unread: false },
  ]);

  const unreadCount = notifications.filter(n => n.unread).length;

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
        <Menu shadow="md" width={300} position="bottom-end">
          <Menu.Target>
            <ActionIcon
              size="lg"
              title="Notifiche"
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
              <Indicator
                color="red"
                size={16}
                label={unreadCount > 0 ? unreadCount : undefined}
                disabled={unreadCount === 0}
              >
                <IconBell size="1.25rem" />
              </Indicator>
            </ActionIcon>
          </Menu.Target>

          <Menu.Dropdown>
            <Menu.Label>
              <Group justify="space-between">
                <Text>{t('notifications')}</Text>
                {unreadCount > 0 && (
                  <Badge size="sm" variant="filled" color="red">
                    {unreadCount}
                  </Badge>
                )}
              </Group>
            </Menu.Label>

            {notifications.length === 0 ? (
              <Menu.Item disabled>
                <Text size="sm" c="dimmed">
                  {t('noNotifications')}
                </Text>
              </Menu.Item>
            ) : (
              notifications.map((notification) => (
                <Menu.Item
                  key={notification.id}
                  style={{
                    backgroundColor: notification.unread ? '#f8f9fa' : 'transparent',
                  }}
                >
                  <div>
                    <Text size="sm" fw={notification.unread ? 500 : 400}>
                      {notification.title}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {notification.time}
                    </Text>
                  </div>
                </Menu.Item>
              ))
            )}

            {notifications.length > 0 && (
              <>
                <Menu.Divider />
                <Menu.Item
                  style={{
                    textAlign: 'center',
                    color: '#0ea5e9',
                    fontSize: '0.875rem',
                  }}
                >
                  Vedi tutte le notifiche
                </Menu.Item>
              </>
            )}
          </Menu.Dropdown>
        </Menu>

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
