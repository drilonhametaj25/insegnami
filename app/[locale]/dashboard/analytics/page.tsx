'use client';

import { useState } from 'react';
import { 
  Container, 
  Title, 
  Grid, 
  Paper, 
  Text, 
  Button, 
  Select, 
  Group,
  Stack,
  Card,
  Badge,
  ActionIcon,
  Tooltip,
  Alert
} from '@mantine/core';
import { 
  IconUsers, 
  IconSchool, 
  IconBook, 
  IconCalendar, 
  IconCoin, 
  IconTrendingUp, 
  IconDownload, 
  IconRefresh,
  IconInfoCircle
} from '@tabler/icons-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { useTranslations } from 'next-intl';
import { 
  useOverviewStats, 
  useAttendanceStats, 
  useFinancialStats, 
  useTrendStats,
  exportAnalyticsData 
} from '@/lib/hooks/useAnalytics';
import { format, parseISO } from 'date-fns';

const COLORS = ['#339af0', '#51cf66', '#ffd43b', '#ff6b6b', '#845ef7'];

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  change?: number;
}

function StatCard({ title, value, icon, color, change }: StatCardProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between">
        <div>
          <Text c="dimmed" size="sm" fw={500} tt="uppercase">
            {title}
          </Text>
          <Text fw={700} size="xl">
            {value}
          </Text>
          {change !== undefined && (
            <Group gap={4} mt={5}>
              <IconTrendingUp size={14} />
              <Text c={change > 0 ? 'teal' : 'red'} size="sm" fw={500}>
                {change > 0 ? '+' : ''}{change.toFixed(1)}%
              </Text>
            </Group>
          )}
        </div>
        <div style={{ color }}>
          {icon}
        </div>
      </Group>
    </Paper>
  );
}

