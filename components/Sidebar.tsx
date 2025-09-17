'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { 
  AppShell, 
  NavLink, 
  Group, 
  Text, 
  UnstyledButton,
  Avatar,
  Menu,
  rem,
  Box,
  Stack,
} from '@mantine/core';
import {
  IconDashboard,
  IconUsers,
  IconSchool,
  IconCalendar,
  IconCash,
  IconBell,
  IconReport,
  IconSettings,
  IconLogout,
  IconChevronDown,
  IconUserCircle,
  IconBook,
  IconClipboardList,
  IconUser,
  IconChalkboard,
  IconMessage,
  IconChartBar,
  IconHome,
  IconUserHeart,
} from '@tabler/icons-react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface SidebarProps {
  opened: boolean;
}

export function Sidebar({ opened }: SidebarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('navigation');
  const userRole = session?.user?.role;

  // Define navigation items based on role
  const getNavigationItems = () => {
    const commonItems = [
      { 
        icon: IconDashboard, 
        label: t('dashboard'), 
        href: `/${locale}/dashboard` 
      },
    ];

    const roleBasedItems = {
      ADMIN: [
        { icon: IconUsers, label: t('users'), href: `/${locale}/dashboard/admin/users` },
        { icon: IconUser, label: t('students'), href: `/${locale}/dashboard/students` },
        { icon: IconChalkboard, label: t('teachers'), href: `/${locale}/dashboard/teachers` },
        { icon: IconBook, label: t('classes'), href: `/${locale}/dashboard/classes` },
        { icon: IconCalendar, label: t('lessons'), href: `/${locale}/dashboard/lessons` },
        { icon: IconClipboardList, label: t('attendance'), href: `/${locale}/dashboard/attendance` },
        { icon: IconCash, label: t('payments'), href: `/${locale}/dashboard/payments` },
        { icon: IconBell, label: t('notices'), href: `/${locale}/dashboard/notices` },
        { icon: IconMessage, label: 'Communication', href: `/${locale}/dashboard/communication` },
        { icon: IconChartBar, label: 'Analytics', href: `/${locale}/dashboard/analytics` },
        { icon: IconReport, label: t('reports'), href: `/${locale}/dashboard/admin/reports` },
        { icon: IconSettings, label: t('settings'), href: `/${locale}/dashboard/admin/settings` },
      ],
      TEACHER: [
        { icon: IconBook, label: t('classes'), href: `/${locale}/dashboard/classes` },
        { icon: IconCalendar, label: t('lessons'), href: `/${locale}/dashboard/lessons` },
        { icon: IconClipboardList, label: t('attendance'), href: `/${locale}/dashboard/attendance` },
        { icon: IconBell, label: t('notices'), href: `/${locale}/dashboard/notices` },
        { icon: IconUserCircle, label: 'Profile', href: `/${locale}/dashboard/teacher` },
      ],
      STUDENT: [
        { icon: IconBook, label: 'My Courses', href: `/${locale}/dashboard/classes` },
        { icon: IconCalendar, label: 'Schedule', href: `/${locale}/dashboard/lessons` },
        { icon: IconClipboardList, label: t('attendance'), href: `/${locale}/dashboard/attendance` },
        { icon: IconCash, label: t('payments'), href: `/${locale}/dashboard/payments` },
        { icon: IconBell, label: t('notices'), href: `/${locale}/dashboard/notices` },
        { icon: IconUserCircle, label: 'Profile', href: `/${locale}/dashboard/student` },
      ],
      PARENT: [
        { icon: IconUserHeart, label: 'My Children', href: `/${locale}/dashboard/students` },
        { icon: IconClipboardList, label: t('attendance'), href: `/${locale}/dashboard/attendance` },
        { icon: IconCash, label: t('payments'), href: `/${locale}/dashboard/payments` },
        { icon: IconBell, label: t('notices'), href: `/${locale}/dashboard/notices` },
        { icon: IconUserCircle, label: 'Profile', href: `/${locale}/dashboard/parent` },
      ],
      SUPERADMIN: [
        { icon: IconHome, label: 'Schools', href: `/${locale}/superadmin/tenants` },
        { icon: IconUsers, label: 'Administrators', href: `/${locale}/superadmin/admins` },
        { icon: IconReport, label: 'Analytics', href: `/${locale}/superadmin/analytics` },
        { icon: IconSettings, label: 'System', href: `/${locale}/superadmin/settings` },
      ],
    };

    return [
      ...commonItems,
      ...(roleBasedItems[userRole as keyof typeof roleBasedItems] || []),
    ];
  };

  const navigationItems = getNavigationItems();

  return (
    <AppShell.Navbar 
      p="md" 
      w={300}
      style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRight: 'none',
      }}
    >
      <AppShell.Section>
        <Group pb="md" mb="md" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <img 
            src="/images/logo.svg" 
            alt="InsegnaMi.pro" 
            height="40"
            style={{ 
              height: '40px', 
              width: 'auto',
              filter: 'brightness(0) invert(1)', // Makes the logo white
            }}
          />
        </Group>
      </AppShell.Section>

      <AppShell.Section grow>
        <Stack gap="xs">
          {navigationItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <NavLink
                key={index}
                component={Link}
                href={item.href}
                label={item.label}
                leftSection={<Icon size="1rem" stroke={1.5} />}
                active={isActive}
                variant="filled"
                styles={(theme) => ({
                  root: {
                    borderRadius: rem(12),
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    },
                    '&[data-active]': {
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      '&::before': {
                        backgroundColor: 'white',
                      },
                    },
                  },
                  section: {
                    color: 'rgba(255, 255, 255, 0.8)',
                  },
                  label: {
                    color: 'white',
                    fontWeight: 500,
                  },
                })}
              />
            );
          })}
        </Stack>
      </AppShell.Section>

      <AppShell.Section>
        <Group style={{ borderTop: '1px solid rgba(255, 255, 255, 0.1)', paddingTop: 16 }}>
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <UnstyledButton
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                <Avatar
                  src={session?.user?.avatar}
                  size="sm"
                  radius="xl"
                  style={{
                    background: 'linear-gradient(45deg, #fff, #f1f5f9)',
                    color: '#475569',
                  }}
                >
                  {session?.user?.firstName?.[0]}{session?.user?.lastName?.[0]}
                </Avatar>
                <Box style={{ flex: 1, textAlign: 'left' }}>
                  <Text size="sm" fw={500} c="white">
                    {session?.user?.firstName} {session?.user?.lastName}
                  </Text>
                  <Text size="xs" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    {userRole?.toLowerCase() || 'user'}
                  </Text>
                </Box>
                <IconChevronDown size="0.875rem" stroke={1.5} color="rgba(255, 255, 255, 0.7)" />
              </UnstyledButton>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>Account</Menu.Label>
              <Menu.Item
                component={Link}
                href={`/${locale}/dashboard/profile`}
                leftSection={<IconUserCircle size="0.875rem" />}
              >
                Profilo
              </Menu.Item>
              <Menu.Item
                component={Link}
                href={`/${locale}/dashboard/settings`}
                leftSection={<IconSettings size="0.875rem" />}
              >
                Impostazioni
              </Menu.Item>
              
              <Menu.Divider />
              
              <Menu.Item
                color="red"
                leftSection={<IconLogout size="0.875rem" />}
                onClick={() => signOut({ callbackUrl: `/${locale}/auth/login` })}
              >
                Logout
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      </AppShell.Section>
    </AppShell.Navbar>
  );
}
