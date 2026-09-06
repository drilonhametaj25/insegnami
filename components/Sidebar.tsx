'use client';

import { useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import {
  AppShell,
  NavLink,
  Text,
  UnstyledButton,
  Avatar,
  Badge,
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
  IconFolder,
  IconMailbox,
} from '@tabler/icons-react';
import { signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Role } from '@prisma/client';
import { can, type Action, type Resource } from '@/lib/permissions/matrix';
import { featureBadgeLabel, type FeatureKey } from '@/lib/billing/feature-catalog';
import { useFeatures } from '@/lib/hooks/useFeatures';

interface SidebarProps {
  opened: boolean;
}

type NavItem = {
  /** path relativo a /{locale}/dashboard ('' = dashboard) */
  href: string;
  /** chiave del namespace navigation (se presente in messages) */
  labelKey?: string;
  /** label fissa (voci senza traduzione dedicata) */
  label?: string;
  icon: React.ElementType;
  /** permesso richiesto dalla matrice; assente = sempre visibile */
  action?: Action;
  resource?: Resource;
  /** vincolo esplicito di ruolo (in AND col permesso) */
  roles?: Role[];
  /**
   * Feature di piano richiesta: la voce resta VISIBILE anche senza feature,
   * ma con badge PRO/ENTERPRISE e link a /dashboard/billing?upsell=<feature>.
   */
  feature?: FeatureKey;
  children?: NavItem[];
};

const ADMIN_FAMILY: Role[] = ['SUPERADMIN', 'ADMIN', 'DIRECTOR', 'SECRETARY'];

// Voci di navigazione dichiarative: filtrate a runtime con can(role, action, resource).
const NAV_ITEMS: NavItem[] = [
  { href: '', labelKey: 'dashboard', icon: IconDashboard },

  // --- SUPERADMIN (gestione piattaforma) ---
  { href: '/superadmin', label: 'Dashboard Piattaforma', icon: IconHome, roles: ['SUPERADMIN'], action: 'read', resource: 'tenant' },
  { href: '/superadmin/tenants', label: 'Scuole', icon: IconBuilding, roles: ['SUPERADMIN'], action: 'read', resource: 'tenant' },
  { href: '/superadmin/plans', label: 'Piani', icon: IconCreditCard, roles: ['SUPERADMIN'], action: 'read', resource: 'plan' },
  { href: '/superadmin/subscriptions', label: 'Abbonamenti', icon: IconReceipt, roles: ['SUPERADMIN'], action: 'read', resource: 'subscription' },
  { href: '/superadmin/leads', label: 'Lead', icon: IconMailbox, roles: ['SUPERADMIN'], action: 'read', resource: 'tenant' },
  { href: '/superadmin/settings', label: 'Impostazioni Piattaforma', icon: IconSettings, roles: ['SUPERADMIN'], action: 'read', resource: 'settings' },

  // --- Amministrazione scuola (ADMIN/SUPERADMIN/DIRECTOR/SECRETARY, filtrate dalla matrice) ---
  { href: '/admin/users', labelKey: 'users', icon: IconUsers, roles: ADMIN_FAMILY, action: 'read', resource: 'user' },
  { href: '/students', labelKey: 'students', icon: IconUser, roles: ADMIN_FAMILY, action: 'read', resource: 'student' },
  { href: '/teachers', labelKey: 'teachers', icon: IconChalkboard, roles: ADMIN_FAMILY, action: 'read', resource: 'teacher' },
  { href: '/courses', labelKey: 'courses', icon: IconSchool, roles: ADMIN_FAMILY, action: 'read', resource: 'course' },
  { href: '/classes', labelKey: 'classes', icon: IconBook, roles: ADMIN_FAMILY, action: 'read', resource: 'class' },
  { href: '/subjects', labelKey: 'subjects', icon: IconBooks, roles: ADMIN_FAMILY, action: 'read', resource: 'subject' },
  { href: '/academic-years', labelKey: 'academicYears', icon: IconCalendarTime, roles: ADMIN_FAMILY, action: 'read', resource: 'academicYear' },
  { href: '/grades', labelKey: 'grades', icon: IconWriting, roles: ADMIN_FAMILY, action: 'read', resource: 'grade' },
  { href: '/report-cards', labelKey: 'reportCards', icon: IconFileDescription, roles: ADMIN_FAMILY, action: 'read', resource: 'reportCard' },
  { href: '/disciplinary', labelKey: 'disciplinary', icon: IconAlertTriangle, roles: ADMIN_FAMILY, action: 'read', resource: 'disciplinaryNote' },
  { href: '/homework', labelKey: 'homework', icon: IconNotebook, roles: ADMIN_FAMILY, action: 'read', resource: 'homework' },
  { href: '/meetings', labelKey: 'meetings', icon: IconCalendarEvent, roles: ADMIN_FAMILY, action: 'read', resource: 'parentMeeting' },
  { href: '/lessons', labelKey: 'lessons', icon: IconCalendar, roles: ADMIN_FAMILY, action: 'read', resource: 'lesson' },
  { href: '/schedules', label: 'Generatore Orario', icon: IconCalendarStats, roles: ADMIN_FAMILY, action: 'read', resource: 'schedule' },
  { href: '/attendance', labelKey: 'attendance', icon: IconClipboardList, roles: ADMIN_FAMILY, action: 'read', resource: 'attendance' },
  { href: '/hours-packages', labelKey: 'hoursPackages', icon: IconClock, roles: ADMIN_FAMILY, action: 'read', resource: 'payment', feature: 'hoursPackages' },
  { href: '/payments', labelKey: 'payments', icon: IconCash, roles: ADMIN_FAMILY, action: 'read', resource: 'payment' },
  { href: '/invoices', labelKey: 'invoices', icon: IconFileInvoice, roles: ADMIN_FAMILY, action: 'read', resource: 'invoice', feature: 'einvoicing' },
  { href: '/payroll', labelKey: 'payroll', icon: IconWallet, roles: ADMIN_FAMILY, action: 'read', resource: 'payroll', feature: 'payroll' },
  { href: '/accounting', labelKey: 'accounting', icon: IconReportMoney, roles: ADMIN_FAMILY, action: 'read', resource: 'accounting', feature: 'accounting' },
  { href: '/billing', label: 'Abbonamento', icon: IconCreditCard, roles: ['ADMIN'], action: 'read', resource: 'subscription' },
  { href: '/notices', labelKey: 'notices', icon: IconBell, roles: ADMIN_FAMILY, action: 'read', resource: 'notice' },
  { href: '/communication', label: 'Comunicazioni', icon: IconMessage, roles: ADMIN_FAMILY, action: 'create', resource: 'message' },
  { href: '/analytics', label: 'Analytics', icon: IconChartBar, roles: ADMIN_FAMILY, action: 'read', resource: 'analytics', feature: 'analytics' },
  { href: '/reports', labelKey: 'reports', icon: IconReport, roles: ADMIN_FAMILY, action: 'read', resource: 'analytics' },

  // --- TEACHER ---
  { href: '/lessons', label: 'Le mie lezioni', icon: IconCalendar, roles: ['TEACHER'], action: 'read', resource: 'lesson' },
  { href: '/attendance', labelKey: 'attendance', icon: IconClipboardList, roles: ['TEACHER'], action: 'read', resource: 'attendance' },
  { href: '/grades', labelKey: 'grades', icon: IconWriting, roles: ['TEACHER'], action: 'read', resource: 'grade' },
  { href: '/homework', labelKey: 'homework', icon: IconNotebook, roles: ['TEACHER'], action: 'read', resource: 'homework' },
  { href: '/disciplinary', labelKey: 'disciplinary', icon: IconAlertTriangle, roles: ['TEACHER'], action: 'read', resource: 'disciplinaryNote' },
  { href: '/report-cards', labelKey: 'reportCards', icon: IconFileDescription, roles: ['TEACHER'], action: 'read', resource: 'reportCard' },
  { href: '/meetings', labelKey: 'meetings', icon: IconCalendarEvent, roles: ['TEACHER'], action: 'read', resource: 'parentMeeting' },
  { href: '/communication', label: 'Comunicazioni', icon: IconMessage, roles: ['TEACHER'], action: 'create', resource: 'message' },
  { href: '/schedules', label: 'Il mio orario', icon: IconCalendarStats, roles: ['TEACHER'], action: 'read', resource: 'schedule' },
  { href: '/subjects', labelKey: 'subjects', icon: IconBooks, roles: ['TEACHER'], action: 'read', resource: 'subject' },
  { href: '/payroll', labelKey: 'myPayslips', icon: IconWallet, roles: ['TEACHER'], action: 'read', resource: 'payroll' },

  // --- STUDENT ---
  { href: '/my/grades', label: 'I miei voti', icon: IconWriting, roles: ['STUDENT'], action: 'read', resource: 'grade' },
  { href: '/my/report-cards', label: 'Pagelle', icon: IconFileDescription, roles: ['STUDENT'], action: 'read', resource: 'reportCard' },
  { href: '/my/homework', label: 'Compiti', icon: IconNotebook, roles: ['STUDENT'], action: 'read', resource: 'homework' },
  { href: '/my/attendance', label: 'Presenze', icon: IconClipboardList, roles: ['STUDENT'], action: 'read', resource: 'attendance' },
  { href: '/my/materials', label: 'Materiali', icon: IconFolder, roles: ['STUDENT'], action: 'read', resource: 'material' },
  { href: '/lessons', labelKey: 'lessons', icon: IconCalendar, roles: ['STUDENT'], action: 'read', resource: 'lesson' },
  { href: '/notices', labelKey: 'notices', icon: IconBell, roles: ['STUDENT'], action: 'read', resource: 'notice' },
  { href: '/my/payments', label: 'Pagamenti', icon: IconCash, roles: ['STUDENT'], action: 'read', resource: 'payment' },

  // --- PARENT ---
  {
    href: '/my',
    label: 'I miei figli',
    icon: IconUserHeart,
    roles: ['PARENT'],
    children: [
      { href: '/my/grades', label: 'Voti', icon: IconWriting, roles: ['PARENT'], action: 'read', resource: 'grade' },
      { href: '/my/report-cards', label: 'Pagelle', icon: IconFileDescription, roles: ['PARENT'], action: 'read', resource: 'reportCard' },
      { href: '/my/homework', label: 'Compiti', icon: IconNotebook, roles: ['PARENT'], action: 'read', resource: 'homework' },
      { href: '/my/attendance', label: 'Presenze', icon: IconClipboardList, roles: ['PARENT'], action: 'read', resource: 'attendance' },
      { href: '/my/notes', label: 'Note', icon: IconAlertTriangle, roles: ['PARENT'], action: 'read', resource: 'disciplinaryNote' },
    ],
  },
  { href: '/my/meetings', label: 'Colloqui', icon: IconCalendarEvent, roles: ['PARENT'], action: 'read', resource: 'parentMeeting' },
  { href: '/notices', labelKey: 'notices', icon: IconBell, roles: ['PARENT'], action: 'read', resource: 'notice' },
  { href: '/my/payments', label: 'Pagamenti', icon: IconCash, roles: ['PARENT'], action: 'read', resource: 'payment' },
];

function isItemVisible(item: NavItem, role: Role | undefined): boolean {
  if (!role) return false;
  if (item.roles && !item.roles.includes(role)) return false;
  if (item.children?.length) {
    return item.children.some((c) => isItemVisible(c, role));
  }
  if (item.action && item.resource) {
    return can(role, item.action, item.resource);
  }
  return true;
}

export function Sidebar({ opened }: SidebarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations('navigation');
  const userRole = session?.user?.role as Role | undefined;
  // Feature del piano per il gating "soft" (badge upsell). Se le feature non
  // sono note (ruolo non admin, fetch fallito) nessun badge: fail-open.
  const { isMissingFeature } = useFeatures();

  const resolveLabel = (item: NavItem) => (item.labelKey ? t(item.labelKey) : item.label ?? item.href);

  const visibleItems = NAV_ITEMS.filter((item) => isItemVisible(item, userRole));

  const linkStyles = (isActive: boolean) => ({
    root: {
      borderRadius: rem(10),
      transition: 'background-color 0.15s ease',
      backgroundColor: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
      boxShadow: isActive ? 'inset 3px 0 0 0 var(--mantine-color-amber-5)' : 'none',
    },
    label: { color: '#fff', fontWeight: isActive ? 600 : 500, fontSize: rem(14) },
    section: { color: 'rgba(255,255,255,0.85)' },
  });

  const isActivePath = (href: string) => {
    const full = `/${locale}/dashboard${href}`;
    return pathname === full || (href !== '' && pathname.startsWith(`${full}/`));
  };

  const renderItem = (item: NavItem) => {
    const Icon = item.icon;
    const label = resolveLabel(item);
    const testId = `sidebar-${item.href === '' ? 'dashboard' : item.href.replace(/^\//, '').replace(/\//g, '-')}`;

    if (item.children?.length) {
      const children = item.children.filter((c) => isItemVisible(c, userRole));
      const anyChildActive = children.some((c) => isActivePath(c.href));
      return (
        <NavLink
          key={`group-${item.href}`}
          label={label}
          leftSection={<Icon size="1.1rem" stroke={1.6} />}
          defaultOpened={anyChildActive}
          data-testid={testId}
          styles={linkStyles(false)}
          childrenOffset={12}
        >
          {children.map((c) => renderItem(c))}
        </NavLink>
      );
    }

    // Feature di piano mancante (SUPERADMIN esente): voce visibile con badge
    // PRO/ENTERPRISE, il click porta alla billing page con l'upsell mirato.
    const gated =
      !!item.feature && userRole !== 'SUPERADMIN' && isMissingFeature(item.feature);

    if (gated && item.feature) {
      return (
        <NavLink
          key={item.href === '' ? 'dashboard' : item.href}
          component={Link}
          href={`/${locale}/dashboard/billing?upsell=${item.feature}`}
          label={label}
          leftSection={<Icon size="1.1rem" stroke={1.6} />}
          rightSection={
            <Badge size="xs" variant="filled" color="amber" radius="sm">
              {featureBadgeLabel(item.feature)}
            </Badge>
          }
          active={false}
          data-testid={`${testId}-upsell`}
          styles={linkStyles(false)}
        />
      );
    }

    const isActive = isActivePath(item.href);
    return (
      <NavLink
        key={item.href === '' ? 'dashboard' : item.href}
        component={Link}
        href={`/${locale}/dashboard${item.href}`}
        label={label}
        leftSection={<Icon size="1.1rem" stroke={1.6} />}
        active={isActive}
        data-testid={testId}
        styles={linkStyles(isActive)}
      />
    );
  };

  return (
    <>
      {/* Nav links — scrollable so a long menu never overflows the viewport */}
      <AppShell.Section grow component={ScrollArea} px="sm" py="md" scrollbarSize={6} type="hover">
        <Stack gap={4}>{visibleItems.map((item) => renderItem(item))}</Stack>
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
