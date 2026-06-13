'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Container,
  Title,
  Paper,
  Card,
  Table,
  Group,
  Text,
  Badge,
  Stack,
  Anchor,
  SimpleGrid,
  Progress,
  Loader,
  Alert,
  Center,
  ThemeIcon,
  Divider,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconInfoCircle,
  IconUsers,
  IconUser,
  IconSchool,
  IconCalendarStats,
  IconCash,
  IconChartBar,
  IconClipboardCheck,
  IconTrendingUp,
} from '@tabler/icons-react';
import { useLocale } from 'next-intl';
import { format } from 'date-fns';
import { useReport } from '@/lib/hooks/useAnalytics';

// Map report.type -> analytics endpoint type
const ANALYTICS_TYPE_MAP: Record<string, string> = {
  ATTENDANCE: 'attendance',
  FINANCIAL: 'financial',
  OVERVIEW: 'overview',
  PROGRESS: 'trends',
  CLASS_ANALYTICS: 'overview',
  TEACHER_PERFORMANCE: 'overview',
};

const BADGE_COLORS: Record<string, string> = {
  ATTENDANCE: 'blue',
  FINANCIAL: 'green',
  PROGRESS: 'orange',
  OVERVIEW: 'navy',
  CLASS_ANALYTICS: 'cyan',
  TEACHER_PERFORMANCE: 'amber',
};

interface StatItem {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
}

function StatGrid({ stats }: { stats: StatItem[] }) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
      {stats.map((stat) => (
        <Card key={stat.label} withBorder padding="md" radius="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                {stat.label}
              </Text>
              <Text size="xl" fw={700} mt={4}>
                {stat.value}
              </Text>
            </div>
            <ThemeIcon variant="light" color={stat.color || 'navy'} size="lg" radius="md">
              {stat.icon}
            </ThemeIcon>
          </Group>
        </Card>
      ))}
    </SimpleGrid>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Alert icon={<IconInfoCircle size={16} />} color="blue" title="Nessun dato disponibile">
      {message}
    </Alert>
  );
}

