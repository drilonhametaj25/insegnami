'use client';

import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import {
  AppShell,
  NavLink,
  Text,
  UnstyledButton,
  Avatar,
  Menu,
  rem,
  Box,
  Stack,
  ScrollArea,
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
  IconChevronUp,
  IconUserCircle,
  IconBook,
  IconClipboardList,
  IconUser,
  IconChalkboard,
  IconMessage,
  IconChartBar,
  IconHome,
  IconUserHeart,
  IconClock,
  IconBooks,
  IconCalendarTime,
  IconWriting,
  IconAlertTriangle,
  IconNotebook,
  IconFileDescription,
  IconCalendarEvent,
  IconBuilding,
  IconCreditCard,
  IconReceipt,
  IconCalendarStats,
  IconFileInvoice,
  IconWallet,
  IconReportMoney,
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
        href: `/${locale}/dashboard`,
      },
    ];

    const roleBasedItems = {
      ADMIN: [
        { icon: IconUsers, label: t('users'), href: `/${locale}/dashboard/admin/users` },
        { icon: IconUser, label: t('students'), href: `/${locale}/dashboard/students` },
        { icon: IconChalkboard, label: t('teachers'), href: `/${locale}/dashboard/teachers` },
        { icon: IconSchool, label: t('courses'), href: `/${locale}/dashboard/courses` },
        { icon: IconBook, label: t('classes'), href: `/${locale}/dashboard/classes` },
        { icon: IconBooks, label: t('subjects'), href: `/${locale}/dashboard/subjects` },
        { icon: IconCalendarTime, label: t('academicYears'), href: `/${locale}/dashboard/academic-years` },
        { icon: IconWriting, label: t('grades'), href: `/${locale}/dashboard/grades` },
        { icon: IconFileDescription, label: t('reportCards'), href: `/${locale}/dashboard/report-cards` },
        { icon: IconAlertTriangle, label: t('disciplinary'), href: `/${locale}/dashboard/disciplinary` },
        { icon: IconNotebook, label: t('homework'), href: `/${locale}/dashboard/homework` },
        { icon: IconCalendarEvent, label: t('meetings'), href: `/${locale}/dashboard/meetings` },
        { icon: IconCalendar, label: t('lessons'), href: `/${locale}/dashboard/lessons` },
        { icon: IconCalendarStats, label: 'Generatore Orario', href: `/${locale}/dashboard/schedules` },
        { icon: IconClipboardList, label: t('attendance'), href: `/${locale}/dashboard/attendance` },
        { icon: IconClock, label: t('hoursPackages'), href: `/${locale}/dashboard/hours-packages` },
        { icon: IconCash, label: t('payments'), href: `/${locale}/dashboard/payments` },
        { icon: IconFileInvoice, label: t('invoices'), href: `/${locale}/dashboard/invoices` },
        { icon: IconWallet, label: t('payroll'), href: `/${locale}/dashboard/payroll` },
        { icon: IconReportMoney, label: t('accounting'), href: `/${locale}/dashboard/accounting` },
        { icon: IconBell, label: t('notices'), href: `/${locale}/dashboard/notices` },
        { icon: IconMessage, label: 'Communication', href: `/${locale}/dashboard/communication` },
        { icon: IconChartBar, label: 'Analytics', href: `/${locale}/dashboard/analytics` },
        { icon: IconReport, label: t('reports'), href: `/${locale}/dashboard/reports` },
      ],
      TEACHER: [
        { icon: IconSchool, label: t('courses'), href: `/${locale}/dashboard/courses` },
        { icon: IconBook, label: t('classes'), href: `/${locale}/dashboard/classes` },
        { icon: IconWriting, label: t('grades'), href: `/${locale}/dashboard/grades` },
        { icon: IconFileDescription, label: t('reportCards'), href: `/${locale}/dashboard/report-cards` },
        { icon: IconAlertTriangle, label: t('disciplinary'), href: `/${locale}/dashboard/disciplinary` },
        { icon: IconNotebook, label: t('homework'), href: `/${locale}/dashboard/homework` },
        { icon: IconCalendarEvent, label: t('meetings'), href: `/${locale}/dashboard/meetings` },
        { icon: IconCalendar, label: t('lessons'), href: `/${locale}/dashboard/lessons` },
        { icon: IconClipboardList, label: t('attendance'), href: `/${locale}/dashboard/attendance` },
        { icon: IconWallet, label: t('myPayslips'), href: `/${locale}/dashboard/payroll` },
        { icon: IconBell, label: t('notices'), href: `/${locale}/dashboard/notices` },
        { icon: IconUserCircle, label: 'Profilo', href: `/${locale}/dashboard/profile` },
      ],
      STUDENT: [
        { icon: IconBook, label: 'My Courses', href: `/${locale}/dashboard/classes` },
        { icon: IconCalendar, label: 'Schedule', href: `/${locale}/dashboard/lessons` },
        { icon: IconClipboardList, label: t('attendance'), href: `/${locale}/dashboard/attendance` },
        { icon: IconCash, label: t('payments'), href: `/${locale}/dashboard/payments` },
        { icon: IconBell, label: t('notices'), href: `/${locale}/dashboard/notices` },
        { icon: IconUserCircle, label: 'Profilo', href: `/${locale}/dashboard/profile` },
      ],
      PARENT: [
        { icon: IconUserHeart, label: 'My Children', href: `/${locale}/dashboard/students` },
        { icon: IconClipboardList, label: t('attendance'), href: `/${locale}/dashboard/attendance` },
        { icon: IconCalendarEvent, label: t('meetings'), href: `/${locale}/dashboard/meetings` },
        { icon: IconCash, label: t('payments'), href: `/${locale}/dashboard/payments` },
        { icon: IconBell, label: t('notices'), href: `/${locale}/dashboard/notices` },
        { icon: IconUserCircle, label: 'Profilo', href: `/${locale}/dashboard/profile` },
      ],
      SUPERADMIN: [
        { icon: IconHome, label: 'Dashboard', href: `/${locale}/dashboard/superadmin` },
        { icon: IconBuilding, label: 'Scuole', href: `/${locale}/dashboard/superadmin/tenants` },
        { icon: IconCreditCard, label: 'Piani', href: `/${locale}/dashboard/superadmin/plans` },
        { icon: IconReceipt, label: 'Abbonamenti', href: `/${locale}/dashboard/superadmin/subscriptions` },
        { icon: IconSettings, label: 'Impostazioni', href: `/${locale}/dashboard/superadmin/settings` },
      ],
    };

    return [
      ...commonItems,
      ...(roleBasedItems[userRole as keyof typeof roleBasedItems] || []),
    ];
  };

  const navigationItems = getNavigationItems();

  return (
    <>
      {/* Nav links — scrollable so a long menu never overflows the viewport */}
      <AppShell.Section grow component={ScrollArea} px="sm" py="md" scrollbarSize={6} type="hover">
        <Stack gap={4}>
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== `/${locale}/dashboard` && pathname.startsWith(item.href));

            return (
              <NavLink
                key={item.href}
                component={Link}
                href={item.href}
                label={item.label}
                leftSection={<Icon size="1.1rem" stroke={1.6} />}
                active={isActive}
                styles={{
                  root: {
                    borderRadius: rem(10),
                    transition: 'background-color 0.15s ease',
                    backgroundColor: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
                    boxShadow: isActive ? 'inset 3px 0 0 0 var(--mantine-color-amber-5)' : 'none',
                  },
                  label: { color: '#fff', fontWeight: isActive ? 600 : 500, fontSize: rem(14) },
                  section: { color: 'rgba(255,255,255,0.85)' },
                }}
              />
            );
          })}
        </Stack>
      </AppShell.Section>

      {/* Account menu pinned to the bottom */}
      <AppShell.Section p="sm">
        <Box style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: rem(12) }}>
          <Menu shadow="md" width={220} position="top-start" withinPortal>
            <Menu.Target>
              <UnstyledButton
                style={{
                  width: '100%',
                  padding: rem(10),
                  borderRadius: rem(10),
                  display: 'flex',
                  alignItems: 'center',
                  gap: rem(10),
                  background: 'rgba(255,255,255,0.08)',
                }}
              >
                <Avatar src={session?.user?.avatar} size="sm" radius="xl" color="amber" variant="filled">
                  {session?.user?.firstName?.[0]}
                  {session?.user?.lastName?.[0]}
                </Avatar>
                <Box style={{ flex: 1, textAlign: 'left', overflow: 'hidden' }}>
                  <Text size="sm" fw={600} c="white" truncate>
                    {session?.user?.firstName} {session?.user?.lastName}
                  </Text>
                  <Text size="xs" style={{ color: 'rgba(255,255,255,0.65)' }} truncate>
                    {userRole?.toLowerCase() || 'user'}
                  </Text>
                </Box>
                <IconChevronUp size="0.9rem" stroke={1.5} color="rgba(255,255,255,0.7)" />
              </UnstyledButton>
            </Menu.Target>

            <Menu.Dropdown>
              <Menu.Label>Account</Menu.Label>
              <Menu.Item
                component={Link}
                href={`/${locale}/dashboard/profile`}
                leftSection={<IconUserCircle size="0.9rem" />}
              >
                Profilo
              </Menu.Item>
              <Menu.Item
                component={Link}
                href={`/${locale}/dashboard/settings`}
                leftSection={<IconSettings size="0.9rem" />}
              >
                Impostazioni
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item
                color="red"
                leftSection={<IconLogout size="0.9rem" />}
                onClick={() => signOut({ callbackUrl: `/${locale}/auth/login` })}
              >
                Logout
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Box>
      </AppShell.Section>
    </>
  );
}
