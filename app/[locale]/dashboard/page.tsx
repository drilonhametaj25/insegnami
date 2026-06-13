'use client';

import { useSession } from 'next-auth/react';
import { Container, Title, Grid, Group, Text, Badge, LoadingOverlay, Skeleton, Paper } from '@mantine/core';
import { IconDashboard, IconSparkles } from '@tabler/icons-react';
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
import { useOverviewStats } from '@/lib/hooks/useAnalytics';

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

  // Real tenant-wide stats (attendanceRate, totalRevenue, totalStudents, ...)
  const {
    data: overview,
    isLoading: overviewLoading,
  } = useOverviewStats('30');

  if (!session?.user) {
    return (
      <Container
        size="xl"
        py="md"
        style={{
          background: 'var(--mantine-color-body)',
          minHeight: '100vh',
        }}
      >
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
  const isLoadingEssentialData =
    studentsLoading || teachersLoading || classesLoading || overviewLoading;

  // Build the stats payload preferring real /api/analytics overview numbers
  // (tenant-real), falling back to the paginated hook totals when overview is
  // unavailable. No invented values: missing data stays at 0.
  const upcomingLessons =
    lessons?.filter((l) => l.status === 'SCHEDULED' && new Date(l.startTime) > new Date()).length || 0;

  const statsData = {
    students: overview?.totalStudents ?? studentsData?.pagination?.total ?? 0,
    teachers: overview?.totalTeachers ?? teachersData?.pagination?.total ?? 0,
    classes: overview?.totalClasses ?? classesData?.pagination?.total ?? 0,
    lessons: overview?.totalLessons ?? lessons?.length ?? 0,
    // Real revenue from analytics overview (paid payments, last 30 days)
    revenue:
      overview?.totalRevenue ??
      paymentsData?.payments.reduce((sum, p) => sum + p.amount, 0) ??
      0,
    // Real attendance rate from analytics overview (no more hardcoded 87)
    attendance: overview?.attendanceRate,
    pendingPayments:
      overview?.overduePayments ??
      paymentsData?.payments.filter((p) => p.status === 'PENDING').length ??
      0,
    upcomingLessons,
  };

  // Empty state: brand-new school with no real data yet.
  const isEmptySchool =
    !isLoadingEssentialData &&
    statsData.students === 0 &&
    statsData.teachers === 0 &&
    statsData.classes === 0 &&
    statsData.lessons === 0;

  return (
    <Container 
      size="xl" 
      py="md"
      style={{
        background: 'var(--mantine-color-body)',
        minHeight: '100vh',
      }}
    >
      {/* Welcome Header with gradient background */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)',
          borderRadius: '24px',
          padding: '32px',
          marginBottom: '32px',
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '-50%',
            right: '-20%',
            width: '300px',
            height: '300px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '50%',
            filter: 'blur(40px)',
          }}
        />
        <div
          style={{
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Group justify="space-between" align="flex-start">
            <div>
              <Group align="center" mb="xs">
                <IconDashboard size={32} color="white" />
                <Title order={1} c="white">{welcomeInfo.title}</Title>
                <Badge 
                  color={welcomeInfo.badgeColor} 
                  variant="white" 
                  style={{ 
                    background: 'rgba(255, 255, 255, 0.9)',
                    color: '#1a1a1a',
                  }}
                >
                  {welcomeInfo.badge}
                </Badge>
              </Group>
              <Text c="rgba(255, 255, 255, 0.9)" size="lg">
                {welcomeInfo.subtitle}
              </Text>
            </div>
          </Group>
        </div>
      </div>

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
            <>
              {isEmptySchool && (
                <Paper withBorder radius="lg" p="lg" mb="md">
                  <Group gap="sm" align="flex-start" wrap="nowrap">
                    <IconSparkles size={24} color="var(--mantine-color-amber-5)" />
                    <div>
                      <Text fw={600}>Benvenuto su InsegnaMi.pro</Text>
                      <Text size="sm" c="dimmed">
                        La tua scuola non ha ancora dati. Inizia aggiungendo docenti,
                        classi e studenti: le statistiche qui sotto si popoleranno
                        automaticamente con i numeri reali.
                      </Text>
                    </div>
                  </Group>
                </Paper>
              )}
              <DashboardStats
                role={user.role === 'SUPERADMIN' ? 'ADMIN' : user.role}
                data={statsData}
              />
            </>
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
