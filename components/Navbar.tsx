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
    <Group h="100%" px="md" justify="space-between" style={{ borderBottom: 'none' }}>
      <Group>
        <Burger
          opened={opened}
          onClick={toggle}
          hiddenFrom="sm"
          size="sm"
          color="gray.6"
        />
        <Group>
          <Text
            size="xl"
            fw={700}
            visibleFrom="sm"
            style={{
              background: 'linear-gradient(45deg, #667eea, #764ba2)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {session?.user?.tenantName || 'InsegnaMi.pro'}
          </Text>
          <Badge 
            size="xs" 
            variant="light" 
            color="blue" 
            visibleFrom="sm"
            style={{ marginLeft: 8 }}
          >
            v2.0
          </Badge>
        </Group>
      </Group>

      <Group>
        {/* Search */}
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          title="Cerca"
        >
          <IconSearch size="1.25rem" />
        </ActionIcon>

        {/* Language Selector */}
        <LanguageSelector />

        {/* Theme Toggle */}
        <ActionIcon
          variant="subtle"
          color="gray"
          size="lg"
          title="Cambia tema"
          onClick={toggleColorScheme}
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
              variant="subtle"
              color="gray"
              size="lg"
              title="Notifiche"
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
          variant="subtle"
          color="gray"
          size="lg"
          title="Impostazioni"
        >
          <IconSettings size="1.25rem" />
        </ActionIcon>

        {/* User Info - Mobile */}
        <Text size="sm" fw={500} hiddenFrom="sm">
          {session?.user?.firstName}
        </Text>
      </Group>
    </Group>
  );
}
