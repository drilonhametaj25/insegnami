'use client';

import { AppShell, LoadingOverlay, Stack, Center, Text, ThemeIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useEffect, useState } from 'react';
import { IconSchool } from '@tabler/icons-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [opened, { toggle }] = useDisclosure();
  const { data: session, status } = useSession();
  const router = useRouter();
  const locale = useLocale();

  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    if (status === 'loading') return; // Still loading
    if (!session) {
      router.push(`/${locale}/auth/login`); // Redirect to localized login
    }
  }, [session, status, router, locale]);

  // Onboarding guard: redirect admin roles to onboarding if not complete
  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) return;
    const adminRoles = ['ADMIN', 'SUPERADMIN', 'DIRECTOR', 'SECRETARY'];
    if (!adminRoles.includes(session.user.role)) {
      setOnboardingChecked(true);
      return;
    }
    fetch('/api/onboarding')
      .then(res => res.json())
      .then(data => {
        if (!data.isComplete) {
          router.push(`/${locale}/onboarding`);
        } else {
          setOnboardingChecked(true);
        }
      })
      .catch(() => setOnboardingChecked(true));
  }, [session, status, locale, router]);

  if (status === 'loading' || !session || !onboardingChecked) {
    return (
      <div style={{ 
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Stack align="center" gap="lg">
          <ThemeIcon
            size={80}
            radius="xl"
            variant="gradient"
            gradient={{ from: 'blue', to: 'purple' }}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <IconSchool size={50} />
          </ThemeIcon>
          <Text c="white" size="lg" fw={600}>
            Caricamento della dashboard...
          </Text>
        </Stack>
      </div>
    );
  }

  return (
    <AppShell
      navbar={{
        width: 300,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      header={{ height: 70 }}
      padding="md"
      styles={{
        main: {
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          minHeight: 'calc(100vh - 70px)',
        },
        navbar: {
          border: 'none',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        },
        header: {
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          backdropFilter: 'blur(10px)',
          border: 'none',
        },
      }}
    >
      <AppShell.Header>
        <Navbar opened={opened} toggle={toggle} />
      </AppShell.Header>

      <AppShell.Navbar p="md">
        <Sidebar opened={opened} />
      </AppShell.Navbar>

      <AppShell.Main>
        {children}
      </AppShell.Main>
    </AppShell>
  );
}