export default function AnalyticsPage() {
  const t = useTranslations('Analytics');
  const [period, setPeriod] = useState('30');
  const [selectedChart, setSelectedChart] = useState('overview');

  const { data: overviewStats, isLoading: overviewLoading, refetch: refetchOverview } = useOverviewStats(period);
  const { data: attendanceStats, isLoading: attendanceLoading } = useAttendanceStats(period);
  const { data: financialStats, isLoading: financialLoading } = useFinancialStats(period);
  const { data: trendStats, isLoading: trendsLoading } = useTrendStats(period);

  const isLoading = overviewLoading || attendanceLoading || financialLoading || trendsLoading;

  const handleExport = async (type: string, format: 'csv' | 'xlsx' | 'pdf') => {
    try {
      await exportAnalyticsData(type, format, period);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Transform data for charts
  const attendanceChartData = attendanceStats?.byStatus.map(item => ({
    name: item.status,
    value: item._count.status,
    percentage: attendanceStats.totalRecords > 0 
      ? ((item._count.status / attendanceStats.totalRecords) * 100).toFixed(1)
      : 0
  })) || [];

  const financialChartData = financialStats?.byStatus.map(item => ({
    name: item.status,
    count: item._count.status,
    amount: item._sum.amount || 0
  })) || [];

  const dailyRevenueData = Object.entries(financialStats?.dailyRevenue || {})
    .map(([date, amount]) => ({
      date: format(parseISO(date), 'MMM dd'),
      revenue: amount
    }))
    .slice(-14); // Last 14 days

  const enrollmentTrendsData = Object.entries(trendStats?.enrollments || {})
    .map(([date, count]) => ({
      date: format(parseISO(date), 'MMM dd'),
      enrollments: count
    }))
    .slice(-14);

  const lessonTrendsData = Object.entries(trendStats?.lessons || {})
    .map(([date, count]) => ({
      date: format(parseISO(date), 'MMM dd'),
      lessons: count
    }))
    .slice(-14);

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>{t('title') || 'Analytics & Reports'}</Title>
          <Text c="dimmed" size="sm">
            {t('subtitle') || 'Comprehensive analytics and reporting dashboard'}
          </Text>
        </div>

        <Group>
          <Select
            data={[
              { value: '7', label: t('7days') || '7 Days' },
              { value: '30', label: t('30days') || '30 Days' },
              { value: '90', label: t('90days') || '90 Days' },
              { value: '365', label: t('1year') || '1 Year' }
            ]}
            value={period}
            onChange={(value) => setPeriod(value || '30')}
            w={120}
          />
          
          <Tooltip label={t('refresh') || 'Refresh Data'}>
            <ActionIcon 
              variant="light" 
              onClick={() => refetchOverview()}
              loading={isLoading}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* Overview Stats Cards */}
      <Grid mb="xl">
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <StatCard
            title={t('totalStudents') || 'Total Students'}
            value={overviewStats?.totalStudents || 0}
            icon={<IconUsers size={32} />}
            color="#339af0"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <StatCard
            title={t('totalTeachers') || 'Total Teachers'}
            value={overviewStats?.totalTeachers || 0}
            icon={<IconSchool size={32} />}
            color="#51cf66"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <StatCard
            title={t('totalClasses') || 'Total Classes'}
            value={overviewStats?.totalClasses || 0}
            icon={<IconBook size={32} />}
            color="#ffd43b"
          />
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <StatCard
            title={t('totalLessons') || 'Lessons This Period'}
            value={overviewStats?.totalLessons || 0}
            icon={<IconCalendar size={32} />}
            color="#ff6b6b"
          />
        </Grid.Col>
      </Grid>

      {/* Key Metrics */}
      <Grid mb="xl">
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" mb="xs">
              <Text fw={500}>Attendance Rate</Text>
              <Badge color="green" variant="light">
                {overviewStats?.attendanceRate.toFixed(1) || 0}%
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              Average attendance across all classes
            </Text>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" mb="xs">
              <Text fw={500}>Total Revenue</Text>
              <Badge color="blue" variant="light">
                €{overviewStats?.totalRevenue.toFixed(2) || 0}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              Revenue for selected period
            </Text>
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Paper withBorder p="md" radius="md">
            <Group justify="space-between" mb="xs">
              <Text fw={500}>Overdue Payments</Text>
              <Badge color="red" variant="light">
                {overviewStats?.overduePayments || 0}
              </Badge>
            </Group>
            <Text size="sm" c="dimmed">
              Payments requiring attention
            </Text>
          </Paper>
        </Grid.Col>
      </Grid>

      {/* Charts Section */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder p="lg" radius="md" h={400}>
            <Group justify="space-between" mb="md">
              <Title order={4}>Attendance Overview</Title>
              <Button 
                variant="subtle" 
                size="xs"
                onClick={() => handleExport('attendance', 'xlsx')}
              >
                <IconDownload size={14} />
              </Button>
            </Group>
            {attendanceChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="85%">
                <PieChart>
                  <Pie
                    data={attendanceChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percentage }) => `${name}: ${percentage}%`}
                  >
                    {attendanceChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Stack align="center" justify="center" h="85%">
                <IconInfoCircle size={48} color="gray" />
                <Text c="dimmed">No attendance data available</Text>
              </Stack>
            )}
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder p="lg" radius="md" h={400}>
            <Group justify="space-between" mb="md">
              <Title order={4}>Daily Revenue</Title>
              <Button 
                variant="subtle" 
                size="xs"
                onClick={() => handleExport('financial', 'xlsx')}
              >
                <IconDownload size={14} />
              </Button>
            </Group>
            {dailyRevenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="85%">
                <AreaChart data={dailyRevenueData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#339af0" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#339af0" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip formatter={(value) => [`€${value}`, 'Revenue']} />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#339af0" 
                    fillOpacity={1} 
                    fill="url(#colorRevenue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Stack align="center" justify="center" h="85%">
                <IconInfoCircle size={48} color="gray" />
                <Text c="dimmed">No revenue data available</Text>
              </Stack>
            )}
          </Card>
        </Grid.Col>

        <Grid.Col span={12}>
          <Card withBorder p="lg" radius="md" h={400}>
            <Group justify="space-between" mb="md">
              <Title order={4}>Enrollment & Lesson Trends</Title>
              <Button 
                variant="subtle" 
                size="xs"
                onClick={() => handleExport('trends', 'xlsx')}
              >
                <IconDownload size={14} />
              </Button>
            </Group>
            {(enrollmentTrendsData.length > 0 || lessonTrendsData.length > 0) ? (
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={enrollmentTrendsData.map((enrollment, index) => ({
                  ...enrollment,
                  lessons: lessonTrendsData[index]?.lessons || 0
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="enrollments" 
                    stroke="#51cf66" 
                    strokeWidth={2}
                    name="New Enrollments"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="lessons" 
                    stroke="#339af0" 
                    strokeWidth={2}
                    name="Lessons"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Stack align="center" justify="center" h="85%">
                <IconInfoCircle size={48} color="gray" />
                <Text c="dimmed">No trend data available</Text>
              </Stack>
            )}
          </Card>
        </Grid.Col>
      </Grid>

      {/* Export Actions */}
      <Paper withBorder p="md" mt="xl" radius="md">
        <Group justify="space-between">
          <div>
            <Text fw={500}>Export Data</Text>
            <Text size="sm" c="dimmed">
              Download analytics data in various formats
            </Text>
          </div>
          <Group>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExport('overview', 'csv')}
            >
              Export CSV
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExport('overview', 'xlsx')}
            >
              Export Excel
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => handleExport('overview', 'pdf')}
            >
              Export PDF
            </Button>
          </Group>
        </Group>
      </Paper>
    </Container>
  );
}