function OverviewContent({ data }: { data: any }) {
  const stats: StatItem[] = [
    { label: 'Studenti attivi', value: data.totalStudents ?? 0, icon: <IconUsers size={20} />, color: 'navy' },
    { label: 'Docenti attivi', value: data.totalTeachers ?? 0, icon: <IconUser size={20} />, color: 'amber' },
    { label: 'Classi attive', value: data.totalClasses ?? 0, icon: <IconSchool size={20} />, color: 'cyan' },
    { label: 'Lezioni (periodo)', value: data.totalLessons ?? 0, icon: <IconCalendarStats size={20} />, color: 'teal' },
  ];

  const revenue = Number(data.totalRevenue ?? 0);
  const attendanceRate = Number(data.attendanceRate ?? 0);

  return (
    <Stack gap="lg">
      <StatGrid stats={stats} />

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card withBorder padding="lg" radius="md">
          <Text size="sm" c="dimmed" fw={600} tt="uppercase">
            Tasso di presenza
          </Text>
          <Group justify="space-between" align="baseline" mt="xs">
            <Text size="2rem" fw={700}>
              {attendanceRate.toFixed(1)}%
            </Text>
            <Badge color="green" variant="light">
              Periodo report
            </Badge>
          </Group>
          <Progress value={Math.min(100, attendanceRate)} color="green" size="lg" radius="xl" mt="md" />
        </Card>

        <Card withBorder padding="lg" radius="md">
          <Text size="sm" c="dimmed" fw={600} tt="uppercase">
            Ricavi (incassati)
          </Text>
          <Group justify="space-between" align="baseline" mt="xs">
            <Text size="2rem" fw={700}>
              € {revenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </Text>
          </Group>
          <Group gap="xs" mt="md">
            <Badge color="red" variant="light">
              {data.overduePayments ?? 0} pagamenti scaduti
            </Badge>
            <Badge color="navy" variant="light">
              {data.activeStudents ?? 0} studenti attivi (30gg)
            </Badge>
          </Group>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}

function AttendanceContent({ data }: { data: any }) {
  const byStatus: Array<{ status: string; _count: { status: number } }> = data.byStatus || [];
  const total = data.totalRecords ?? 0;

  if (!byStatus.length && !total) {
    return <EmptyState message="Non ci sono presenze registrate nel periodo selezionato per questo report." />;
  }

  const statusColors: Record<string, string> = {
    PRESENT: 'green',
    ABSENT: 'red',
    LATE: 'orange',
    EXCUSED: 'blue',
  };

  return (
    <Stack gap="lg">
      <StatGrid
        stats={[
          {
            label: 'Record totali',
            value: total,
            icon: <IconClipboardCheck size={20} />,
            color: 'navy',
          },
          ...byStatus.map((s) => ({
            label: s.status,
            value: s._count?.status ?? 0,
            icon: <IconUsers size={20} />,
            color: statusColors[s.status] || 'gray',
          })),
        ]}
      />

      <Card withBorder padding="lg" radius="md">
        <Text fw={600} mb="md">
          Distribuzione presenze
        </Text>
        <Stack gap="sm">
          {byStatus.map((s) => {
            const count = s._count?.status ?? 0;
            const pct = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={s.status}>
                <Group justify="space-between" mb={4}>
                  <Group gap="xs">
                    <Badge color={statusColors[s.status] || 'gray'} variant="light">
                      {s.status}
                    </Badge>
                    <Text size="sm" c="dimmed">
                      {count} record
                    </Text>
                  </Group>
                  <Text size="sm" fw={500}>
                    {pct.toFixed(1)}%
                  </Text>
                </Group>
                <Progress value={pct} color={statusColors[s.status] || 'gray'} size="md" radius="xl" />
              </div>
            );
          })}
        </Stack>
      </Card>
    </Stack>
  );
}

function FinancialContent({ data }: { data: any }) {
  const byStatus: Array<{ status: string; _count: { status: number }; _sum: { amount: number | null } }> =
    data.byStatus || [];
  const totalRevenue = Number(data.totalRevenue ?? 0);

  if (!byStatus.length) {
    return <EmptyState message="Non ci sono pagamenti registrati nel periodo selezionato per questo report." />;
  }

  const statusColors: Record<string, string> = {
    PAID: 'green',
    PENDING: 'orange',
    OVERDUE: 'red',
    CANCELLED: 'gray',
    REFUNDED: 'blue',
  };

  return (
    <Stack gap="lg">
      <StatGrid
        stats={[
          {
            label: 'Ricavi totali',
            value: `€ ${totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
            icon: <IconCash size={20} />,
            color: 'green',
          },
          ...byStatus.map((s) => ({
            label: s.status,
            value: s._count?.status ?? 0,
            icon: <IconChartBar size={20} />,
            color: statusColors[s.status] || 'gray',
          })),
        ]}
      />

      <Card withBorder padding="lg" radius="md">
        <Text fw={600} mb="md">
          Pagamenti per stato
        </Text>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Stato</Table.Th>
              <Table.Th>Numero</Table.Th>
              <Table.Th>Importo</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {byStatus.map((s) => (
              <Table.Tr key={s.status}>
                <Table.Td>
                  <Badge color={statusColors[s.status] || 'gray'} variant="light">
                    {s.status}
                  </Badge>
                </Table.Td>
                <Table.Td>{s._count?.status ?? 0}</Table.Td>
                <Table.Td>
                  € {Number(s._sum?.amount ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}

function TrendsContent({ data }: { data: any }) {
  const enrollments: Record<string, number> = data.enrollments || {};
  const lessons: Record<string, number> = data.lessons || {};

  const enrollmentRows = Object.entries(enrollments).sort(([a], [b]) => a.localeCompare(b));
  const lessonRows = Object.entries(lessons).sort(([a], [b]) => a.localeCompare(b));

  const totalEnrollments = enrollmentRows.reduce((sum, [, v]) => sum + v, 0);
  const totalLessons = lessonRows.reduce((sum, [, v]) => sum + v, 0);

  if (!enrollmentRows.length && !lessonRows.length) {
    return <EmptyState message="Non ci sono iscrizioni o lezioni nel periodo selezionato per questo report." />;
  }

  return (
    <Stack gap="lg">
      <StatGrid
        stats={[
          {
            label: 'Nuove iscrizioni',
            value: totalEnrollments,
            icon: <IconTrendingUp size={20} />,
            color: 'navy',
          },
          {
            label: 'Lezioni svolte',
            value: totalLessons,
            icon: <IconCalendarStats size={20} />,
            color: 'amber',
          },
        ]}
      />

      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card withBorder padding="lg" radius="md">
          <Text fw={600} mb="md">
            Iscrizioni per data
          </Text>
          {enrollmentRows.length ? (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Data</Table.Th>
                  <Table.Th>Iscrizioni</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {enrollmentRows.map(([date, count]) => (
                  <Table.Tr key={date}>
                    <Table.Td>{date}</Table.Td>
                    <Table.Td>{count}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text size="sm" c="dimmed">
              Nessuna iscrizione nel periodo.
            </Text>
          )}
        </Card>

        <Card withBorder padding="lg" radius="md">
          <Text fw={600} mb="md">
            Lezioni per data
          </Text>
          {lessonRows.length ? (
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Data</Table.Th>
                  <Table.Th>Lezioni</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {lessonRows.map(([date, count]) => (
                  <Table.Tr key={date}>
                    <Table.Td>{date}</Table.Td>
                    <Table.Td>{count}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text size="sm" c="dimmed">
              Nessuna lezione nel periodo.
            </Text>
          )}
        </Card>
      </SimpleGrid>
    </Stack>
  );
}

export default function ReportDetailPage() {
  const params = useParams();
  const locale = useLocale();
  const id = (params?.id as string) || '';

  const { data: report, isLoading, isError } = useReport(id);

  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState(false);
  const [mappedType, setMappedType] = useState<string>('overview');

  useEffect(() => {
    if (!report) return;

    const mapped = ANALYTICS_TYPE_MAP[report.type] || 'overview';
    setMappedType(mapped);

    const start = new Date(report.startDate).getTime();
    const end = new Date(report.endDate).getTime();
    const days = Math.max(1, Math.round((end - start) / 86400000));

    let cancelled = false;
    setAnalyticsLoading(true);
    setAnalyticsError(false);

    fetch(`/api/analytics?type=${mapped}&period=${days}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load analytics');
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setAnalyticsData(data);
          setAnalyticsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAnalyticsError(true);
          setAnalyticsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [report]);

  if (isLoading) {
    return (
      <Container size="xl" py="md">
        <Center mih={300}>
          <Loader color="navy" />
        </Center>
      </Container>
    );
  }

  if (isError || !report) {
    return (
      <Container size="xl" py="md">
        <Anchor component={Link} href={`/${locale}/dashboard/reports`} mb="md" style={{ display: 'inline-block' }}>
          <Group gap={4}>
            <IconArrowLeft size={16} />
            <span>Torna ai report</span>
          </Group>
        </Anchor>
        <Alert icon={<IconInfoCircle size={16} />} color="red" title="Report non trovato" mt="md">
          Il report richiesto non esiste o non è accessibile.
        </Alert>
      </Container>
    );
  }

  const renderContent = () => {
    if (analyticsLoading) {
      return (
        <Center mih={200}>
          <Loader color="navy" />
        </Center>
      );
    }
    if (analyticsError || !analyticsData) {
      return (
        <EmptyState message="Non è stato possibile caricare i dati analitici per questo report. Riprova più tardi." />
      );
    }

    switch (mappedType) {
      case 'attendance':
        return <AttendanceContent data={analyticsData} />;
      case 'financial':
        return <FinancialContent data={analyticsData} />;
      case 'trends':
        return <TrendsContent data={analyticsData} />;
      case 'overview':
      default:
        return <OverviewContent data={analyticsData} />;
    }
  };

  return (
    <Container size="xl" py="md">
      <Anchor
        component={Link}
        href={`/${locale}/dashboard/reports`}
        mb="md"
        c="navy"
        style={{ display: 'inline-block' }}
      >
        <Group gap={4}>
          <IconArrowLeft size={16} />
          <span>Torna ai report</span>
        </Group>
      </Anchor>

      <Paper withBorder p="lg" radius="md" mb="lg" mt="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Group gap="sm" align="center">
              <Title order={2}>{report.title}</Title>
              <Badge color={BADGE_COLORS[report.type] || 'gray'} size="lg">
                {report.type.replace(/_/g, ' ')}
              </Badge>
            </Group>
            <Group gap="lg" mt="sm">
              <Text size="sm" c="dimmed">
                <strong>Periodo:</strong> {report.period}
              </Text>
              <Text size="sm" c="dimmed">
                <strong>Date:</strong> {format(new Date(report.startDate), 'dd MMM yyyy')} –{' '}
                {format(new Date(report.endDate), 'dd MMM yyyy')}
              </Text>
            </Group>
            <Group gap="lg" mt={4}>
              <Text size="sm" c="dimmed">
                <strong>Generato da:</strong>{' '}
                {report.user ? `${report.user.firstName} ${report.user.lastName}` : '—'}
              </Text>
              <Text size="sm" c="dimmed">
                <strong>Creato il:</strong> {format(new Date(report.createdAt), 'dd MMM yyyy, HH:mm')}
              </Text>
            </Group>
          </div>
        </Group>
      </Paper>

      <Divider
        my="md"
        label={
          <Text size="sm" fw={600}>
            Contenuto del report
          </Text>
        }
        labelPosition="left"
      />

      {renderContent()}
    </Container>
  );
}
