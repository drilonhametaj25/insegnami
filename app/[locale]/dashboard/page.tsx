'use client';

import { useSession } from 'next-auth/react';
import { Container, Title, Grid, Space, Group, Text, Badge, LoadingOverlay, Skeleton } from '@mantine/core';
import { IconDashboard } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import DashboardStats from '@/components/cards/DashboardStats';
import { LessonCalendar } from '@/components/calendar/LessonCalendar';
import RecentActivity from '@/components/tables/RecentActivity';
import { useStudents } from '@/lib/hooks/useStudents';
import { useTeachers } from '@/lib/hooks/useTeachers';
import { useClasses } from '@/lib/hooks/useClasses';
import { usePayments } from '@/lib/hooks/usePayments';
import { useCalendarLessons } from '@/lib/hooks/useLessons';
import { useNotices } from '@/lib/hooks/useNotices';

export default function DashboardPage() {
  const { data: session } = useSession();
  const t = useTranslations('dashboard');
  
  // TanStack Query hooks for dashboard data
  const { 
    data: studentsData, 
    isLoading: studentsLoading,
    error: studentsError 
  } = useStudents(1, 5); // Recent students

  const { 
    data: teachersData, 
    isLoading: teachersLoading 
  } = useTeachers(1, 5); // Recent teachers

  const { 
    data: classesData, 
    isLoading: classesLoading 
  } = useClasses(1, 5); // Recent classes

  const { 
    data: paymentsData, 
    isLoading: paymentsLoading 
  } = usePayments(1, 5); // Recent payments

  const { 
    data: lessons, 
    isLoading: lessonsLoading 
  } = useCalendarLessons();

  const { 
    data: noticesData, 
    isLoading: noticesLoading 
  } = useNotices(1, 5, { status: 'PUBLISHED' }); // Recent published notices

  if (!session?.user) {
    return (
      <Container size="xl" py="md">
        <LoadingOverlay visible />
      </Container>
    );
  }

  const { user } = session;

  // Role-specific welcome messages
  const getWelcomeMessage = () => {
    switch (user.role) {
      case 'ADMIN':
        return {
          title: t('welcome.admin', { name: user.firstName }),
          subtitle: t('welcome.adminSubtitle'),
          badge: t('roles.admin'),
          badgeColor: 'red',
        };
      case 'TEACHER':
        return {
          title: t('welcome.teacher', { name: user.firstName }),
          subtitle: t('welcome.teacherSubtitle'),
          badge: t('roles.teacher'),
          badgeColor: 'blue',
        };
      case 'STUDENT':
        return {
          title: t('welcome.student', { name: user.firstName }),
          subtitle: t('welcome.studentSubtitle'),
          badge: t('roles.student'),
          badgeColor: 'green',
        };
      case 'PARENT':
        return {
          title: t('welcome.parent', { name: user.firstName }),
          subtitle: t('welcome.parentSubtitle'),
          badge: t('roles.parent'),
          badgeColor: 'orange',
        };
      case 'SUPERADMIN':
        return {
          title: t('welcome.superadmin'),
          subtitle: t('welcome.superadminSubtitle'),
          badge: t('roles.superadmin'),
          badgeColor: 'purple',
        };
      default:
        return {
          title: t('welcome.default', { name: user.firstName }),
          subtitle: t('welcome.defaultSubtitle'),
          badge: t('roles.user'),
          badgeColor: 'gray',
        };
    }
  };

  const welcomeInfo = getWelcomeMessage();

  // Check if we're loading essential data
  const isLoadingEssentialData = studentsLoading || teachersLoading || classesLoading;

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" align="flex-start" mb="xl">
        <div>
          <Group align="center" mb="xs">
            <IconDashboard size={32} />
            <Title order={1}>{welcomeInfo.title}</Title>
            <Badge color={welcomeInfo.badgeColor} variant="light">
              {welcomeInfo.badge}
            </Badge>
          </Group>
          <Text c="dimmed" size="lg">
            {welcomeInfo.subtitle}
          </Text>
        </div>
      </Group>

      <Space h="md" />

      {/* Dashboard Statistics */}
      <Grid mb="xl">
        <Grid.Col span={12}>
          {isLoadingEssentialData ? (
            <Grid>
              {[1, 2, 3, 4].map((i) => (
                <Grid.Col key={i} span={{ base: 12, sm: 6, md: 3 }}>
                  <Skeleton height={120} />
                </Grid.Col>
              ))}
            </Grid>
          ) : studentsError ? (
            <Text c="red">Errore nel caricamento delle statistiche: {studentsError.message}</Text>
          ) : (
            <DashboardStats
              role={user.role === 'SUPERADMIN' ? 'ADMIN' : user.role}
              data={{
                students: studentsData?.pagination?.total || 0,
                teachers: teachersData?.pagination?.total || 0,
                classes: classesData?.pagination?.total || 0,
                lessons: lessons?.length || 0,
                revenue: paymentsData?.payments.reduce((sum, p) => sum + p.amount, 0) || 0,
                attendance: 87, // This would come from attendance API
                pendingPayments: paymentsData?.payments.filter(p => p.status === 'PENDING').length || 0,
                upcomingLessons: lessons?.filter(l => l.status === 'SCHEDULED' && new Date(l.startTime) > new Date()).length || 0,
              }}
            />
          )}
        </Grid.Col>
      </Grid>

      {/* Main Dashboard Content */}
      <Grid>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          {/* Calendar Component */}
          <div style={{ marginBottom: '1.5rem' }}>
            <Title order={3} mb="md">
              Calendario Lezioni
            </Title>
            {lessonsLoading ? (
              <Skeleton height={400} />
            ) : (
              <LessonCalendar 
                lessons={lessons?.map(lesson => ({
                  ...lesson,
                  class: {
                    ...lesson.class,
                    course: {
                      name: lesson.class.name // Use class name as course name fallback
                    }
                  }
                })) || []} 
              />
            )}
          </div>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          {/* Recent Activity */}
          <div style={{ marginBottom: '1.5rem' }}>
            <Title order={3} mb="md">
              Attività Recente
            </Title>
            {noticesLoading ? (
              <Skeleton height={300} />
            ) : (
              <RecentActivity 
                maxItems={8}
                showActions={false}
              />
            )}
          </div>
        </Grid.Col>
      </Grid>
    </Container>
  );
}
